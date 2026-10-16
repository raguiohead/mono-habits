import { sanitizeHabitDescription } from '@/lib/habitDescription';
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { type Habit, type LogsMap, type GracesMap, type SlipsMap, type TabType, type SyncStatus, type PomoSession } from '@/types/habit';
import { useSettings } from '@/context/SettingsContext';
import { GRACE_BLOCK_MESSAGE, addGrace, getGraceBlock, graceRemaining, isGraced, monthKeyOf, removeGrace } from '@/lib/graces';
import { sortSessions } from '@/lib/pomo';
import { normalizePeriod } from '@/lib/periods';
import { applyWeeklyTargetChange } from '@/lib/weekly';
import { addSlip, canSlipOn, normalizeKind, removeSlip } from '@/lib/avoid';
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
  saveGoalDismissals,
  loadLocalGraces,
  saveLocalGraces,
  loadLocalSlips,
  saveLocalSlips
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

/** Ação opcional do toast (ex.: Desfazer) */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

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
  graces: GracesMap;
  slips: SlipsMap;
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
  /** Registra um escorregão em um hábito a evitar (o dia vira falha e a ofensiva recomeça). Com toast de desfazer. */
  markSlip: (habitId: string, dateKey: string) => Promise<boolean>;
  /** Desfaz o escorregão */
  undoSlip: (habitId: string, dateKey: string) => Promise<boolean>;
  /** Usa um dia de graça do hábito no dia (valida janela, agendamento e cota). Retorna true se aplicou. */
  applyGrace: (habitId: string, dateKey: string) => Promise<boolean>;
  /** Desfaz o dia de graça e devolve a cota */
  undoGrace: (habitId: string, dateKey: string) => Promise<boolean>;
  /** Marca como concluído de forma idempotente (nunca desmarca). Retorna true se mudou algo. */
  completeHabit: (habitId: string, dateKey: string) => Promise<boolean>;
  toggleHideTitle: (habit: Habit) => Promise<void>;
  toggleArchiveHabit: (habit: Habit) => Promise<void>;
  deleteHabit: (habitId: string) => Promise<void>;
  seedStarterHabits: () => Promise<void>;
  savePomoSession: (session: PomoSession) => Promise<void>;

  // Notificações
  toastMessage: string | null;
  toastAction: ToastAction | null;
  showToast: (msg: string, action?: ToastAction) => void;
  dismissToast: () => void;
}

const HabitsContext = createContext<HabitsContextType | undefined>(undefined);

export const HabitsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings } = useSettings();
  const [darkMode, setDarkMode] = useState<boolean>(() => getStoredTheme());
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [syncState, setSyncState] = useState<SyncStatus>(isFirebaseConfigured ? 'connecting' : 'offline');

  // Estado dos hábitos e logs (inicia com localStorage)
  const [habits, setHabits] = useState<Habit[]>(() => loadLocalHabits());
  const [logs, setLogs] = useState<LogsMap>(() => loadLocalLogs());
  const logsRef = useRef<LogsMap>(logs);
  logsRef.current = logs;
  const [slips, setSlips] = useState<SlipsMap>(() => loadLocalSlips());
  const slipsRef = useRef<SlipsMap>(slips);
  slipsRef.current = slips;
  const [graces, setGraces] = useState<GracesMap>(() => loadLocalGraces());
  const gracesRef = useRef<GracesMap>(graces);
  gracesRef.current = graces;
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

  const [toastAction, setToastAction] = useState<ToastAction | null>(null);
  const toastSeq = useRef(0);

  const dismissToast = useCallback(() => {
    toastSeq.current += 1; // invalida o temporizador do toast atual
    setToastMessage(null);
    setToastAction(null);
  }, []);

  // Só o toast mais recente é fechado pelo seu temporizador; com ação (ex.: Desfazer) dura mais
  const showToast = useCallback((msg: string, action?: ToastAction) => {
    const id = ++toastSeq.current;
    setToastMessage(msg);
    setToastAction(action ?? null);
    setTimeout(() => {
      if (toastSeq.current === id) {
        setToastMessage(null);
        setToastAction(null);
      }
    }, action ? 6000 : 3200);
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

    // Listener de Escorregões (um documento por dia, como os logs)
    const slipsCol = collection(activeDb, 'artifacts', appId, 'users', user.uid, 'slips');
    const unsubSlips = onSnapshot(
      slipsCol,
      (snapshot) => {
        const remote: SlipsMap = {};
        snapshot.forEach((docSnap) => {
          const ids = docSnap.data().habitIds;
          if (Array.isArray(ids) && ids.length > 0) remote[docSnap.id] = ids;
        });

        const local = loadLocalSlips();
        if (Object.keys(remote).length === 0 && Object.keys(local).length > 0) {
          Object.entries(local).forEach(([dateKey, ids]) => {
            const sRef = doc(activeDb, 'artifacts', appId, 'users', user.uid, 'slips', dateKey);
            setDoc(sRef, { date: dateKey, habitIds: ids, updatedAt: Date.now() }).catch((err) =>
              console.warn('[Firestore] Falha ao enviar escorregão:', err)
            );
          });
          setSlips(local);
        } else {
          setSlips(remote);
          saveLocalSlips(remote);
        }
      },
      (error) => {
        console.warn('[Firestore] Erro ao carregar escorregões:', error);
      }
    );

    // Listener de Dias de Graça (um documento por dia, como os logs)
    const gracesCol = collection(activeDb, 'artifacts', appId, 'users', user.uid, 'graces');
    const unsubGraces = onSnapshot(
      gracesCol,
      (snapshot) => {
        const remote: GracesMap = {};
        snapshot.forEach((docSnap) => {
          const ids = docSnap.data().habitIds;
          if (Array.isArray(ids) && ids.length > 0) remote[docSnap.id] = ids;
        });

        const local = loadLocalGraces();
        if (Object.keys(remote).length === 0 && Object.keys(local).length > 0) {
          Object.entries(local).forEach(([dateKey, ids]) => {
            const gRef = doc(activeDb, 'artifacts', appId, 'users', user.uid, 'graces', dateKey);
            setDoc(gRef, { date: dateKey, habitIds: ids, updatedAt: Date.now() }).catch((err) =>
              console.warn('[Firestore] Falha ao enviar dia de graça:', err)
            );
          });
          setGraces(local);
        } else {
          setGraces(remote);
          saveLocalGraces(remote);
        }
      },
      (error) => {
        console.warn('[Firestore] Erro ao carregar dias de graça:', error);
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
      unsubGraces();
      unsubSlips();
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
      // Só grava quando há texto (sem undefined/vazio). O setDoc abaixo substitui o documento,
      // então apagar a descrição a remove de fato do Firestore.
      ...(sanitizeHabitDescription(habitData.description)
        ? { description: sanitizeHabitDescription(habitData.description) }
        : {}),
      period: normalizePeriod(habitData.period), // o Firestore não aceita undefined
      // Só grava quando em destaque (sem undefined para o Firestore)
      ...(habitData.featured ? { featured: true } : {}),
      // Só grava 'avoid' (padrão 'build' fica ausente, como nos dados antigos)
      ...(normalizeKind(habitData.kind) === 'avoid' ? { kind: 'avoid' as const } : {}),
      frequency: [...habitData.frequency].sort(),
      archived: Boolean(habitData.archived),
      createdAt: habitData.createdAt || Date.now(),
      // Só inclui quando há meta válida: o Firestore não aceita undefined
      // Hábito a evitar não tem meta do Pomo nem meta semanal
      ...(normalizeKind(habitData.kind) !== 'avoid' && normalizePomoGoal(habitData.pomoGoal)
        ? { pomoGoal: normalizePomoGoal(habitData.pomoGoal) }
        : {}),
      // Meta semanal: só inclui quando houver (sem undefined). Mudar a meta vale a partir da próxima semana;
      // sem meta (dias fixos) os campos somem e `frequency` volta a valer.
      ...applyWeeklyTargetChange(
        habitsRef.current.find((h) => h.id === id),
        normalizeKind(habitData.kind) === 'avoid' ? undefined : habitData.weeklyTarget,
        new Date()
      )
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

  // Grava os dias de graça (local primeiro, depois nuvem) para o dia alterado
  const persistGraces = async (next: GracesMap, dateKey: string) => {
    gracesRef.current = next;
    setGraces(next);
    saveLocalGraces(next);
    if (user && db && isFirebaseConfigured) {
      try {
        const gRef = doc(db, 'artifacts', appId, 'users', user.uid, 'graces', dateKey);
        if (next[dateKey]?.length) {
          await setDoc(gRef, { date: dateKey, habitIds: next[dateKey], updatedAt: Date.now() });
        } else {
          await deleteDoc(gRef);
        }
      } catch (err) {
        console.error('Falha ao salvar dia de graça no Firestore:', err);
      }
    }
  };

  // Grava os escorregões (local primeiro, depois nuvem) para o dia alterado
  const persistSlips = async (next: SlipsMap, dateKey: string) => {
    slipsRef.current = next;
    setSlips(next);
    saveLocalSlips(next);
    if (user && db && isFirebaseConfigured) {
      try {
        const sRef = doc(db, 'artifacts', appId, 'users', user.uid, 'slips', dateKey);
        if (next[dateKey]?.length) {
          await setDoc(sRef, { date: dateKey, habitIds: next[dateKey], updatedAt: Date.now() });
        } else {
          await deleteDoc(sRef);
        }
      } catch (err) {
        console.error('Falha ao salvar escorregão no Firestore:', err);
      }
    }
  };

  // Registrar um escorregão: o dia vira falha e a ofensiva recomeça. O toast oferece desfazer.
  const markSlip = async (habitId: string, dateKey: string): Promise<boolean> => {
    const habit = habitsRef.current.find((h) => h.id === habitId);
    if (!habit || !canSlipOn(habit, dateKey, new Date())) return false;
    const next = addSlip(slipsRef.current, dateKey, habitId);
    if (next === slipsRef.current) return false;
    showToast('Tudo bem. Amanhã é um novo dia.', {
      label: 'Desfazer',
      onClick: () => void undoSlip(habitId, dateKey, true)
    });
    await persistSlips(next, dateKey);
    return true;
  };

  // Desfazer o escorregão (silencioso quando vem do botão do toast, que já fecha o aviso)
  const undoSlip = async (habitId: string, dateKey: string, fromToast = false): Promise<boolean> => {
    const next = removeSlip(slipsRef.current, dateKey, habitId);
    if (next === slipsRef.current) return false;
    showToast(fromToast ? 'Registro desfeito. Você segue limpo.' : 'Registro desfeito.');
    await persistSlips(next, dateKey);
    return true;
  };

  // Usar dia de graça: perdoa um dia perdido sem quebrar a ofensiva (não conta como concluído)
  const applyGrace = async (habitId: string, dateKey: string): Promise<boolean> => {
    const habit = habitsRef.current.find((h) => h.id === habitId);
    if (!habit) return false;
    const block = getGraceBlock({
      habit,
      dateKey,
      today: new Date(),
      logs: logsRef.current,
      graces: gracesRef.current,
      perMonth: settings.graceDaysPerMonth
    });
    if (block) {
      showToast(GRACE_BLOCK_MESSAGE[block]);
      return false;
    }
    const next = addGrace(gracesRef.current, dateKey, habitId);
    const left = graceRemaining(habitId, monthKeyOf(dateKey), next, settings.graceDaysPerMonth);
    showToast(`Dia de graça usado. Restam ${left} de ${settings.graceDaysPerMonth} neste mês.`);
    await persistGraces(next, dateKey);
    return true;
  };

  // Desfazer o dia de graça devolve a cota
  const undoGrace = async (habitId: string, dateKey: string): Promise<boolean> => {
    const next = removeGrace(gracesRef.current, dateKey, habitId);
    if (next === gracesRef.current) return false;
    showToast('Dia de graça desfeito.');
    await persistGraces(next, dateKey);
    return true;
  };

  // Marcar como concluído (idempotente). Usa um ref para que chamadas em sequência, como ao
  // aplicar a fila da notificação, enxerguem as anteriores sem esperar a renderização.
  const completeHabit = async (habitId: string, dateKey: string): Promise<boolean> => {
    const current = logsRef.current[dateKey] || [];
    if (current.includes(habitId)) return false;
    // Hábito a evitar não se "conclui": só registra escorregões
    if (habitsRef.current.find((h) => h.id === habitId)?.kind === 'avoid') return false;
    // Hábito com meta do Pomo só conclui depois de cumprida a meta (vale também para a notificação)
    const target = habitsRef.current.find((h) => h.id === habitId);
    if (target && getGoalLock(target, pomoSessionsRef.current, dateKey)) return false;
    // Concluir de verdade um dia perdoado devolve a cota do dia de graça
    if (isGraced(gracesRef.current, dateKey, habitId)) {
      void persistGraces(removeGrace(gracesRef.current, dateKey, habitId), dateKey);
    }
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

    // Hábito a evitar não tem check-in: a ação dele é o escorregão
    if (habitsRef.current.find((h) => h.id === habitId)?.kind === 'avoid') return;

    // Marcar um hábito com meta do Pomo exige a meta cumprida no dia
    if (!exists) {
      const target = habitsRef.current.find((h) => h.id === habitId);
      const lock = target ? getGoalLock(target, pomoSessionsRef.current, dateKey) : null;
      if (lock) {
        showToast(`Cumpra a meta do Pomo para marcar este hábito (${lock.label}).`);
        return;
      }
      // Concluir de verdade um dia perdoado devolve a cota do dia de graça
      if (isGraced(gracesRef.current, dateKey, habitId)) {
        void persistGraces(removeGrace(gracesRef.current, dateKey, habitId), dateKey);
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
        graces,
        slips,
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
        markSlip,
        undoSlip,
        applyGrace,
        undoGrace,
        toggleHideTitle,
        toggleArchiveHabit,
        deleteHabit,
        seedStarterHabits,
        savePomoSession,
        toastMessage,
        toastAction,
        showToast,
        dismissToast
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
