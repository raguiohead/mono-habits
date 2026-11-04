import { type PomoTask } from '@/types/habit';
import {
  type GoogleTaskItem,
  listTasks,
  insertTask,
  patchTask,
  deleteTask as apiDeleteTask
} from './googleTasksApi';

export interface SyncPlan {
  /** Tarefas a serem inseridas ou atualizadas no armazenamento local */
  toUpsertLocal: PomoTask[];
  /** IDs de tarefas locais a serem marcadas com deleted: true */
  toTombstoneLocal: string[];
  /** Tarefas locais que precisam ser criadas no Google Tasks */
  toPushCreateRemote: {
    localTaskId: string;
    payload: {
      title: string;
      notes?: string;
      status: 'needsAction' | 'completed';
      completed?: string;
    };
  }[];
  /** Tarefas locais que precisam ser atualizadas no Google Tasks */
  toPushUpdateRemote: {
    localTaskId: string;
    googleTaskId: string;
    payload: {
      title?: string;
      notes?: string | null;
      status?: 'needsAction' | 'completed';
      completed?: string | null;
    };
  }[];
  /** IDs de tarefas do Google Tasks a serem excluídas */
  toDeleteRemote: string[];
}

/**
 * Motor puro de merge bidirecional com Last-Writer-Wins (LWW) baseado em timestamps.
 */
export function mergeTasks(
  localTasks: PomoTask[],
  remoteItems: GoogleTaskItem[],
  listId: string
): SyncPlan {
  const toUpsertLocal: PomoTask[] = [];
  const toTombstoneLocal: string[] = [];
  const toPushCreateRemote: SyncPlan['toPushCreateRemote'] = [];
  const toPushUpdateRemote: SyncPlan['toPushUpdateRemote'] = [];
  const toDeleteRemote: string[] = [];

  // Mapa de itens remotos por ID do Google
  const remoteMap = new Map<string, GoogleTaskItem>();
  remoteItems.forEach((r) => remoteMap.set(r.id, r));

  // Mapa de tarefas locais que têm vínculo com esta lista
  const linkedLocalByGoogleId = new Map<string, PomoTask>();
  localTasks.forEach((l) => {
    if (l.google?.listId === listId && l.google.taskId) {
      linkedLocalByGoogleId.set(l.google.taskId, l);
    }
  });

  // 1. Processa tarefas locais
  for (const local of localTasks) {
    // Defesa: se a tarefa está vinculada a outra lista, é totalmente ignorada
    // (não é criada na lista atual, não sofre tombstone e não é atualizada)
    if (local.google?.listId && local.google.listId !== listId) {
      continue;
    }

    const googleRef = local.google?.listId === listId ? local.google : undefined;

    // Tarefa local ainda não vinculada
    if (!googleRef) {
      // Só tarefas sem vínculo Google entram em toPushCreateRemote
      if (!local.google && !local.deleted) {
        toPushCreateRemote.push({
          localTaskId: local.id,
          payload: {
            title: local.title,
            ...(local.notes ? { notes: local.notes } : {}),
            status: local.done ? 'completed' : 'needsAction',
            ...(local.done && local.doneAt ? { completed: new Date(local.doneAt).toISOString() } : {})
          }
        });
      }
      continue;
    }

    const remote = remoteMap.get(googleRef.taskId);

    // Se a tarefa existia no Google mas sumiu do retorno (ou não veio)
    if (!remote) {
      if (local.deleted) {
        // Já está deletada localmente e não existe no Google: nada a fazer
      } else {
        // Pode ter sido excluída no Google -> marca tombstone localmente
        toTombstoneLocal.push(local.id);
      }
      continue;
    }

    // Remoto marcado como excluído no Google: vira tombstone local
    if (remote.deleted) {
      if (!local.deleted) {
        toTombstoneLocal.push(local.id);
      }
      continue;
    }

    // Remoto oculto no Google (ex: "Limpar tarefas concluídas" no Google Tasks)
    // Mantém a tarefa local como concluída e remove o vínculo google, sem tombstone
    if (remote.hidden) {
      if (!local.deleted) {
        const isCompleted = remote.status === 'completed' || local.done;
        const { google: _removedGoogle, ...localWithoutGoogle } = local;
        toUpsertLocal.push({
          ...localWithoutGoogle,
          done: isCompleted ? true : local.done,
          ...(isCompleted
            ? {
                doneAt:
                  local.doneAt ||
                  (remote.completed ? new Date(remote.completed).getTime() : Date.now())
              }
            : local.doneAt !== undefined
              ? { doneAt: local.doneAt }
              : {}),
          updatedAt: Date.now()
        });
      }
      continue;
    }

    // Local marcado como deletado
    if (local.deleted) {
      toDeleteRemote.push(remote.id);
      continue;
    }

    // Ambas existem e estão ativas -> Conflito LWW
    const localUpdated = local.updatedAt || local.createdAt;
    const remoteUpdated = new Date(remote.updated).getTime() || 0;

    // Diferença mínima de 500 ms para evitar roundtrips desnecessários
    if (remoteUpdated > localUpdated + 500) {
      // Google é mais recente -> atualiza local preservando estimatedPomos, order e createdAt
      const remoteDone = remote.status === 'completed';
      const cleanRemoteNotes = remote.notes?.trim();
      const { notes: _prevNotes, doneAt: _prevDoneAt, ...baseLocal } = local;
      const updatedLocal: PomoTask = {
        ...baseLocal,
        title: remote.title || local.title,
        ...(cleanRemoteNotes ? { notes: cleanRemoteNotes } : {}),
        done: remoteDone,
        ...(remoteDone
          ? {
              doneAt: remote.completed
                ? new Date(remote.completed).getTime()
                : local.doneAt || remoteUpdated
            }
          : {}),
        updatedAt: remoteUpdated,
        google: {
          listId,
          taskId: remote.id,
          updated: remote.updated
        }
      };
      toUpsertLocal.push(updatedLocal);
    } else if (localUpdated > remoteUpdated + 500) {
      // Local é mais recente -> envia atualização ao Google
      toPushUpdateRemote.push({
        localTaskId: local.id,
        googleTaskId: remote.id,
        payload: {
          title: local.title,
          notes: local.notes || null,
          status: local.done ? 'completed' : 'needsAction',
          completed: local.done
            ? local.doneAt
              ? new Date(local.doneAt).toISOString()
              : new Date().toISOString()
            : null
        }
      });
    }
  }

  // 2. Processa itens remotos que não têm tarefa local correspondente
  let nextOrder = localTasks.reduce((max, t) => Math.max(max, t.order ?? 0), 0) + 1;

  for (const remote of remoteItems) {
    if (remote.deleted || remote.hidden) continue;
    if (linkedLocalByGoogleId.has(remote.id)) continue;

    const remoteUpdated = new Date(remote.updated).getTime() || Date.now();
    const remoteDone = remote.status === 'completed';
    const cleanRemoteNotes = remote.notes?.trim();

    // Tarefas criadas no Google entram com estimatedPomos = 1
    const newLocal: PomoTask = {
      id: `task-${remoteUpdated}-${Math.random().toString(36).slice(2, 7)}`,
      title: remote.title || 'Sem título',
      estimatedPomos: 1,
      done: remoteDone,
      ...(cleanRemoteNotes ? { notes: cleanRemoteNotes } : {}),
      ...(remoteDone
        ? {
            doneAt: remote.completed
              ? new Date(remote.completed).getTime()
              : remoteUpdated
          }
        : {}),
      createdAt: remoteUpdated,
      updatedAt: remoteUpdated,
      order: nextOrder++,
      google: {
        listId,
        taskId: remote.id,
        updated: remote.updated
      }
    };

    toUpsertLocal.push(newLocal);
  }

  return {
    toUpsertLocal,
    toTombstoneLocal,
    toPushCreateRemote,
    toPushUpdateRemote,
    toDeleteRemote
  };
}

/**
 * Executa a sincronização completa entre o app e uma lista do Google Tasks.
 */
export async function executeTasksSync(opts: {
  listId: string;
  accessToken: string;
  localTasks: PomoTask[];
}): Promise<{
  nextTasks: PomoTask[];
  syncedAt: number;
}> {
  const { listId, accessToken, localTasks } = opts;

  // 1. Busca todas as tarefas da lista no Google
  const remoteItems = await listTasks(accessToken, listId, {
    showDeleted: true,
    showHidden: true
  });

  // 2. Calcula o plano de merge LWW
  const plan = mergeTasks(localTasks, remoteItems, listId);

  // Mapa de trabalho de tarefas locais
  const taskMap = new Map<string, PomoTask>();
  localTasks.forEach((t) => taskMap.set(t.id, { ...t }));

  // 3. Executa push de exclusões para o Google
  await Promise.all(
    plan.toDeleteRemote.map((googleTaskId) =>
      apiDeleteTask(accessToken, listId, googleTaskId).catch((err) =>
        console.warn(`[TasksSync] Falha ao excluir tarefa ${googleTaskId} no Google:`, err)
      )
    )
  );

  // 4. Executa push de criações locais para o Google
  await Promise.all(
    plan.toPushCreateRemote.map(async (item) => {
      try {
        const created = await insertTask(accessToken, listId, item.payload);
        const current = taskMap.get(item.localTaskId);
        if (current) {
          const remoteUpdated = new Date(created.updated).getTime() || Date.now();
          taskMap.set(item.localTaskId, {
            ...current,
            updatedAt: remoteUpdated,
            google: {
              listId,
              taskId: created.id,
              updated: created.updated
            }
          });
        }
      } catch (err) {
        console.error(`[TasksSync] Falha ao criar tarefa ${item.localTaskId} no Google:`, err);
      }
    })
  );

  // 5. Executa push de atualizações para o Google
  await Promise.all(
    plan.toPushUpdateRemote.map(async (item) => {
      try {
        const updated = await patchTask(accessToken, listId, item.googleTaskId, item.payload);
        const current = taskMap.get(item.localTaskId);
        if (current) {
          const remoteUpdated = new Date(updated.updated).getTime() || Date.now();
          taskMap.set(item.localTaskId, {
            ...current,
            updatedAt: remoteUpdated,
            google: {
              listId,
              taskId: updated.id,
              updated: updated.updated
            }
          });
        }
      } catch (err) {
        console.error(`[TasksSync] Falha ao atualizar tarefa ${item.localTaskId} no Google:`, err);
      }
    })
  );

  // 6. Aplica tombstones locais
  for (const taskId of plan.toTombstoneLocal) {
    const current = taskMap.get(taskId);
    if (current) {
      taskMap.set(taskId, {
        ...current,
        deleted: true,
        updatedAt: Date.now()
      });
    }
  }

  // 7. Aplica upserts locais
  for (const task of plan.toUpsertLocal) {
    taskMap.set(task.id, task);
  }

  return {
    nextTasks: Array.from(taskMap.values()),
    syncedAt: Date.now()
  };
}

/**
 * Compara se duas versões de uma tarefa diferem em campos de negócio ou sincronização.
 */
export function isTaskChanged(a: PomoTask, b: PomoTask): boolean {
  if (a.title !== b.title) return true;
  if ((a.notes || undefined) !== (b.notes || undefined)) return true;
  if (a.done !== b.done) return true;
  if (a.doneAt !== b.doneAt) return true;
  if (Boolean(a.deleted) !== Boolean(b.deleted)) return true;
  if (a.estimatedPomos !== b.estimatedPomos) return true;
  if (a.order !== b.order) return true;
  if (a.updatedAt !== b.updatedAt) return true;
  if (a.google?.listId !== b.google?.listId) return true;
  if (a.google?.taskId !== b.google?.taskId) return true;
  if (a.google?.updated !== b.google?.updated) return true;
  return false;
}

function sanitizeUndefined<T extends Record<string, any>>(obj: T): T {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as T;
}

/**
 * Mescla o resultado de uma sincronização do Google Tasks sobre o estado atual em memória,
 * evitando condições de corrida onde edições concorrentes feitas pelo usuário durante
 * as chamadas de rede seriam sobrescritas.
 */
export function applySyncResult(
  currentTasks: PomoTask[],
  syncedTasks: PomoTask[],
  syncStartedAt: number
): {
  mergedTasks: PomoTask[];
  changedTasks: PomoTask[];
} {
  const currentMap = new Map<string, PomoTask>();
  currentTasks.forEach((t) => currentMap.set(t.id, t));

  const syncedMap = new Map<string, PomoTask>();
  syncedTasks.forEach((t) => syncedMap.set(t.id, t));

  const mergedTasks: PomoTask[] = [];
  const changedTasks: PomoTask[] = [];

  // 1. Processa tarefas retornadas pelo sync
  for (const rawSynced of syncedTasks) {
    const synced = sanitizeUndefined(rawSynced);
    const current = currentMap.get(synced.id);

    if (!current) {
      // Nova tarefa criada a partir do Google
      mergedTasks.push(synced);
      changedTasks.push(synced);
      continue;
    }

    // Se a tarefa local foi modificada pelo usuário após o início do sync:
    const localUpdatedAt = current.updatedAt || current.createdAt;
    const editedLocallyDuringSync = localUpdatedAt > syncStartedAt;

    if (editedLocallyDuringSync) {
      // Preserva a versão atual local sem sobrescrever,
      // mas anexa o vínculo google do sync se o local ainda não possuía vínculo
      // (evita que uma tarefa recém-criada no Google perca o ID e seja duplicada no próximo ciclo)
      if (!current.google && synced.google) {
        const preservedWithGoogle: PomoTask = sanitizeUndefined({
          ...current,
          google: synced.google
        });
        mergedTasks.push(preservedWithGoogle);
        changedTasks.push(preservedWithGoogle);
      } else {
        mergedTasks.push(sanitizeUndefined(current));
      }
    } else {
      // Nenhuma alteração concorrente local: adota a versão do sync
      mergedTasks.push(synced);
      if (isTaskChanged(current, synced)) {
        changedTasks.push(synced);
      }
    }
  }

  // 2. Preserva tarefas criadas localmente durante o sync (que não estavam no snapshot inicial)
  for (const current of currentTasks) {
    if (!syncedMap.has(current.id)) {
      mergedTasks.push(sanitizeUndefined(current));
    }
  }

  return { mergedTasks, changedTasks };
}

/**
 * Função pura que identifica tarefas a serem removidas do app (hard delete) ao trocar ou conectar de lista.
 * Retorna todas as tarefas cujo google.listId é diferente da nova lista (`newListId`).
 * Preserva tarefas locais nunca vinculadas (sem `google`) e tarefas já vinculadas à `newListId`.
 */
export function tasksToRemoveOnListSwitch(
  tasks: PomoTask[],
  newListId: string
): PomoTask[] {
  return tasks.filter((t) => Boolean(t.google?.listId && t.google.listId !== newListId));
}

export interface AccountListRef {
  listId: string;
  listTitle: string;
}

export interface ListConflict {
  /** Lista salva na conta (Firestore), que este aparelho adotaria */
  remote: AccountListRef;
  /** Lista que este aparelho usava até agora */
  local: AccountListRef;
  /** Tarefas ativas deste aparelho que sairiam do app ao adotar a lista da conta */
  affectedCount: number;
}

/**
 * Detecta quando adotar a lista da conta descartaria tarefas locais de outra lista.
 * Só há conflito se o aparelho já usava OUTRA lista e ainda tem tarefas ativas vinculadas a ela;
 * sem tarefas afetadas a troca é silenciosa (não há nada a perder).
 */
export function detectListConflict(
  local: AccountListRef | undefined,
  remote: AccountListRef,
  tasks: PomoTask[]
): ListConflict | null {
  if (!local?.listId || local.listId === remote.listId) return null;
  const affectedCount = tasksToRemoveOnListSwitch(tasks, remote.listId).filter((t) => !t.deleted).length;
  if (affectedCount === 0) return null;
  return { remote, local, affectedCount };
}
