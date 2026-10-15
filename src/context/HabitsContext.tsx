import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { type Habit, type LogsMap, type TabType, type SyncStatus, type PomoSession } from '@/types/habit';
import { sortSessions } from '@/lib/pomo';
import { normalizePeriod } from '@/lib/periods';
import { addDismissal, getGoalLock, normalizePomoGoal, shouldAutoComplete } from '@/lib/pomoGoals';
import { toDateKey, addDays } from '@/lib/dateUtils';
import {
  DEFAULT_HABITS,
  loadLocalHabits,
  saveLocalHabits,
  loadLocalLogs,
  saveLocalLogs,
  getStoredTheme,
  setStoredTheme,
  loadLocalPomoSessions,
  saveLocalPomoSessions,
  clearLocalUserData,
  loadGoalDismissals,
  saveGoalDismissals
} from '@/lib/storage';
import {
  auth,
  db,
  appId,
  isFirebaseConfigured,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  deleteUser,
  reauthenticateWithPopup,
  deleteAllCloudData,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  type User
} from '@/lib/firebase';

interface HabitsContextType {
  // Tema
  darkMode: boolean;
  toggleDarkMode: () => void;

  // Autenticação & Nuvem
  user: User | null;
  authLoading: boolean;
  syncState: SyncStatus;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  clearDeviceData: () => void;

  // Dados
  habits: Habit[];
  activeHabits: Habit[];
  logs: LogsMap;
  pomoSessions: PomoSession[];
  initialLoaded: boolean;

  // Navegação
  selectedDateKey: string;
  setSelectedDateKey: (key: string) => void;
  weekOffset: number;
  setWeekOffset: React.Dispatch<React.SetStateAction<number>>;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;

  // Ações CRUD
  saveHabit: (habitData: Omit<Habit, 'id' | 'createdAt'> & { id?: string; createdAt?: number }) => Promise<void>;
  toggleHabitCompletion: (habitId: string, dateKey?: string) => Promise<void>;
  /** Marca como concluído de forma idempotente (nunca desmarca). Retorna true se mudou algo. */
  completeHabit: (habitId: string, dateKey: string) => Promise<boolean>;
  toggleHideTitle: (habit: Habit) => Promise<void>;
  toggleArchiveHabit: (habit: Habit) => Promise<void>;
  deleteHabit: (habitId: string) => Promise<void>;
  seedStarterHabits: () => Promise<void>;
  savePomoSession: (session: PomoSession) => Promise<void>;

  // Notificações
  toastMessage: string | null;
  showToast: (msg: string) => void;
}

const HabitsContext = createContext<HabitsContextType | undefined>(undefined);

export const HabitsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [darkMode, setDarkMode] = useState<boolean>(() => getStoredTheme());
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [syncState, setSyncState] = useState<SyncStatus>(isFirebaseConfigured ? 'connecting' : 'offline');

  // Estado dos hábitos e logs (inicia com localStorage)
  const [habits, setHabits] = useState<Habit[]>(() => loadLocalHabits());
  const [logs, setLogs] = useState<LogsMap>(() => loadLocalLogs());
  const logsRef = useRef<LogsMap>(logs);
  logsRef.current = logs;
  const habitsRef = useRef<Habit[]>(habits);
  habitsRef.current = habits;
  const goalDismissalsRef = useRef(loadGoalDismissals());
  const [pomoSessions, setPomoSessions] = useState<PomoSession[]>(() => sortSessions(loadLocalPomoSessions()));
  const pomoSessionsRef = useRef<PomoSession[]>(pomoSessions);
  pomoSessionsRef.current = pomoSessions;
  const [initialLoaded, setInitialLoaded] = useState<boolean>(false);

  // Navegação e datas
  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<TabType>('today');

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  // Alternar Dark Mode e sincronizar com DOM e localStorage
  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev;
      setStoredTheme(next);
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Inicialização de Autenticação Firebase
  useEffect(() => {
    const activeAuth = auth;
    if (!isFirebaseConfigured || !activeAuth) {
      setAuthLoading(false);
      setSyncState('offline');
      setInitialLoaded(true);
      return;
    }

    let isMounted = true;

    const initAuth = async () => {
      try {
        if (!activeAuth.currentUser) {
          await signInAnonymously(activeAuth);
        }
      } catch (err) {
        console.warn('[Auth] Erro inicial:', err);
        if (isMounted) setSyncState('offline');
      }
    };

    initAuth();

    const unsubscribe = onAuthStateChanged(activeAuth, (currentUser) => {
      if (!isMounted) return;
      setUser(currentUser);
      setAuthLoading(false);
      if (currentUser) {
        setSyncState('synced');
      } else {
        setSyncState('offline');
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Sincronização em tempo real com Firestore quando autenticado
  useEffect(() => {
    const activeDb = db;
    if (!user || !activeDb || !isFirebaseConfigured) {
      // Sem Firebase conectado: garante que estado reflete localStorage
      setInitialLoaded(true);
      return;
    }

    const habitsRef = collection(activeDb, 'artifacts', appId, 'users', user.uid, 'habits');
    const logsRef = collection(activeDb, 'artifacts', appId, 'users', user.uid, 'logs');

    // Listener de Hábitos
    const unsubHabits = onSnapshot(
      habitsRef,
      (snapshot) => {
        const remoteHabits: Habit[] = [];
        snapshot.forEach((docSnap) => {
          remoteHabits.push({ id: docSnap.id, ...(docSnap.data() as Omit<Habit, 'id'>) });
        });
        remoteHabits.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

        // Se a nuvem estiver vazia, mas houver dados locais, migra automaticamente
        const localHabits = loadLocalHabits();
        if (remoteHabits.length === 0 && localHabits.length > 0) {
          localHabits.forEach(async (h) => {
            const docRef = doc(activeDb, 'artifacts', appId, 'users', user.uid, 'habits', h.id);
            await setDoc(docRef, h);
          });
          setHabits(localHabits);
        } else {
          setHabits(remoteHabits);
          saveLocalHabits(remoteHabits);
        }

        setInitialLoaded(true);
        setSyncState('synced');
      },
      (error) => {
        console.warn('[Firestore] Erro ao carregar hábitos:', error);
        setSyncState('offline');
        setInitialLoaded(true);
      }
    );

    // Listener de Logs
    const unsubLogs = onSnapshot(
      logsRef,
      (snapshot) => {
        const remoteLogs: LogsMap = {};
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          remoteLogs[docSnap.id] = Array.isArray(data.completedHabitIds)
            ? data.completedHabitIds
            : [];
        });

        const localLogs = loadLocalLogs();
        if (Object.keys(remoteLogs).length === 0 && Object.keys(localLogs).length > 0) {
          Object.entries(localLogs).forEach(async ([dateKey, ids]) => {
            const logRef = doc(activeDb, 'artifacts', appId, 'users', user.uid, 'logs', dateKey);
            await setDoc(logRef, { date: dateKey, completedHabitIds: ids, updatedAt: Date.now() });
          });
          setLogs(localLogs);
        } else {
          setLogs(remoteLogs);
          saveLocalLogs(remoteLogs);
        }

        setSyncState('synced');
      },
      (error) => {
        console.warn('[Firestore] Erro ao carregar logs:', error);
        setSyncState('offline');
      }
    );

    // Listener de Sessões Pomo
    const pomoRef = collection(activeDb, 'artifacts', appId, 'users', user.uid, 'pomoSessions');
    const unsubPomo = onSnapshot(
      pomoRef,
      (snapshot) => {
        const remote: PomoSession[] = [];
        snapshot.forEach((docSnap) => {
          remote.push({ id: docSnap.id, ...(docSnap.data() as Omit<PomoSession, 'id'>) });
        });

        const local = loadLocalPomoSessions();
        const remoteIds = new Set(remote.map((s) => s.id));
        // Envia para a nuvem sessões feitas offline que ainda não existem lá
        local
          .filter((s) => !remoteIds.has(s.id))
          .forEach((s) => {
            const sRef = doc(activeDb, 'artifacts', appId, 'users', user.uid, 'pomoSessions', s.id);
            setDoc(sRef, s).catch((err) => console.warn('[Firestore] Falha ao enviar sessão Pomo:', err));
          });

        const merged = sortSessions([...remote, ...local.filter((s) => !remoteIds.has(s.id))]);
        setPomoSessions(merged);
        saveLocalPomoSessions(merged);
      },
      (error) => {
        console.warn('[Firestore] Erro ao carregar sessões Pomo:', error);
      }
    );

    return () => {
      unsubHabits();
      unsubLogs();
      unsubPomo();
    };
  }, [user]);

  // Login com Conta Google
  const loginWithGoogle = async () => {
    if (!isFirebaseConfigured || !auth) {
      showToast('Configure as variáveis do Firebase no .env para ativar a nuvem.');
      return;
    }
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      showToast('Conta Google conectada e sincronizada!');
    } catch (error: any) {
      console.error('[Google Auth Error]', error);
      if (error.code === 'auth/popup-blocked') {
        showToast('Pop-up bloqueado pelo navegador. Habilite pop-ups para fazer login.');
      } else if (error.code === 'auth/unauthorized-domain') {
        showToast('Domínio não autorizado no Firebase Console. Adicione este domínio nas configurações de autenticação.');
      } else {
        showToast(`Erro na autenticação: ${error.message || 'Tente novamente.'}`);
      }
    }
  };

  // Apaga dados locais e recarrega para zerar todo o estado em memória (hábitos, Pomo, timers)
  const clearDeviceData = () => {
    clearLocalUserData();
    window.location.reload();
  };

  const logout = async () => {
    if (!auth) return;
    const wasGoogleAccount = Boolean(user && !user.isAnonymous);
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Erro ao sair:', err);
      showToast('Não foi possível encerrar a sessão. Tente novamente.');
      return;
    }
    // Os dados continuam na nuvem. Limpamos o espelho local para que a próxima pessoa
    // que usar este navegador não veja nem migre estes hábitos para outra conta.
    if (wasGoogleAccount) {
      clearDeviceData();
    } else {
      showToast('Sessão encerrada com sucesso.');
    }
  };

  // Exclui a conta: dados na nuvem, usuário no Firebase Auth e dados locais
  const deleteAccount = async () => {
    const currentUser = auth?.currentUser;
    if (!auth || !currentUser) return;
    try {
      // Contas Google exigem login recente para exclusão
      if (!currentUser.isAnonymous) {
        await reauthenticateWithPopup(currentUser, new GoogleAuthProvider());
      }
      await deleteAllCloudData(currentUser.uid);
      await deleteUser(currentUser);
    } catch (error: any) {
      console.error('[Delete Account Error]', error);
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        showToast('Exclusão cancelada. Confirme sua conta Google para continuar.');
      } else if (error.code === 'auth/popup-blocked') {
        showToast('Pop-up bloqueado pelo navegador. Habilite pop-ups e tente novamente.');
      } else {
        showToast('Não foi possível excluir a conta. Tente novamente.');
      }
      return;
    }
    clearDeviceData();
  };

  // Salvar Hábito (Criação ou Edição)
  const saveHabit = async (habitData: Omit<Habit, 'id' | 'createdAt'> & { id?: string; createdAt?: number }) => {
    const id = habitData.id || `habit-${Date.now()}`;
    const newHabit: Habit = {
      id,
      title: habitData.title.trim(),
      category: habitData.category?.trim() || 'Geral',
      icon: habitData.icon || 'target',
      hideTitle: Boolean(habitData.hideTitle),
      period: normalizePeriod(habitData.period), // o Firestore não aceita undefined
      frequency: [...habitData.frequency].sort(),
      archived: Boolean(habitData.archived),
      createdAt: habitData.createdAt || Date.now(),
      // Só inclui quando há meta válida: o Firestore não aceita undefined
      ...(normalizePomoGoal(habitData.pomoGoal) ? { pomoGoal: normalizePomoGoal(habitData.pomoGoal) } : {})
    };

    // 1. Atualiza estado e localStorage (Local-First)
    setHabits((prev) => {
      const existingIdx = prev.findIndex((h) => h.id === id);
      let updated: Habit[];
      if (existingIdx >= 0) {
        updated = [...prev];
        updated[existingIdx] = newHabit;
      } else {
        updated = [...prev, newHabit];
      }
      saveLocalHabits(updated);
      return updated;
    });

    // 2. Sincroniza com o Firestore se conectado
    if (user && db && isFirebaseConfigured) {
      try {
        const habitRef = doc(db, 'artifacts', appId, 'users', user.uid, 'habits', id);
        await setDoc(habitRef, newHabit);
      } catch (err) {
        console.error('Falha ao salvar no Firestore:', err);
      }
    }

    showToast(habitData.id ? 'Hábito atualizado.' : 'Novo hábito criado.');
  };

  // Marcar como concluído (idempotente). Usa um ref para que chamadas em sequência, como ao
  // aplicar a fila da notificação, enxerguem as anteriores sem esperar a renderização.
  const completeHabit = async (habitId: string, dateKey: string): Promise<boolean> => {
    const current = logsRef.current[dateKey] || [];
    if (current.includes(habitId)) return false;
    // Hábito com meta do Pomo só conclui depois de cumprida a meta (vale também para a notificação)
    const target = habitsRef.current.find((h) => h.id === habitId);
    if (target && getGoalLock(target, pomoSessionsRef.current, dateKey)) return false;
    const updatedCompleted = [...current, habitId];
    logsRef.current = { ...logsRef.current, [dateKey]: updatedCompleted };

    setLogs((prev) => {
      const next = { ...prev, [dateKey]: updatedCompleted };
      saveLocalLogs(next);
      return next;
    });

    if (user && db && isFirebaseConfigured) {
      try {
        const logRef = doc(db, 'artifacts', appId, 'users', user.uid, 'logs', dateKey);
        await setDoc(logRef, {
          date: dateKey,
          completedHabitIds: updatedCompleted,
          updatedAt: Date.now()
        });
      } catch (err) {
        console.error('Falha ao salvar log no Firestore:', err);
      }
    }
    return true;
  };

  // Alternar Conclusão do Hábito
  const toggleHabitCompletion = async (habitId: string, dateKey = selectedDateKey) => {
    const currentCompleted = logs[dateKey] || [];
    const exists = currentCompleted.includes(habitId);
    const updatedCompleted = exists
      ? currentCompleted.filter((id) => id !== habitId)
      : [...currentCompleted, habitId];

    // Marcar um hábito com meta do Pomo exige a meta cumprida no dia
    if (!exists) {
      const target = habitsRef.current.find((h) => h.id === habitId);
      const lock = target ? getGoalLock(target, pomoSessionsRef.current, dateKey) : null;
      if (lock) {
        showToast(`Cumpra a meta do Pomo para marcar este hábito (${lock.label}).`);
        return;
      }
    }

    // Desmarcar um hábito com meta do Pomo: o Pomo não o remarca de novo neste dia
    if (exists && habitsRef.current.find((h) => h.id === habitId)?.pomoGoal) {
      goalDismissalsRef.current = addDismissal(goalDismissalsRef.current, dateKey, habitId, new Date());
      saveGoalDismissals(goalDismissalsRef.current);
    }

    // Atualização otimista local
    setLogs((prev) => {
      const next = { ...prev, [dateKey]: updatedCompleted };
      saveLocalLogs(next);
      return next;
    });

    // Sincroniza com Firestore
    if (user && db && isFirebaseConfigured) {
      try {
        const logRef = doc(db, 'artifacts', appId, 'users', user.uid, 'logs', dateKey);
        await setDoc(logRef, {
          date: dateKey,
          completedHabitIds: updatedCompleted,
          updatedAt: Date.now()
        });
      } catch (err) {
        console.error('Falha ao salvar log no Firestore:', err);
      }
    }
  };

  // Alternar Visibilidade do Nome
  const toggleHideTitle = async (habit: Habit) => {
    const nextState = !habit.hideTitle;
    const updatedHabit = { ...habit, hideTitle: nextState };

    setHabits((prev) => {
      const next = prev.map((h) => (h.id === habit.id ? updatedHabit : h));
      saveLocalHabits(next);
      return next;
    });

    if (user && db && isFirebaseConfigured) {
      try {
        const habitRef = doc(db, 'artifacts', appId, 'users', user.uid, 'habits', habit.id);
        await setDoc(habitRef, updatedHabit);
      } catch (err) {
        console.error('Erro ao atualizar no Firestore:', err);
      }
    }

    showToast(nextState ? 'Nome do hábito ocultado.' : 'Nome do hábito visível.');
  };

  // Alternar Arquivamento
  const toggleArchiveHabit = async (habit: Habit) => {
    const nextArchived = !habit.archived;
    const updatedHabit = { ...habit, archived: nextArchived };

    setHabits((prev) => {
      const next = prev.map((h) => (h.id === habit.id ? updatedHabit : h));
      saveLocalHabits(next);
      return next;
    });

    if (user && db && isFirebaseConfigured) {
      try {
        const habitRef = doc(db, 'artifacts', appId, 'users', user.uid, 'habits', habit.id);
        await setDoc(habitRef, updatedHabit);
      } catch (err) {
        console.error('Erro ao arquivar no Firestore:', err);
      }
    }

    showToast(nextArchived ? 'Hábito arquivado.' : 'Hábito restaurado.');
  };

  // Excluir Hábito
  const deleteHabit = async (habitId: string) => {
    setHabits((prev) => {
      const next = prev.filter((h) => h.id !== habitId);
      saveLocalHabits(next);
      return next;
    });

    if (user && db && isFirebaseConfigured) {
      try {
        const habitRef = doc(db, 'artifacts', appId, 'users', user.uid, 'habits', habitId);
        await deleteDoc(habitRef);
      } catch (err) {
        console.error('Erro ao deletar no Firestore:', err);
      }
    }

    showToast('Hábito excluído permanentemente.');
  };

  // Meta do Pomo: ao atingir a meta do hábito vinculado, marca o hábito automaticamente
  const applyPomoGoal = async (session: PomoSession, allSessions: PomoSession[]) => {
    if (session.kind !== 'focus' || !session.habitId) return;
    const habit = habitsRef.current.find((h) => h.id === session.habitId);
    if (!habit?.pomoGoal) return;
    const dateKey = toDateKey(new Date(session.startedAt));
    const should = shouldAutoComplete({
      goal: habit.pomoGoal,
      habitId: habit.id,
      sessions: allSessions,
      dateKey,
      completedIds: logsRef.current[dateKey] || [],
      dismissedIds: goalDismissalsRef.current[dateKey] || []
    });
    if (!should) return;
    if (await completeHabit(habit.id, dateKey)) {
      showToast(
        habit.hideTitle
          ? 'Meta do Pomo atingida: hábito concluído.'
          : `Meta do Pomo atingida: ${habit.title} concluído.`
      );
    }
  };

  // Registrar sessão do Pomo (concluída ou interrompida)
  const savePomoSession = async (session: PomoSession) => {
    const allSessions = sortSessions([...pomoSessionsRef.current.filter((s) => s.id !== session.id), session]);
    pomoSessionsRef.current = allSessions;
    setPomoSessions((prev) => {
      const next = sortSessions([...prev.filter((s) => s.id !== session.id), session]);
      saveLocalPomoSessions(next);
      return next;
    });

    void applyPomoGoal(session, allSessions);

    if (user && db && isFirebaseConfigured) {
      try {
        const sRef = doc(db, 'artifacts', appId, 'users', user.uid, 'pomoSessions', session.id);
        await setDoc(sRef, session);
      } catch (err) {
        console.error('Falha ao salvar sessão Pomo no Firestore:', err);
      }
    }
  };

  // Carregar Hábitos de Exemplo
  const seedStarterHabits = async () => {
    // 1. Gera hábitos locais
    const now = Date.now();
    const updatedHabits = [...DEFAULT_HABITS];
    setHabits(updatedHabits);
    saveLocalHabits(updatedHabits);

    // 2. Gera 5 dias de logs simulados
    const sampleLogs: LogsMap = { ...logs };
    const today = new Date();
    for (let i = 1; i <= 5; i++) {
      const pastKey = toDateKey(addDays(today, -i));
      sampleLogs[pastKey] = i % 2 === 0
        ? ['habit-1', 'habit-2', 'habit-3']
        : ['habit-1', 'habit-3', 'habit-4'];
    }
    setLogs(sampleLogs);
    saveLocalLogs(sampleLogs);

    // 3. Salva no Firestore se disponível
    if (user && db && isFirebaseConfigured) {
      try {
        for (const item of updatedHabits) {
          const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'habits', item.id);
          await setDoc(docRef, item);
        }
        for (let i = 1; i <= 5; i++) {
          const pastKey = toDateKey(addDays(today, -i));
          const logRef = doc(db, 'artifacts', appId, 'users', user.uid, 'logs', pastKey);
          await setDoc(logRef, {
            date: pastKey,
            completedHabitIds: sampleLogs[pastKey],
            updatedAt: now
          });
        }
      } catch (err) {
        console.error('Erro ao sincronizar seed no Firestore:', err);
      }
    }

    showToast('Hábitos de exemplo carregados com sucesso!');
  };

  const activeHabits = useMemo(() => habits.filter((h) => !h.archived), [habits]);

  return (
    <HabitsContext.Provider
      value={{
        darkMode,
        toggleDarkMode,
        user,
        authLoading,
        syncState,
        loginWithGoogle,
        logout,
        deleteAccount,
        clearDeviceData,
        habits,
        activeHabits,
        logs,
        pomoSessions,
        initialLoaded,
        selectedDateKey,
        setSelectedDateKey,
        weekOffset,
        setWeekOffset,
        activeTab,
        setActiveTab,
        saveHabit,
        toggleHabitCompletion,
        completeHabit,
        toggleHideTitle,
        toggleArchiveHabit,
        deleteHabit,
        seedStarterHabits,
        savePomoSession,
        toastMessage,
        showToast
      }}
    >
      {children}
    </HabitsContext.Provider>
  );
};

export const useHabits = (): HabitsContextType => {
  const context = useContext(HabitsContext);
  if (!context) {
    throw new Error('useHabits deve ser utilizado dentro de um HabitsProvider');
  }
  return context;
};
