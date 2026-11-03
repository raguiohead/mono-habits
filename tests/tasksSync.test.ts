import { describe, it, expect, vi, afterEach } from 'vitest';
import { mergeTasks, executeTasksSync, applySyncResult } from '../src/lib/tasksSync';
import { type PomoTask } from '../src/types/habit';
import { type GoogleTaskItem } from '../src/lib/googleTasksApi';

describe('Motor de sincronização bidirecional do Google Tasks (tasksSync.ts)', () => {
  const LIST_ID = 'test-list-123';

  it('cria tarefa no Google quando criada apenas localmente', () => {
    const localTasks: PomoTask[] = [
      {
        id: 'task-local-1',
        title: 'Estudar TypeScript',
        notes: 'Capítulo sobre tipos utilitários',
        estimatedPomos: 3,
        done: false,
        createdAt: 1000,
        updatedAt: 1000,
        order: 0
      }
    ];
    const remoteItems: GoogleTaskItem[] = [];

    const plan = mergeTasks(localTasks, remoteItems, LIST_ID);

    expect(plan.toPushCreateRemote).toHaveLength(1);
    expect(plan.toPushCreateRemote[0].localTaskId).toBe('task-local-1');
    expect(plan.toPushCreateRemote[0].payload.title).toBe('Estudar TypeScript');
    expect(plan.toPushCreateRemote[0].payload.status).toBe('needsAction');
    expect(plan.toUpsertLocal).toHaveLength(0);
  });

  it('cria tarefa local quando criada no Google, com estimatedPomos = 1', () => {
    const localTasks: PomoTask[] = [];
    const remoteItems: GoogleTaskItem[] = [
      {
        id: 'gtask-remote-1',
        title: 'Comprar café',
        notes: 'Grãos torra média',
        status: 'needsAction',
        updated: '2026-11-02T12:00:00.000Z'
      }
    ];

    const plan = mergeTasks(localTasks, remoteItems, LIST_ID);

    expect(plan.toUpsertLocal).toHaveLength(1);
    const createdLocal = plan.toUpsertLocal[0];
    expect(createdLocal.title).toBe('Comprar café');
    expect(createdLocal.notes).toBe('Grãos torra média');
    expect(createdLocal.estimatedPomos).toBe(1);
    expect(createdLocal.done).toBe(false);
    expect(createdLocal.google).toEqual({
      listId: LIST_ID,
      taskId: 'gtask-remote-1',
      updated: '2026-11-02T12:00:00.000Z'
    });
  });

  it('conflito LWW: atualiza local quando o Google é mais recente, mantendo estimatedPomos e createdAt', () => {
    const localTasks: PomoTask[] = [
      {
        id: 'task-1',
        title: 'Título antigo',
        notes: 'Nota antiga',
        estimatedPomos: 4,
        done: false,
        createdAt: 1000,
        updatedAt: 2000,
        order: 2,
        google: {
          listId: LIST_ID,
          taskId: 'gtask-1',
          updated: '2026-11-02T10:00:00.000Z'
        }
      }
    ];

    const remoteItems: GoogleTaskItem[] = [
      {
        id: 'gtask-1',
        title: 'Título atualizado no Google',
        notes: 'Nota atualizada',
        status: 'completed',
        completed: '2026-11-02T12:30:00.000Z',
        updated: '2026-11-02T12:30:00.000Z' // Mais recente que 2000 ms
      }
    ];

    const plan = mergeTasks(localTasks, remoteItems, LIST_ID);

    expect(plan.toUpsertLocal).toHaveLength(1);
    const updated = plan.toUpsertLocal[0];
    expect(updated.title).toBe('Título atualizado no Google');
    expect(updated.notes).toBe('Nota atualizada');
    expect(updated.done).toBe(true);
    // Preserva estimatedPomos, order e createdAt locais!
    expect(updated.estimatedPomos).toBe(4);
    expect(updated.createdAt).toBe(1000);
    expect(updated.order).toBe(2);
    expect(plan.toPushUpdateRemote).toHaveLength(0);
  });

  it('conflito LWW: atualiza remoto quando o local é mais recente', () => {
    const localTasks: PomoTask[] = [
      {
        id: 'task-1',
        title: 'Título editado no app',
        estimatedPomos: 2,
        done: true,
        doneAt: new Date('2026-11-02T15:00:00.000Z').getTime(),
        createdAt: 1000,
        updatedAt: new Date('2026-11-02T15:00:00.000Z').getTime(), // Mais recente que 2026-11-01
        order: 0,
        google: {
          listId: LIST_ID,
          taskId: 'gtask-1',
          updated: '2026-11-01T00:00:00.000Z'
        }
      }
    ];

    const remoteItems: GoogleTaskItem[] = [
      {
        id: 'gtask-1',
        title: 'Título desatualizado',
        status: 'needsAction',
        updated: '2026-11-01T00:00:00.000Z'
      }
    ];

    const plan = mergeTasks(localTasks, remoteItems, LIST_ID);

    expect(plan.toPushUpdateRemote).toHaveLength(1);
    expect(plan.toPushUpdateRemote[0].googleTaskId).toBe('gtask-1');
    expect(plan.toPushUpdateRemote[0].payload.title).toBe('Título editado no app');
    expect(plan.toPushUpdateRemote[0].payload.status).toBe('completed');
    expect(plan.toUpsertLocal).toHaveLength(0);
  });

  it('exclusão local propaga para o Google', () => {
    const localTasks: PomoTask[] = [
      {
        id: 'task-1',
        title: 'Deletada no app',
        estimatedPomos: 1,
        done: false,
        deleted: true,
        createdAt: 1000,
        updatedAt: 3000,
        order: 0,
        google: {
          listId: LIST_ID,
          taskId: 'gtask-1',
          updated: '2026-11-02T10:00:00.000Z'
        }
      }
    ];

    const remoteItems: GoogleTaskItem[] = [
      {
        id: 'gtask-1',
        title: 'Deletada no app',
        status: 'needsAction',
        updated: '2026-11-02T10:00:00.000Z'
      }
    ];

    const plan = mergeTasks(localTasks, remoteItems, LIST_ID);

    expect(plan.toDeleteRemote).toEqual(['gtask-1']);
  });

  it('exclusão no Google gera tombstone local', () => {
    const localTasks: PomoTask[] = [
      {
        id: 'task-1',
        title: 'Ativa no app mas deletada no Google',
        estimatedPomos: 1,
        done: false,
        createdAt: 1000,
        updatedAt: 1000,
        order: 0,
        google: {
          listId: LIST_ID,
          taskId: 'gtask-1',
          updated: '2026-11-02T10:00:00.000Z'
        }
      }
    ];

    const remoteItems: GoogleTaskItem[] = [
      {
        id: 'gtask-1',
        title: 'Ativa no app mas deletada no Google',
        status: 'needsAction',
        deleted: true,
        updated: '2026-11-02T11:00:00.000Z'
      }
    ];

    const plan = mergeTasks(localTasks, remoteItems, LIST_ID);

    expect(plan.toTombstoneLocal).toEqual(['task-1']);
  });

  it('tarefa concluída limpa no Google (hidden && status completed) é mantida como concluída localmente e tem vínculo removido sem tombstone', () => {
    const localTasks: PomoTask[] = [
      {
        id: 'task-1',
        title: 'Tarefa concluída e limpa',
        estimatedPomos: 2,
        done: true,
        doneAt: 1000,
        createdAt: 500,
        updatedAt: 1000,
        order: 0,
        google: {
          listId: LIST_ID,
          taskId: 'gtask-1',
          updated: '2026-11-02T10:00:00.000Z'
        }
      }
    ];

    const remoteItems: GoogleTaskItem[] = [
      {
        id: 'gtask-1',
        title: 'Tarefa concluída e limpa',
        status: 'completed',
        hidden: true,
        updated: '2026-11-02T11:00:00.000Z'
      }
    ];

    const plan = mergeTasks(localTasks, remoteItems, LIST_ID);

    // Não deve virar tombstone local!
    expect(plan.toTombstoneLocal).toHaveLength(0);
    // Deve ser atualizada localmente mantendo done: true e desvinculando o google
    expect(plan.toUpsertLocal).toHaveLength(1);
    const updated = plan.toUpsertLocal[0];
    expect(updated.id).toBe('task-1');
    expect(updated.done).toBe(true);
    expect(updated.google).toBeUndefined();
  });

  it('apenas remote.deleted: true vira tombstone local', () => {
    const localTasks: PomoTask[] = [
      {
        id: 'task-1',
        title: 'Tarefa deletada',
        estimatedPomos: 1,
        done: false,
        createdAt: 500,
        updatedAt: 1000,
        order: 0,
        google: {
          listId: LIST_ID,
          taskId: 'gtask-1',
          updated: '2026-11-02T10:00:00.000Z'
        }
      }
    ];

    const remoteItems: GoogleTaskItem[] = [
      {
        id: 'gtask-1',
        title: 'Tarefa deletada',
        status: 'needsAction',
        deleted: true,
        updated: '2026-11-02T11:00:00.000Z'
      }
    ];

    const plan = mergeTasks(localTasks, remoteItems, LIST_ID);
    expect(plan.toTombstoneLocal).toEqual(['task-1']);
    expect(plan.toUpsertLocal).toHaveLength(0);
  });
});

describe('executeTasksSync e alinhamento de updatedAt (anti ping-pong)', () => {
  const LIST_ID = 'test-list-123';
  const ACCESS_TOKEN = 'mock-access-token';
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('alinha local.updatedAt com created.updated retornado pelo Google após insertTask', async () => {
    const googleTimestamp = '2026-11-02T18:00:00.000Z';
    const localTasks: PomoTask[] = [
      {
        id: 'local-1',
        title: 'Nova tarefa local',
        estimatedPomos: 2,
        done: false,
        createdAt: 1000,
        updatedAt: 1000,
        order: 0
      }
    ];

    globalThis.fetch = vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/tasks?')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ items: [] })
        };
      }
      if (opts?.method === 'POST') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'gtask-new',
            title: 'Nova tarefa local',
            status: 'needsAction',
            updated: googleTimestamp
          })
        };
      }
      return { ok: false, status: 404 };
    });

    const result = await executeTasksSync({
      listId: LIST_ID,
      accessToken: ACCESS_TOKEN,
      localTasks
    });

    expect(result.nextTasks).toHaveLength(1);
    const synced = result.nextTasks[0];
    expect(synced.id).toBe('local-1');
    expect(synced.google).toEqual({
      listId: LIST_ID,
      taskId: 'gtask-new',
      updated: googleTimestamp
    });
    expect(synced.updatedAt).toBe(new Date(googleTimestamp).getTime());
  });

  it('alinha local.updatedAt com updated.updated retornado pelo Google após patchTask', async () => {
    const googleTimestamp = '2026-11-02T19:00:00.000Z';
    const localTasks: PomoTask[] = [
      {
        id: 'local-1',
        title: 'Tarefa editada localmente',
        estimatedPomos: 2,
        done: true,
        doneAt: new Date('2026-11-02T16:00:00.000Z').getTime(),
        createdAt: 1000,
        updatedAt: new Date('2026-11-02T16:00:00.000Z').getTime(),
        order: 0,
        google: {
          listId: LIST_ID,
          taskId: 'gtask-1',
          updated: '2026-11-01T00:00:00.000Z'
        }
      }
    ];

    globalThis.fetch = vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/tasks?')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: 'gtask-1',
                title: 'Título antigo',
                status: 'needsAction',
                updated: '2026-11-01T00:00:00.000Z'
              }
            ]
          })
        };
      }
      if (opts?.method === 'PATCH') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'gtask-1',
            title: 'Tarefa editada localmente',
            status: 'completed',
            updated: googleTimestamp
          })
        };
      }
      return { ok: false, status: 404 };
    });

    const result = await executeTasksSync({
      listId: LIST_ID,
      accessToken: ACCESS_TOKEN,
      localTasks
    });

    expect(result.nextTasks).toHaveLength(1);
    const synced = result.nextTasks[0];
    expect(synced.id).toBe('local-1');
    expect(synced.updatedAt).toBe(new Date(googleTimestamp).getTime());
    expect(synced.google?.updated).toBe(googleTimestamp);
  });
});

describe('applySyncResult (prevenção de condição de corrida)', () => {
  it('preserva edição local concorrente feita durante as chamadas de rede do sync', () => {
    const syncStartedAt = 10000;

    const currentTasks: PomoTask[] = [
      {
        id: 'task-1',
        title: 'Título editado pelo usuário durante o sync',
        estimatedPomos: 3,
        done: false,
        createdAt: 1000,
        updatedAt: 12000, // Maior que syncStartedAt (edição concorrente)
        order: 0,
        google: {
          listId: 'l-1',
          taskId: 'g-1',
          updated: '2026-11-02T10:00:00.000Z'
        }
      }
    ];

    const syncedTasks: PomoTask[] = [
      {
        id: 'task-1',
        title: 'Título antigo vindo do snapshot do sync',
        estimatedPomos: 1,
        done: false,
        createdAt: 1000,
        updatedAt: 9000,
        order: 0,
        google: {
          listId: 'l-1',
          taskId: 'g-1',
          updated: '2026-11-02T10:00:00.000Z'
        }
      }
    ];

    const { mergedTasks, changedTasks } = applySyncResult(currentTasks, syncedTasks, syncStartedAt);

    expect(mergedTasks).toHaveLength(1);
    expect(mergedTasks[0].title).toBe('Título editado pelo usuário durante o sync');
    expect(mergedTasks[0].estimatedPomos).toBe(3);
    expect(mergedTasks[0].updatedAt).toBe(12000);
    expect(changedTasks).toHaveLength(0);
  });

  it('preserva tarefas novas criadas localmente durante o sync', () => {
    const syncStartedAt = 10000;

    const currentTasks: PomoTask[] = [
      {
        id: 'task-nova-local',
        title: 'Criada enquanto o sync rodava',
        estimatedPomos: 1,
        done: false,
        createdAt: 11000,
        updatedAt: 11000,
        order: 1
      }
    ];

    const syncedTasks: PomoTask[] = [];

    const { mergedTasks } = applySyncResult(currentTasks, syncedTasks, syncStartedAt);

    expect(mergedTasks).toHaveLength(1);
    expect(mergedTasks[0].id).toBe('task-nova-local');
  });

  it('adota versão do sync e registra em changedTasks quando não houve conflito concorrente', () => {
    const syncStartedAt = 10000;

    const currentTasks: PomoTask[] = [
      {
        id: 'task-1',
        title: 'Título antigo',
        estimatedPomos: 2,
        done: false,
        createdAt: 1000,
        updatedAt: 8000, // Menor que syncStartedAt
        order: 0
      }
    ];

    const syncedTasks: PomoTask[] = [
      {
        id: 'task-1',
        title: 'Título atualizado no Google',
        estimatedPomos: 2,
        done: true,
        doneAt: 9500,
        createdAt: 1000,
        updatedAt: 9500,
        order: 0,
        google: {
          listId: 'l-1',
          taskId: 'g-1',
          updated: '2026-11-02T11:00:00.000Z'
        }
      }
    ];

    const { mergedTasks, changedTasks } = applySyncResult(currentTasks, syncedTasks, syncStartedAt);

    expect(mergedTasks).toHaveLength(1);
    expect(mergedTasks[0].title).toBe('Título atualizado no Google');
    expect(mergedTasks[0].done).toBe(true);
    expect(changedTasks).toHaveLength(1);
    expect(changedTasks[0].id).toBe('task-1');
  });

  it('inclui nova tarefa criada no Google e a reporta em changedTasks para persistência', () => {
    const syncStartedAt = 10000;

    const currentTasks: PomoTask[] = [];

    const syncedTasks: PomoTask[] = [
      {
        id: 'task-remota-1',
        title: 'Criada no Google Tasks Web',
        estimatedPomos: 1,
        done: false,
        createdAt: 9000,
        updatedAt: 9000,
        order: 0,
        google: {
          listId: 'l-1',
          taskId: 'g-remota',
          updated: '2026-11-02T11:00:00.000Z'
        }
      }
    ];

    const { mergedTasks, changedTasks } = applySyncResult(currentTasks, syncedTasks, syncStartedAt);

    expect(mergedTasks).toHaveLength(1);
    expect(mergedTasks[0].id).toBe('task-remota-1');
    expect(changedTasks).toHaveLength(1);
    expect(changedTasks[0].id).toBe('task-remota-1');
  });

  it('copia o campo google para tarefa editada localmente durante o sync se ela ainda não tinha vínculo, evitando duplicação', () => {
    const syncStartedAt = 10000;

    // Tarefa criada localmente sem google antes do sync, editada concorrentemente durante o sync
    const currentTasks: PomoTask[] = [
      {
        id: 'task-1',
        title: 'Título atualizado localmente enquanto sincronizava',
        estimatedPomos: 4,
        done: false,
        createdAt: 5000,
        updatedAt: 12000, // Editada durante o sync (12000 > 10000)
        order: 0
      }
    ];

    // O sync executou insertTask no Google e retornou o vínculo gerado
    const syncedTasks: PomoTask[] = [
      {
        id: 'task-1',
        title: 'Título antigo',
        estimatedPomos: 2,
        done: false,
        createdAt: 5000,
        updatedAt: 10500,
        order: 0,
        google: {
          listId: 'l-1',
          taskId: 'gtask-recem-criada',
          updated: '2026-11-02T12:00:00.000Z'
        }
      }
    ];

    const { mergedTasks, changedTasks } = applySyncResult(currentTasks, syncedTasks, syncStartedAt);

    expect(mergedTasks).toHaveLength(1);
    const merged = mergedTasks[0];
    // Preserva a edição local:
    expect(merged.title).toBe('Título atualizado localmente enquanto sincronizava');
    expect(merged.estimatedPomos).toBe(4);
    expect(merged.updatedAt).toBe(12000);
    // Mas recebe o vínculo google gerado pelo sync:
    expect(merged.google).toEqual({
      listId: 'l-1',
      taskId: 'gtask-recem-criada',
      updated: '2026-11-02T12:00:00.000Z'
    });
    // Deve ser incluída em changedTasks para persistir o novo vínculo google:
    expect(changedTasks).toHaveLength(1);
    expect(changedTasks[0].id).toBe('task-1');
    expect(changedTasks[0].google?.taskId).toBe('gtask-recem-criada');
  });

  it('retorna mergedTasks com todas as tarefas locais intactas de forma síncrona sem risco de apagar o storage', () => {
    const syncStartedAt = 10000;

    const currentTasks: PomoTask[] = [
      {
        id: 'task-1',
        title: 'Tarefa Existente 1',
        estimatedPomos: 2,
        done: false,
        createdAt: 5000,
        updatedAt: 5000,
        order: 0
      },
      {
        id: 'task-2',
        title: 'Tarefa Existente 2',
        estimatedPomos: 1,
        done: true,
        doneAt: 6000,
        createdAt: 4000,
        updatedAt: 6000,
        order: 1
      }
    ];

    const syncedTasks: PomoTask[] = currentTasks.map((t) => ({ ...t }));

    const { mergedTasks, changedTasks } = applySyncResult(currentTasks, syncedTasks, syncStartedAt);

    expect(mergedTasks).toHaveLength(2);
    expect(mergedTasks.map((t) => t.id)).toEqual(['task-1', 'task-2']);
    // Nenhuma mudança em relação ao estado inicial -> changedTasks vazio (sem escritas no Firestore)
    expect(changedTasks).toHaveLength(0);
  });

  it('não gera nenhuma chave com valor undefined ao importar do Google Tasks uma tarefa sem notas ou não concluída', () => {
    const listId = 'test-list-123';
    const localTasks: PomoTask[] = [];
    const remoteItems: GoogleTaskItem[] = [
      {
        id: 'gtask-no-notes',
        title: 'Tarefa vinda do Google sem notas',
        status: 'needsAction',
        updated: '2026-11-02T15:00:00.000Z'
      }
    ];

    const plan = mergeTasks(localTasks, remoteItems, listId);
    expect(plan.toUpsertLocal).toHaveLength(1);
    const importedTask = plan.toUpsertLocal[0];

    expect('notes' in importedTask).toBe(false);
    expect('doneAt' in importedTask).toBe(false);
    expect(Object.values(importedTask)).not.toContain(undefined);

    const { mergedTasks, changedTasks } = applySyncResult(localTasks, plan.toUpsertLocal, Date.now());
    expect(mergedTasks).toHaveLength(1);
    expect(Object.values(mergedTasks[0])).not.toContain(undefined);
    expect('notes' in mergedTasks[0]).toBe(false);
    expect('doneAt' in mergedTasks[0]).toBe(false);
    expect('notes' in changedTasks[0]).toBe(false);
  });
});
