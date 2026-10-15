import type { Habit, LogsMap, SlipsMap } from '@/types/habit';
import type { MotionPref } from './settings';
import { getHabitsForDate } from './analytics';
import { isDueOn } from './weekly';
import { getEffectiveCompletedIds } from './avoid';
import { toDateKey } from './dateUtils';

export interface DayProgress {
  done: number;
  scheduled: number;
}

/** Progresso de hoje, com a mesma semântica do DailyFocus (semanais cumpridas e hábitos a evitar). */
export function computeDayProgress(
  habits: Habit[],
  logs: LogsMap,
  slips: SlipsMap,
  now: Date
): DayProgress {
  const todayKey = toDateKey(now);
  const scheduledHabits = getHabitsForDate(habits, now);
  const due = scheduledHabits.filter((h) => isDueOn(h, now, logs));
  const doneIds = new Set(getEffectiveCompletedIds(scheduledHabits, todayKey, logs, slips, now));
  return { done: due.filter((h) => doneIds.has(h.id)).length, scheduled: due.length };
}

/**
 * Toca a transição só quando o progresso de HOJE cruza para 100% (de <100%), uma vez por dia.
 * `dateKey` é o dia afetado pela mudança: edições em dias passados nunca disparam.
 */
export function shouldPlayCompletion(
  prevDone: number,
  nextDone: number,
  scheduled: number,
  todayKey: string,
  lastPlayedKey: string | null,
  dateKey: string = todayKey
): boolean {
  if (scheduled <= 0) return false;
  if (dateKey !== todayKey) return false;
  if (lastPlayedKey === todayKey) return false;
  return prevDone < scheduled && nextDone >= scheduled;
}

export function isReducedMotion(pref: MotionPref, systemReduced: boolean): boolean {
  if (pref === 'reduce') return true;
  if (pref === 'full') return false;
  return systemReduced;
}
