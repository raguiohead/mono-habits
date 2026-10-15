import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { type PomoKind, type PomoSession } from '@/types/habit';
import { useHabits } from '@/context/HabitsContext';
import { useSettings } from '@/context/SettingsContext';
import { showSystemNotification } from '@/lib/notifications';
import {
  loadPomoSettings,
  savePomoSettings,
  loadPomoTimer,
  savePomoTimer,
  type PomoSettings,
  type PomoTimerState
} from '@/lib/storage';
import { clampMinutes, formatClock, getNextKind, KIND_LABEL, type PomoDurations } from '@/lib/pomo';

interface PomoContextType {
  kind: PomoKind;
  durations: PomoDurations;
  cycleCount: number;
  status: 'idle' | 'running' | 'paused';
  remainingSeconds: number;
  totalSeconds: number;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  selectKind: (kind: PomoKind) => void;
  setMinutes: (kind: PomoKind, minutes: number) => void;
}

const PomoContext = createContext<PomoContextType | undefined>(undefined);

function playBeeps(ctx: AudioContext | null) {
  if (!ctx) return;
  try {
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      const t = ctx.currentTime + i * 0.28;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.22);
    }
  } catch {
    /* áudio indisponível */
  }
}

export const PomoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { savePomoSession, showToast } = useHabits();
  const { settings: appSettings } = useSettings();

  const [settings, setSettings] = useState<PomoSettings>(() => loadPomoSettings());
  const [timer, setTimer] = useState<PomoTimerState | null>(() => loadPomoTimer());
  const [now, setNow] = useState<number>(() => Date.now());

  const audioRef = useRef<AudioContext | null>(null);
  const finishingRef = useRef(false);

  const updateSettings = useCallback((updater: (prev: PomoSettings) => PomoSettings) => {
    setSettings((prev) => {
      const next = updater(prev);
      savePomoSettings(next);
      return next;
    });
  }, []);

  const updateTimer = useCallback((next: PomoTimerState | null) => {
    savePomoTimer(next);
    setTimer(next);
  }, []);

  const buildSession = (t: PomoTimerState, endedAt: number, actualMs: number, completed: boolean): PomoSession => ({
    id: `pomo-${t.startedAt}`,
    kind: t.kind,
    startedAt: t.startedAt,
    endedAt,
    plannedSeconds: Math.round(t.plannedMs / 1000),
    actualSeconds: Math.round(actualMs / 1000),
    completed
  });

  // Conclusão natural da sessão
  const finish = useCallback(
    (t: PomoTimerState, wasAway: boolean) => {
      if (finishingRef.current) return;
      finishingRef.current = true;

      void savePomoSession(buildSession(t, t.endsAt, t.plannedMs, true));

      const cycleCount = t.kind === 'focus' ? settings.cycleCount + 1 : settings.cycleCount;
      const next = getNextKind(t.kind, cycleCount);
      updateSettings((prev) => ({ ...prev, kind: next.kind, cycleCount: next.cycleCount }));
      updateTimer(null);

      if (!wasAway) {
        if (appSettings.sound) playBeeps(audioRef.current);
        if (appSettings.vibration) {
          try {
            navigator.vibrate?.([200, 100, 200, 100, 300]);
          } catch {
            /* vibração indisponível */
          }
        }
      }
      const message = `${KIND_LABEL[t.kind]} concluído${wasAway ? ' enquanto você estava fora' : ''}. Próximo: ${KIND_LABEL[next.kind].toLowerCase()}.`;
      showToast(message);
      // Com o app em segundo plano, o toast não é visto: avisa pelo sistema
      if (appSettings.pomoAlerts && document.visibilityState === 'hidden') {
        void showSystemNotification('MONO // HABITS · Pomo', message, 'pomo-finished');
      }
      finishingRef.current = false;
    },
    [savePomoSession, settings.cycleCount, showToast, updateSettings, updateTimer, appSettings.sound, appSettings.vibration, appSettings.pomoAlerts]
  );

  // Tick enquanto estiver rodando
  useEffect(() => {
    if (timer?.status !== 'running') return;
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [timer?.status]);

  // Detecta o fim (inclusive quando o app foi reaberto depois do horário)
  const mountedAtRef = useRef(Date.now());
  useEffect(() => {
    if (timer?.status === 'running' && now >= timer.endsAt) {
      finish(timer, timer.endsAt < mountedAtRef.current - 2000);
    }
  }, [now, timer, finish]);

  // Mantém a tela acesa durante o timer
  useEffect(() => {
    if (timer?.status !== 'running' || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        if (document.visibilityState !== 'visible') return;
        const s = await navigator.wakeLock.request('screen');
        if (cancelled) {
          void s.release();
        } else {
          sentinel = s;
        }
      } catch {
        /* wake lock negado */
      }
    };
    void acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', acquire);
      void sentinel?.release();
    };
  }, [timer?.status]);

  const kind = timer?.kind ?? settings.kind;
  const status: PomoContextType['status'] = timer ? timer.status : 'idle';
  const totalSeconds = timer ? Math.round(timer.plannedMs / 1000) : settings.durations[kind] * 60;
  const remainingSeconds = timer
    ? timer.status === 'running'
      ? Math.max(0, (timer.endsAt - now) / 1000)
      : timer.remainingMs / 1000
    : totalSeconds;

  // Título da aba mostra o tempo restante
  useEffect(() => {
    if (!timer) return;
    const original = document.title;
    document.title = `${formatClock(remainingSeconds)} · ${KIND_LABEL[timer.kind]}`;
    return () => {
      document.title = original;
    };
  }, [timer, remainingSeconds]);

  const start = useCallback(() => {
    if (timer) return;
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (Ctx) {
        audioRef.current = audioRef.current || new Ctx();
        void audioRef.current.resume();
      }
    } catch {
      /* áudio indisponível */
    }
    const startedAt = Date.now();
    const plannedMs = settings.durations[settings.kind] * 60 * 1000;
    setNow(startedAt);
    updateTimer({
      kind: settings.kind,
      plannedMs,
      startedAt,
      status: 'running',
      endsAt: startedAt + plannedMs,
      remainingMs: plannedMs
    });
  }, [timer, settings, updateTimer]);

  const pause = useCallback(() => {
    if (timer?.status !== 'running') return;
    updateTimer({ ...timer, status: 'paused', remainingMs: Math.max(0, timer.endsAt - Date.now()) });
  }, [timer, updateTimer]);

  const resume = useCallback(() => {
    if (timer?.status !== 'paused') return;
    const t = Date.now();
    setNow(t);
    updateTimer({ ...timer, status: 'running', endsAt: t + timer.remainingMs });
  }, [timer, updateTimer]);

  // Interrompe e registra o tempo realmente decorrido
  const stop = useCallback(() => {
    if (!timer) return;
    const t = Date.now();
    const remaining = timer.status === 'running' ? Math.max(0, timer.endsAt - t) : timer.remainingMs;
    const elapsed = timer.plannedMs - remaining;
    if (elapsed >= 1000) {
      void savePomoSession(buildSession(timer, t, elapsed, false));
      showToast(`${KIND_LABEL[timer.kind]} interrompido e registrado.`);
    }
    updateTimer(null);
  }, [timer, savePomoSession, showToast, updateTimer]);

  const selectKind = useCallback(
    (next: PomoKind) => {
      if (timer) return;
      updateSettings((prev) => ({ ...prev, kind: next }));
    },
    [timer, updateSettings]
  );

  const setMinutes = useCallback(
    (target: PomoKind, minutes: number) => {
      if (timer) return;
      updateSettings((prev) => ({
        ...prev,
        durations: { ...prev.durations, [target]: clampMinutes(minutes) }
      }));
    },
    [timer, updateSettings]
  );

  return (
    <PomoContext.Provider
      value={{
        kind,
        durations: settings.durations,
        cycleCount: settings.cycleCount,
        status,
        remainingSeconds,
        totalSeconds,
        start,
        pause,
        resume,
        stop,
        selectKind,
        setMinutes
      }}
    >
      {children}
    </PomoContext.Provider>
  );
};

export const usePomo = (): PomoContextType => {
  const context = useContext(PomoContext);
  if (!context) {
    throw new Error('usePomo deve ser utilizado dentro de um PomoProvider');
  }
  return context;
};
