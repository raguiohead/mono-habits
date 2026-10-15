import { type Habit, type GracesMap, type LogsMap } from '@/types/habit';
import { addDays, toDateKey } from './dateUtils';
import { isWeeklyOn, weekGraced, weekStartKey, weekStatus } from './weekly';

/** Só dá para perdoar dias dentro desta janela (hoje + 6 anteriores) */
export const GRACE_WINDOW_DAYS = 7;

export type GraceQuota = 0 | 1 | 2;

/** 'YYYY-MM' do dia: a cota é por hábito e por mês civil do dia perdoado */
export const monthKeyOf = (dateKey: string): string => dateKey.slice(0, 7);

export function isGraced(graces: GracesMap, dateKey: string, habitId: string): boolean {
  return (graces[dateKey] || []).includes(habitId);
}

/** Quantos dias de graça o hábito já usou no mês */
export function graceUsed(habitId: string, monthKey: string, graces: GracesMap): number {
  let used = 0;
  for (const [dateKey, ids] of Object.entries(graces)) {
    if (monthKeyOf(dateKey) === monthKey && ids.includes(habitId)) used++;
  }
  return used;
}

/** Cota restante do hábito no mês (por hábito, por mês civil) */
export function graceRemaining(habitId: string, monthKey: string, graces: GracesMap, perMonth: number): number {
  return Math.max(0, perMonth - graceUsed(habitId, monthKey, graces));
}

export type GraceBlock =
  | 'disabled'
  | 'future'
  | 'too-old'
  | 'not-scheduled'
  | 'completed'
  | 'week-met'
  | 'already'
  | 'no-quota';

/**
 * Por que o dia NÃO pode ser perdoado (ou null se pode):
 * - desativado (cota 0), futuro, fora dos últimos 7 dias;
 * - hábito arquivado, não agendado no dia da semana ou ainda não criado;
 * - dia concluído de verdade (nunca consome cota) ou já perdoado;
 * - hábito semanal: a graça perdoa a SEMANA não cumprida (uma por semana); semana já cumprida não precisa;
 * - cota do mês esgotada.
 */
export function getGraceBlock(opts: {
  habit: Habit;
  dateKey: string;
  today: Date;
  logs: LogsMap;
  graces: GracesMap;
  perMonth: number;
}): GraceBlock | null {
  const { habit, dateKey, today, logs, graces, perMonth } = opts;
  if (perMonth <= 0) return 'disabled';
  if (dateKey > toDateKey(today)) return 'future';
  if (dateKey < toDateKey(addDays(today, -(GRACE_WINDOW_DAYS - 1)))) return 'too-old';

  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const weekly = isWeeklyOn(habit, date);
  const scheduled = !habit.archived && (weekly || (habit.frequency || []).includes(date.getDay()));
  const existedThen = !habit.createdAt || habit.createdAt <= 0 || dateKey >= toDateKey(new Date(habit.createdAt));
  if (!scheduled || !existedThen) return 'not-scheduled';

  if ((logs[dateKey] || []).includes(habit.id)) return 'completed';
  if (isGraced(graces, dateKey, habit.id)) return 'already';
  if (weekly) {
    const wk = weekStartKey(date);
    if (weekStatus(habit, wk, logs)?.met) return 'week-met';
    if (weekGraced(habit, wk, graces)) return 'already';
  }
  if (graceRemaining(habit.id, monthKeyOf(dateKey), graces, perMonth) <= 0) return 'no-quota';
  return null;
}

export function canUseGrace(opts: Parameters<typeof getGraceBlock>[0]): boolean {
  return getGraceBlock(opts) === null;
}

export const GRACE_BLOCK_MESSAGE: Record<GraceBlock, string> = {
  disabled: 'Os dias de graça estão desativados nas Configurações.',
  future: 'Não é possível usar dia de graça em um dia futuro.',
  'too-old': `Só é possível usar dia de graça nos últimos ${GRACE_WINDOW_DAYS} dias.`,
  'not-scheduled': 'Este hábito não estava agendado neste dia.',
  completed: 'Este dia já foi concluído.',
  'week-met': 'A meta desta semana já foi cumprida.',
  already: 'Este dia já usa um dia de graça.',
  'no-quota': 'Seus dias de graça deste mês já acabaram para este hábito.'
};

/** Adiciona (sem duplicar) */
export function addGrace(graces: GracesMap, dateKey: string, habitId: string): GracesMap {
  const current = graces[dateKey] || [];
  if (current.includes(habitId)) return graces;
  return { ...graces, [dateKey]: [...current, habitId] };
}

/** Remove (devolve a cota) e descarta o dia quando fica vazio */
export function removeGrace(graces: GracesMap, dateKey: string, habitId: string): GracesMap {
  const current = graces[dateKey];
  if (!current || !current.includes(habitId)) return graces;
  const rest = current.filter((id) => id !== habitId);
  const next = { ...graces };
  if (rest.length > 0) next[dateKey] = rest;
  else delete next[dateKey];
  return next;
}

/** Valida dados vindos do armazenamento */
export function sanitizeGraces(raw: unknown): GracesMap {
  if (!raw || typeof raw !== 'object') return {};
  const out: GracesMap = {};
  for (const [key, ids] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Array.isArray(ids)) continue;
    const clean = [...new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0))];
    if (clean.length > 0) out[key] = clean;
  }
  return out;
}
