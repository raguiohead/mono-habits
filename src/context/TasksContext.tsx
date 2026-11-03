import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { type PomoTask } from '@/types/habit';
import { loadLocalTasks, saveLocalTasks } from '@/lib/storage';
import {
  createPomoTask,
  normalizeTask,
  toFirestoreTask,
  MIN_TASK_POMOS,
  MAX_TASK_POMOS,
  DEFAULT_TASK_POMOS,
  getLinkableTasks
} from '@/lib/tasks';
import { useHabits } from '@/context/HabitsContext';
import { useSettings } from '@/context/SettingsContext';
import {
  canSyncInBackground,
  getTasksToken,
  clearTasksToken,
  formatGoogleTasksError
} from '@/lib/googleTasksAuth';
import {
  executeTasksSync,
  applySyncResult,
  tasksToRemoveOnListSwitch
} from '@/lib/tasksSync';
import {
  db,
  appId,
  isFirebaseConfigured,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot
} from '@/lib/firebase';

interface TasksContextType {
  /** Todas as tarefas não deletadas */
  tasks: PomoTask[];
  /** Tarefas ativas (não concluídas e não deletadas), ordenadas */
  activeTasks: PomoTask[];
  /** Tarefas concluídas (não deletadas), ordenadas pela conclusão mais recente */
  completedTasks: PomoTask[];
  /** Tarefas disponíveis para vincular ao timer Pomo */
  linkableTasks: PomoTask[];
  /** Cria uma nova tarefa com estimativa de pomos */
  createTask: (title: string, estimatedPomos?: number, notes?: string) => Promise<PomoTask>;
  /** Salva alterações completas em uma tarefa */
  saveTask: (task: PomoTask) => Promise<void>;
  /** Atualiza campos parciais da tarefa (título, notas, estimativa) */
  updateTask: (
    taskId: string,
    updates: Partial<Pick<PomoTask, 'title' | 'notes' | 'estimatedPomos'>>
  ) => Promise<void>;
  /** Exclui tarefa (tombstone com deleted: true para sincronização) */
  deleteTask: (taskId: string) => Promise<void>;
  /** Alterna o status concluído/pendente da tarefa */
  toggleTaskDone: (taskId: string) => Promise<void>;
  /** Reordena a lista de tarefas ativas */
  reorderTasks: (orderedTaskIds: string[]) => Promise<void>;
  /** Incrementa a estimativa de pomos de uma tarefa (+1 pomo) */
  incrementTaskEstimate: (taskId: string, delta?: number) => Promise<void>;
  /** Obtém todas as tarefas, incluindo tombstones (para o motor de sync) */
  getAllTasksWithDeleted: () => PomoTask[];
  /** Sincronização em andamento com o Google Tasks */
  isSyncingGoogle: boolean;
  /** Mensagem de erro ao sincronizar com Google Tasks (ou null) */
  googleSyncError: string | null;
  /** Executa sincronização bidirecional com o Google Tasks */
  syncWithGoogle: (opts?: { interactive?: boolean }) => Promise<boolean>;
  /** Conecta uma lista do Google Tasks */
  connectGoogleTasks: (listId: string, listTitle: string) => Promise<void>;
  /** Desconecta do Google Tasks e remove a lista */
  disconnectGoogleTasks: () => Promise<void>;
}

const TasksContext = createContext<TasksContextType | undefined>(undefined);

export const TasksProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, showToast } = useHabits();
  const { settings, updateSettings } = useSettings();
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [rawTasks, setRawTasks] = useState<PomoTask[]>(() => loadLocalTasks());
  const rawTasksRef = useRef<PomoTask[]>(rawTasks);
  rawTasksRef.current = rawTasks;

  const [isSyncingGoogle, setIsSyncingGoogle] = useState(false);
  const isSyncingGoogleRef = useRef(false);
  const [googleSyncError, setGoogleSyncError] = useState<string | null>(null);
  const debounceTimerRef = useRef<number | null>(null);

  const initialSyncedRef = useRef(false);

  // Sincronização com o Google Tasks
  const syncWithGoogle = useCallback(
    async (opts?: { interactive?: boolean }): Promise<boolean> => {
      const config = settings.googleTasks;
      if (!config?.listId) return false;

      // Evita dois syncs simultâneos concorrentes
      if (isSyncingGoogleRef.current) return false;
      isSyncingGoogleRef.current = true;
      setIsSyncingGoogle(true);
      setGoogleSyncError(null);

      try {
        const token = await getTasksToken({ interactive: opts?.interactive ?? false });
        const syncStartedAt = Date.now();
        const { nextTasks, syncedAt } = await executeTasksSync({
          listId: config.listId,
          accessToken: token,
          localTasks: rawTasksRef.current
        });

        const { mergedTasks, changedTasks } = applySyncResult(
          rawTasksRef.current,
          nextTasks,
          syncStartedAt
        );

        rawTasksRef.current = mergedTasks;
        setRawTasks(mergedTasks);
        saveLocalTasks(mergedTasks);

        // Grava no Firestore apenas as tarefas que sofreram mutação no sync
        if (user && db && isFirebaseConfigured && changedTasks.length > 0) {
          await Promise.all(
            changedTasks.map((t) => {
              const taskRef = doc(db!, 'artifacts', appId, 'users', user.uid, 'tasks', t.id);
              return setDoc(taskRef, toFirestoreTask(t));
            })
          );
        }

        updateSettings({
          googleTasks: {
            ...config,
            lastSyncAt: syncedAt
          }
        });

        return true;
      } catch (err: any) {
        console.warn('[TasksContext] Erro ao sincronizar com Google Tasks:', err);
        const msg = formatGoogleTasksError(err) || 'Falha na sincronização com o Google Tasks.';
        setGoogleSyncError(msg);
        return false;
      } finally {
        isSyncingGoogleRef.current = false;
        setIsSyncingGoogle(false);
      }
    },
    [settings.googleTasks, user, updateSettings]
  );

  const triggerDebouncedGoogleSync = useCallback(() => {
    if (!settings.googleTasks?.listId || !canSyncInBackground()) return;
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      void syncWithGoogle({ interactive: false });
    }, 5000);
  }, [settings.googleTasks?.listId, syncWithGoogle]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const connectGoogleTasks = useCallback(
    async (listId: string, listTitle: string) => {
      // 1. Remove tarefas vinculadas a outra lista imediatamente (hard delete)
      const toRemove = tasksToRemoveOnListSwitch(rawTasksRef.current, listId);
      if (toRemove.length > 0) {
        const toRemoveIds = new Set(toRemove.map((t) => t.id));
        setRawTasks((prev) => {
          const next = prev.filter((t) => !toRemoveIds.has(t.id));
          saveLocalTasks(next);
          return next;
        });
      }

      // 2. Com login: Firestore é a fonte da verdade do prefs/googleTasks e executa deleteDoc das tarefas antigas
      if (user && db && isFirebaseConfigured) {
        const activeDb = db;
        // Hard delete no Firestore (nunca tombstone)
        await Promise.all(
          toRemove.map((t) => {
            const taskRef = doc(activeDb, 'artifacts', appId, 'users', user.uid, 'tasks', t.id);
            return deleteDoc(taskRef).catch((err) =>
              console.warn(`[Firestore] Falha ao excluir tarefa antiga ${t.id}:`, err)
            );
          })
        );

        const prefRef = doc(activeDb, 'artifacts', appId, 'users', user.uid, 'prefs', 'googleTasks');
        await setDoc(prefRef, {
          listId,
          listTitle,
          updatedAt: Date.now()
        }).catch((err) =>
          console.error('[Firestore] Falha ao salvar doc prefs/googleTasks:', err)
        );

        localStorage.setItem(`mono_gt_migrated_${user.uid}`, '1');
      }

      // 3. Atualiza cache local
      updateSettings({
        googleTasks: {
          listId,
          listTitle
        }
      });

      // 4. Dispara sincronização com a nova lista
      setTimeout(() => {
        void syncWithGoogle({ interactive: false });
      }, 100);
    },
    [user, updateSettings, syncWithGoogle]
  );

  const disconnectGoogleTasks = useCallback(async () => {
    clearTasksToken();
    setGoogleSyncError(null);

    // Se autenticado, remove a preferência no Firestore
    if (user && db && isFirebaseConfigured) {
      const activeDb = db;
      const prefRef = doc(activeDb, 'artifacts', appId, 'users', user.uid, 'prefs', 'googleTasks');
      await deleteDoc(prefRef).catch((err) =>
        console.warn('[Firestore] Falha ao excluir doc prefs/googleTasks:', err)
      );
      localStorage.setItem(`mono_gt_migrated_${user.uid}`, '1');
    }

    // Não remove tarefas nem vínculos locais: apenas para de sincronizar
    updateSettings({ googleTasks: undefined });
    showToast('Google Tasks desconectado.');
  }, [user, updateSettings, showToast]);

  // Sincronização em tempo real das preferências da conta (prefs/googleTasks) via Firestore
  useEffect(() => {
    if (!user || !db || !isFirebaseConfigured) return;

    const activeDb = db;
    const prefRef = doc(activeDb, 'artifacts', appId, 'users', user.uid, 'prefs', 'googleTasks');

    const unsub = onSnapshot(
      prefRef,
      (snapshot) => {
        const migrationKey = `mono_gt_migrated_${user.uid}`;
        const hasMigrated = localStorage.getItem(migrationKey) === '1';

        if (snapshot.exists()) {
          localStorage.setItem(migrationKey, '1');
          const data = snapshot.data();
          const remoteListId =
            typeof data?.listId === 'string' ? data.listId.trim().slice(0, 100) : '';
          const remoteListTitle =
            typeof data?.listTitle === 'string' ? data.listTitle.trim().slice(0, 100) : '';

          if (remoteListId && remoteListTitle) {
            const currentConfig = settingsRef.current.googleTasks;
            const isSameList = currentConfig?.listId === remoteListId;

            updateSettings({
              googleTasks: {
                listId: remoteListId,
                listTitle: remoteListTitle,
                lastSyncAt: isSameList ? currentConfig?.lastSyncAt : undefined
              }
            });

            // Limpeza local: garante que tarefas de outra lista sejam expurgadas
            // (as deleções no Firestore já chegam pelo snapshot de tasks, mas garante que o estado local não reenvie nada)
            const toRemove = tasksToRemoveOnListSwitch(rawTasksRef.current, remoteListId);
            if (toRemove.length > 0) {
              const toRemoveIds = new Set(toRemove.map((t) => t.id));
              setRawTasks((prev) => {
                const next = prev.filter((t) => !toRemoveIds.has(t.id));
                saveLocalTasks(next);
                return next;
              });

              toRemove.forEach((t) => {
                const taskRef = doc(activeDb, 'artifacts', appId, 'users', user.uid, 'tasks', t.id);
                deleteDoc(taskRef).catch(() => {});
              });
            }
          }
        } else {
          // Documento não existe no Firestore
          if (!hasMigrated) {
            // Migração: se o doc não existe e há settings.googleTasks local, grava no Firestore uma vez
            localStorage.setItem(migrationKey, '1');
            const localConfig = settingsRef.current.googleTasks;
            if (localConfig?.listId && localConfig?.listTitle) {
              setDoc(prefRef, {
                listId: localConfig.listId.slice(0, 100),
                listTitle: localConfig.listTitle.slice(0, 100),
                updatedAt: Date.now()
              }).catch((err) =>
                console.warn('[Firestore] Falha ao migrar pref googleTasks local:', err)
              );
              return;
            }
          }

          // Se já migrou ou não há lista local, a conta está sem lista conectada
          if (settingsRef.current.googleTasks) {
            updateSettings({ googleTasks: undefined });
          }
        }
      },
      (error) => {
        console.warn('[Firestore] Erro ao sincronizar prefs/googleTasks:', error);
      }
    );

    return () => {
      unsub();
    };
  }, [user, updateSettings]);

  // Sincronização em tempo real das tarefas via Firestore
  useEffect(() => {
    if (!user || !db || !isFirebaseConfigured) {
      initialSyncedRef.current = false;
      const local = loadLocalTasks();
      setRawTasks(local);
      return;
    }

    const activeDb = db;
    const tasksCol = collection(activeDb, 'artifacts', appId, 'users', user.uid, 'tasks');

    const unsub = onSnapshot(
      tasksCol,
      (snapshot) => {
        const remoteTasks: PomoTask[] = [];
        snapshot.forEach((snap) => {
          const normalized = normalizeTask({ id: snap.id, ...snap.data() });
          if (normalized) {
            remoteTasks.push(normalized);
          }
        });

        // Identifica IDs removidos no Firestore (via deleteDoc)
        const removedRemoteIds = new Set<string>();
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'removed') {
            removedRemoteIds.add(change.doc.id);
          }
        });

        // Migração inicial: se a nuvem não tiver nenhuma tarefa e existirem tarefas locais offline
        if (!initialSyncedRef.current) {
          initialSyncedRef.current = true;
          const localTasks = rawTasksRef.current;
          if (remoteTasks.length === 0 && localTasks.length > 0) {
            localTasks.forEach((t) => {
              const taskRef = doc(activeDb, 'artifacts', appId, 'users', user.uid, 'tasks', t.id);
              setDoc(taskRef, toFirestoreTask(t)).catch((err) =>
                console.warn('[Firestore] Falha ao migrar tarefa local para nuvem:', err)
              );
            });
            return;
          }
        }

        // Reconciliação com merge LWW para evitar regressão se houver writes pendentes
        setRawTasks((current) => {
          const map = new Map<string, PomoTask>();
          const activeListId = settingsRef.current.googleTasks?.listId;

          for (const item of current) {
            // Ignora tarefas que foram excluídas com deleteDoc no Firestore
            if (removedRemoteIds.has(item.id)) {
              continue;
            }
            // Ignora tarefas vinculadas a outra lista
            if (item.google?.listId && activeListId && item.google.listId !== activeListId) {
              continue;
            }
            map.set(item.id, item);
          }
          for (const remote of remoteTasks) {
            // Ignora tarefas remotas vinculadas a outra lista
            if (remote.google?.listId && activeListId && remote.google.listId !== activeListId) {
              continue;
            }
            const local = map.get(remote.id);
            if (!local || (remote.updatedAt ?? 0) >= (local.updatedAt ?? 0)) {
              map.set(remote.id, remote);
            }
          }
          const merged = Array.from(map.values());
          saveLocalTasks(merged);
          return merged;
        });
      },
      (error) => {
        console.warn('[Firestore] Erro ao carregar tarefas:', error);
      }
    );

    return () => {
      unsub();
    };
  }, [user]);

  // Persiste a lista e propaga para nuvem se autenticado
  const persistAndSyncTask = useCallback(
    async (task: PomoTask) => {
      setRawTasks((prev) => {
        const next = [...prev.filter((t) => t.id !== task.id), task];
        saveLocalTasks(next);
        return next;
      });

      if (user && db && isFirebaseConfigured) {
        try {
          const taskRef = doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', task.id);
          await setDoc(taskRef, toFirestoreTask(task));
        } catch (err) {
          console.error('[Firestore] Falha ao salvar tarefa:', err);
        }
      }

      triggerDebouncedGoogleSync();
    },
    [user, triggerDebouncedGoogleSync]
  );

  const createTask = useCallback(
    async (title: string, estimatedPomos = DEFAULT_TASK_POMOS, notes?: string): Promise<PomoTask> => {
      const active = rawTasksRef.current.filter((t) => !t.deleted && !t.done);
      const maxOrder = active.reduce((max, t) => Math.max(max, t.order ?? 0), -1);
      const newTask = createPomoTask({
        title,
        estimatedPomos,
        notes,
        order: maxOrder + 1
      });

      await persistAndSyncTask(newTask);
      showToast('Tarefa criada.');
      return newTask;
    },
    [persistAndSyncTask, showToast]
  );

  const saveTask = useCallback(
    async (task: PomoTask) => {
      const updated: PomoTask = {
        ...task,
        updatedAt: Date.now()
      };
      await persistAndSyncTask(updated);
    },
    [persistAndSyncTask]
  );

  const updateTask = useCallback(
    async (
      taskId: string,
      updates: Partial<Pick<PomoTask, 'title' | 'notes' | 'estimatedPomos'>>
    ) => {
      const existing = rawTasksRef.current.find((t) => t.id === taskId);
      if (!existing) return;

      const cleanNotes = updates.notes !== undefined ? updates.notes.trim().slice(0, 1000) : undefined;
      const { notes: _prevNotes, ...baseExisting } = existing;
      const updated: PomoTask = {
        ...baseExisting,
        ...(updates.title !== undefined ? { title: updates.title.trim().slice(0, 200) } : {}),
        ...(updates.notes !== undefined
          ? cleanNotes
            ? { notes: cleanNotes }
            : {}
          : existing.notes
            ? { notes: existing.notes }
            : {}),
        ...(updates.estimatedPomos !== undefined
          ? {
              estimatedPomos: Math.min(
                MAX_TASK_POMOS,
                Math.max(MIN_TASK_POMOS, Math.round(updates.estimatedPomos))
              )
            }
          : {}),
        updatedAt: Date.now()
      };

      await persistAndSyncTask(updated);
      showToast('Tarefa atualizada.');
    },
    [persistAndSyncTask, showToast]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      const existing = rawTasksRef.current.find((t) => t.id === taskId);
      if (!existing) return;

      const tombstone: PomoTask = {
        ...existing,
        deleted: true,
        updatedAt: Date.now()
      };

      await persistAndSyncTask(tombstone);
      showToast('Tarefa excluída.');
    },
    [persistAndSyncTask, showToast]
  );

  const toggleTaskDone = useCallback(
    async (taskId: string) => {
      const existing = rawTasksRef.current.find((t) => t.id === taskId);
      if (!existing) return;

      const nextDone = !existing.done;
      const now = Date.now();
      const { doneAt: _prevDoneAt, ...baseExisting } = existing;
      const updated: PomoTask = {
        ...baseExisting,
        done: nextDone,
        ...(nextDone ? { doneAt: now } : {}),
        updatedAt: now
      };

      await persistAndSyncTask(updated);
      showToast(nextDone ? 'Tarefa concluída!' : 'Tarefa reaberta.');
    },
    [persistAndSyncTask, showToast]
  );

  const reorderTasks = useCallback(
    async (orderedTaskIds: string[]) => {
      const now = Date.now();
      const idToOrder = new Map<string, number>();
      orderedTaskIds.forEach((id, idx) => idToOrder.set(id, idx));

      const updatedTasks: PomoTask[] = [];

      setRawTasks((prev) => {
        const next = prev.map((t) => {
          if (idToOrder.has(t.id)) {
            const nextT: PomoTask = {
              ...t,
              order: idToOrder.get(t.id)!,
              updatedAt: now
            };
            updatedTasks.push(nextT);
            return nextT;
          }
          return t;
        });
        saveLocalTasks(next);
        return next;
      });

      if (user && db && isFirebaseConfigured) {
        try {
          await Promise.all(
            updatedTasks.map((t) => {
              const taskRef = doc(db!, 'artifacts', appId, 'users', user.uid, 'tasks', t.id);
              return setDoc(taskRef, toFirestoreTask(t));
            })
          );
        } catch (err) {
          console.error('[Firestore] Falha ao reordenar tarefas:', err);
        }
      }
    },
    [user]
  );

  const incrementTaskEstimate = useCallback(
    async (taskId: string, delta = 1) => {
      const existing = rawTasksRef.current.find((t) => t.id === taskId);
      if (!existing) return;

      const nextEstimate = Math.min(MAX_TASK_POMOS, existing.estimatedPomos + delta);
      if (nextEstimate === existing.estimatedPomos) return;

      const updated: PomoTask = {
        ...existing,
        estimatedPomos: nextEstimate,
        updatedAt: Date.now()
      };

      await persistAndSyncTask(updated);
      showToast(`+${delta} pomo adicionado à estimativa.`);
    },
    [persistAndSyncTask, showToast]
  );

  const getAllTasksWithDeleted = useCallback(() => rawTasksRef.current, []);

  // Tarefas não deletadas
  const tasks = useMemo(() => rawTasks.filter((t) => !t.deleted), [rawTasks]);

  // Tarefas ativas ordenadas
  const activeTasks = useMemo(
    () =>
      tasks
        .filter((t) => !t.done)
        .sort((a, b) => {
          if (a.order !== b.order) return a.order - b.order;
          return a.createdAt - b.createdAt;
        }),
    [tasks]
  );

  // Tarefas concluídas ordenadas por término mais recente
  const completedTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.done)
        .sort((a, b) => (b.doneAt ?? b.updatedAt) - (a.doneAt ?? a.updatedAt)),
    [tasks]
  );

  const linkableTasks = useMemo(() => getLinkableTasks(tasks), [tasks]);

  const value = useMemo(
    () => ({
      tasks,
      activeTasks,
      completedTasks,
      linkableTasks,
      createTask,
      saveTask,
      updateTask,
      deleteTask,
      toggleTaskDone,
      reorderTasks,
      incrementTaskEstimate,
      getAllTasksWithDeleted,
      isSyncingGoogle,
      googleSyncError,
      syncWithGoogle,
      connectGoogleTasks,
      disconnectGoogleTasks
    }),
    [
      tasks,
      activeTasks,
      completedTasks,
      linkableTasks,
      createTask,
      saveTask,
      updateTask,
      deleteTask,
      toggleTaskDone,
      reorderTasks,
      incrementTaskEstimate,
      getAllTasksWithDeleted,
      isSyncingGoogle,
      googleSyncError,
      syncWithGoogle,
      connectGoogleTasks,
      disconnectGoogleTasks
    ]
  );

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
};

export const useTasks = (): TasksContextType => {
  const context = useContext(TasksContext);
  if (!context) {
    throw new Error('useTasks deve ser utilizado dentro de um TasksProvider');
  }
  return context;
};
