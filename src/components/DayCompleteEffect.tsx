import React, { useEffect, useRef, useState } from 'react';
import { useHabits } from '@/context/HabitsContext';
import { useSettings } from '@/context/SettingsContext';
import { computeDayProgress, isReducedMotion, shouldPlayCompletion } from '@/lib/dayComplete';
import { getLastDayCompleteKey, setLastDayCompleteKey } from '@/lib/storage';
import { toDateKey } from '@/lib/dateUtils';

const EFFECT_MS = 950;
/** Tempo após o carregamento inicial (e snapshots da nuvem) em que mudanças não contam como ação do usuário */
const ARM_DELAY_MS = 2000;

/**
 * Ao concluir 100% dos hábitos de hoje, inverte a interface para o tema oposto e volta (~900ms),
 * no máximo uma vez por dia. Não altera o tema salvo; com movimento reduzido mostra só um aviso.
 */
export const DayCompleteEffect: React.FC = () => {
  const { activeHabits, logs, slips, initialLoaded, showToast } = useHabits();
  const { settings } = useSettings();
  const [playing, setPlaying] = useState(false);
  const [armed, setArmed] = useState(false);
  const prev = useRef<{ key: string; done: number } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!initialLoaded) return;
    const id = window.setTimeout(() => setArmed(true), ARM_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [initialLoaded]);

  useEffect(() => {
    const now = new Date();
    const todayKey = toDateKey(now);
    const { done, scheduled } = computeDayProgress(activeHabits, logs, slips, now);
    const before = prev.current;
    prev.current = { key: todayKey, done };

    if (!armed || !before || before.key !== todayKey) return;
    if (document.visibilityState !== 'visible') return;
    if (!shouldPlayCompletion(before.done, done, scheduled, todayKey, getLastDayCompleteKey())) return;

    setLastDayCompleteKey(todayKey);
    if (settings.vibration && typeof navigator.vibrate === 'function') navigator.vibrate(30);

    const systemReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (isReducedMotion(settings.motion, systemReduced)) {
      showToast('Dia completo.');
      return;
    }
    setPlaying(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPlaying(false), EFFECT_MS);
  }, [activeHabits, logs, slips, armed, settings.vibration, settings.motion, showToast]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (!playing) return null;
  return <div data-testid="day-complete-fx" aria-hidden="true" className="day-complete-fx" />;
};
