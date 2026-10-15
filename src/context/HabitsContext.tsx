import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { type Habit, type LogsMap, type TabType, type SyncStatus } from '@/types/habit';
import { toDateKey, addDays } from '@/lib/dateUtils';
import {
  DEFAULT_HABITS,
  loadLocalHabits,
  saveLocalHabits,
  loadLocalLogs,
  saveLocalLogs,
  getStoredTheme,
  setStoredTheme
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

  // Dados
  habits: Habit[];
  activeHabits: Habit[];
  logs: LogsMap;
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
  toggleHideTitle: (habit: Habit) => Promise<void>;
  toggleArchiveHabit: (habit: Habit) => Promise<void>;
  deleteHabit: (habitId: string) => Promise<void>;
  seedStarterHabits: () => Promise<void>;

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

    return () => {
      unsubHabits();
      unsubLogs();
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

  const logout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      showToast('Sessão encerrada com sucesso.');
    } catch (err) {
      console.error('Erro ao sair:', err);
    }
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
      frequency: [...habitData.frequency].sort(),
      archived: Boolean(habitData.archived),
      createdAt: habitData.createdAt || Date.now()
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

  // Alternar Conclusão do Hábito
  const toggleHabitCompletion = async (habitId: string, dateKey = selectedDateKey) => {
    const currentCompleted = logs[dateKey] || [];
    const exists = currentCompleted.includes(habitId);
    const updatedCompleted = exists
      ? currentCompleted.filter((id) => id !== habitId)
      : [...currentCompleted, habitId];

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
        habits,
        activeHabits,
        logs,
        initialLoaded,
        selectedDateKey,
        setSelectedDateKey,
        weekOffset,
        setWeekOffset,
        activeTab,
        setActiveTab,
        saveHabit,
        toggleHabitCompletion,
        toggleHideTitle,
        toggleArchiveHabit,
        deleteHabit,
        seedStarterHabits,
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
