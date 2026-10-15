import { type Habit, type PomoGoal, type PomoSession, type LogsMap } from '@/types/habit';
import { parseDateKey, toDateKey } from './dateUtils';
import { isWeeklyOn } from './weekly';

export const MIN_GOAL_SESSIONS = 1;
export const MAX_GOAL_SESSIONS = 12;
export const MIN_GOAL_MINUTES = 5;
export const MAX_GOAL_MINUTES = 240;

export const DEFAULT_GOAL_SESSIONS = 2;
export const DEFAULT_GOAL_MINUTES = 25;

export const GOAL_LIMITS = {
  sessions: { min: MIN_GOAL_SESSIONS, max: MAX_GOAL_SESSIONS, step: 1 },
  minutes: { min: MIN_GOAL_MINUTES, max: MAX_GOAL_MINUTES, step: 5 }
} as const;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)));

/** Valida uma meta vinda de dados salvos ou do formulário; devolve undefined se inválida */
export function normalizePomoGoal(value: unknown): PomoGoal | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Record<string, unknown>;
  if (typeof v.target !== 'number' || !Number.isFinite(v.target)) return undefined;
  if (v.type === 'sessions') return { type: 'sessions', target: clamp(v.target, MIN_GOAL_SESSIONS, MAX_GOAL_SESSIONS) };
  if (v.type === 'minutes') return { type: 'minutes', target: clamp(v.target, MIN_GOAL_MINUTES, MAX_GOAL_MINUTES) };
  return undefined;
}

export interface GoalProgress {
  /** Valor atual na unidade da meta (minutos inteiros ou número de sessões) */
  current: number;
  target: number;
  unit: 'min' | 'focos';
  /** 0..1 */
  ratio: number;
  met: boolean;
}

/** Sessões de FOCO vinculadas ao hábito que COMEÇARAM no dia informado */
function focusSessionsOfDay(habitId: string, sessions: PomoSession[], dateKey: string): PomoSession[] {
  return sessions.filter(
    (s) => s.kind === 'focus' && s.habitId === habitId && toDateKey(new Date(s.startedAt)) === dateKey
  );
}

/**
 * Progresso da meta no dia.
 * - minutos: soma do tempo real das sessões (concluídas e interrompidas);
 * - sessões: conta somente as concluídas.
 * Sessões sem vínculo com este hábito não contam.
 */
export function goalProgress(
  goal: PomoGoal,
  habitId: string,
  sessions: PomoSession[],
  dateKey: string
): GoalProgress {
  const ofDay = focusSessionsOfDay(habitId, sessions, dateKey);
  if (goal.type === 'minutes') {
    const seconds = ofDay.reduce((acc, s) => acc + Math.max(0, s.actualSeconds), 0);
    return {
      current: Math.floor(seconds / 60),
      target: goal.target,
      unit: 'min',
      ratio: Math.min(1, seconds / (goal.target * 60)),
      met: seconds >= goal.target * 60
    };
  }
  const done = ofDay.filter((s) => s.completed).length;
  return {
    current: done,
    target: goal.target,
    unit: 'focos',
    ratio: Math.min(1, done / goal.target),
    met: done >= goal.target
  };
}

export function isGoalMet(goal: PomoGoal, habitId: string, sessions: PomoSession[], dateKey: string): boolean {
  return goalProgress(goal, habitId, sessions, dateKey).met;
}

/** Texto curto: "12/30 min" ou "1/2 focos" */
export function goalLabel(progress: GoalProgress): string {
  return `${progress.current}/${progress.target} ${progress.unit}`;
}

/**
 * Bloqueio de marcação: um hábito com meta do Pomo só pode ser concluído quando a meta do dia
 * foi cumprida. Devolve o progresso (ex.: "12/30 min") enquanto estiver bloqueado, ou null.
 */
export function getGoalLock(habit: Habit, sessions: PomoSession[], dateKey: string): { label: string } | null {
  if (!habit.pomoGoal) return null;
  const progress = goalProgress(habit.pomoGoal, habit.id, sessions, dateKey);
  return progress.met ? null : { label: goalLabel(progress) };
}

/** Hábitos que podem ser vinculados a um foco agora: agendados no dia, pendentes e com meta ainda não atingida */
export function getLinkableHabits(
  habits: Habit[],
  logs: LogsMap,
  sessions: PomoSession[],
  dateKey: string,
  dayOfWeek: number
): Habit[] {
  const done = logs[dateKey] || [];
  return habits.filter(
    (h) =>
      !h.archived &&
      h.pomoGoal &&
      (isWeeklyOn(h, parseDateKey(dateKey)) || (h.frequency || []).includes(dayOfWeek)) &&
      !done.includes(h.id) &&
      !isGoalMet(h.pomoGoal, h.id, sessions, dateKey)
  );
}

/** Marcação automática: meta atingida, hábito ainda não concluído e não desmarcado manualmente no dia */
export function shouldAutoComplete(opts: {
  goal: PomoGoal;
  habitId: string;
  sessions: PomoSession[];
  dateKey: string;
  completedIds: string[];
  dismissedIds: string[];
}): boolean {
  if (opts.completedIds.includes(opts.habitId)) return false;
  if (opts.dismissedIds.includes(opts.habitId)) return false;
  return isGoalMet(opts.goal, opts.habitId, opts.sessions, opts.dateKey);
}

// ---- Desmarcações manuais do dia (impedem a remarcação automática) ----

export type GoalDismissals = Record<string, string[]>; // { 'YYYY-MM-DD': ['habit-1'] }

const KEEP_DAYS = 3;

export function addDismissal(map: GoalDismissals, dateKey: string, habitId: string, today: Date): GoalDismissals {
  const next: GoalDismissals = { ...pruneDismissals(map, today) };
  const current = next[dateKey] || [];
  next[dateKey] = current.includes(habitId) ? current : [...current, habitId];
  return next;
}

/** Mantém só os últimos dias: a flag só importa no próprio dia */
export function pruneDismissals(map: unknown, today: Date): GoalDismissals {
  if (!map || typeof map !== 'object') return {};
  const limit = new Date(today);
  limit.setDate(limit.getDate() - KEEP_DAYS);
  const minKey = toDateKey(limit);
  const out: GoalDismissals = {};
  for (const [key, ids] of Object.entries(map as Record<string, unknown>)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(key) && key >= minKey && Array.isArray(ids)) {
      out[key] = ids.filter((id): id is string => typeof id === 'string');
    }
  }
  return out;
}
