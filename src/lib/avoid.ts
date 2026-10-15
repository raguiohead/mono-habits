import { type Habit, type HabitKind, type LogsMap, type SlipsMap } from '@/types/habit';
import { addDays, parseDateKey, toDateKey } from './dateUtils';

/**
 * Hábitos a evitar: lógica invertida. NÃO usam `logs`: só os escorregões (`slips`) são registrados.
 * Um dia agendado (>= criação) sem escorregão é um dia de sucesso; hoje fica "em andamento" e já
 * conta como sucesso corrente na ofensiva.
 */

export function normalizeKind(value: unknown): HabitKind {
  return value === 'avoid' ? 'avoid' : 'build';
}

export const isAvoid = (habit: Habit): boolean => habit.kind === 'avoid';

export function isSlipped(slips: SlipsMap, dateKey: string, habitId: string): boolean {
  return (slips[dateKey] || []).includes(habitId);
}

/** Primeiro dia do hábito (dia da criação); '' se não houver data de criação confiável */
function createdDayKey(habit: Habit): string {
  return habit.createdAt && habit.createdAt > 0 ? toDateKey(new Date(habit.createdAt)) : '';
}

/** O hábito a evitar vale neste dia? (dia da semana agendado, ativo e a partir da criação) */
export function isAvoidScheduled(habit: Habit, date: Date): boolean {
  if (habit.archived) return false;
  if (!(habit.frequency || []).includes(date.getDay())) return false;
  const created = createdDayKey(habit);
  return !created || toDateKey(date) >= created;
}

export type AvoidDayStatus = 'clean' | 'slipped' | 'in-progress' | 'future' | 'n/a';

/** Situação do dia: limpo, escorregou, em andamento (hoje sem escorregão), futuro ou fora do período */
export function avoidDayStatus(habit: Habit, dateKey: string, today: Date, slips: SlipsMap): AvoidDayStatus {
  const todayKey = toDateKey(today);
  if (dateKey > todayKey) return 'future';
  if (!isAvoidScheduled(habit, parseDateKey(dateKey))) return 'n/a';
  if (isSlipped(slips, dateKey, habit.id)) return 'slipped';
  return dateKey === todayKey ? 'in-progress' : 'clean';
}

/** Só dá para registrar escorregão em dia agendado, já existente e que não seja futuro */
export function canSlipOn(habit: Habit, dateKey: string, today: Date): boolean {
  if (!isAvoid(habit)) return false;
  if (dateKey > toDateKey(today)) return false;
  return isAvoidScheduled(habit, parseDateKey(dateKey));
}

/**
 * Dias consecutivos sem escorregão até hoje (hoje conta como sucesso corrente).
 * Dias não agendados não quebram nem somam; um escorregão em dia agendado encerra a sequência.
 */
export function calculateAvoidStreak(habit: Habit, slips: SlipsMap, today: Date = new Date()): number {
  const created = createdDayKey(habit);
  let streak = 0;
  let cursor = parseDateKey(toDateKey(today));
  for (let i = 0; i < 4000; i++) {
    const key = toDateKey(cursor);
    if (created && key < created) break;
    if (!created && i >= 365) break; // sem data de criação: limita a janela
    if ((habit.frequency || []).includes(cursor.getDay())) {
      if (isSlipped(slips, key, habit.id)) break;
      streak++;
    }
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Maior sequência histórica sem escorregão (desde a criação até hoje) */
export function calculateBestAvoidStreak(habit: Habit, slips: SlipsMap, today: Date = new Date()): number {
  const created = createdDayKey(habit);
  const todayDate = parseDateKey(toDateKey(today));
  let start = created ? parseDateKey(created) : addDays(todayDate, -365);
  if (start.getTime() < new Date(2020, 0, 1).getTime()) start = new Date(2020, 0, 1);
  if (start.getTime() > todayDate.getTime()) start = todayDate;

  let current = 0;
  let best = 0;
  for (let cursor = start; cursor.getTime() <= todayDate.getTime(); cursor = addDays(cursor, 1)) {
    if (!(habit.frequency || []).includes(cursor.getDay())) continue;
    if (isSlipped(slips, toDateKey(cursor), habit.id)) {
      current = 0;
    } else {
      current++;
      best = Math.max(best, current);
    }
  }
  return best;
}

/**
 * Ids "feitos" do dia para o progresso: check-ins dos hábitos a construir + hábitos a evitar do dia
 * que seguem limpos (feitos por padrão). Dia futuro não conta como limpo; logs de hábito a evitar são ignorados.
 */
export function getEffectiveCompletedIds(
  habits: Habit[],
  dateKey: string,
  logs: LogsMap,
  slips: SlipsMap,
  today: Date
): string[] {
  const avoidIds = new Set(habits.filter(isAvoid).map((h) => h.id));
  const fromLogs = (logs[dateKey] || []).filter((id) => !avoidIds.has(id));
  const date = parseDateKey(dateKey);
  const clean = habits
    .filter(isAvoid)
    .filter((h) => dateKey <= toDateKey(today) && isAvoidScheduled(h, date) && !isSlipped(slips, dateKey, h.id))
    .map((h) => h.id);
  return [...fromLogs, ...clean];
}

/** Adiciona um escorregão (sem duplicar) */
export function addSlip(slips: SlipsMap, dateKey: string, habitId: string): SlipsMap {
  const current = slips[dateKey] || [];
  if (current.includes(habitId)) return slips;
  return { ...slips, [dateKey]: [...current, habitId] };
}

/** Remove um escorregão e descarta o dia quando fica vazio */
export function removeSlip(slips: SlipsMap, dateKey: string, habitId: string): SlipsMap {
  const current = slips[dateKey];
  if (!current || !current.includes(habitId)) return slips;
  const rest = current.filter((id) => id !== habitId);
  const next = { ...slips };
  if (rest.length > 0) next[dateKey] = rest;
  else delete next[dateKey];
  return next;
}

/** Valida dados vindos do armazenamento */
export function sanitizeSlips(raw: unknown): SlipsMap {
  if (!raw || typeof raw !== 'object') return {};
  const out: SlipsMap = {};
  for (const [key, ids] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Array.isArray(ids)) continue;
    const clean = [...new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0))];
    if (clean.length > 0) out[key] = clean;
  }
  return out;
}
