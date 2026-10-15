import { type Habit, type LogsMap, type GracesMap, type WeeklyTargetEntry } from '@/types/habit';
import { addDays, parseDateKey, toDateKey } from './dateUtils';

export const MIN_WEEKLY_TARGET = 1;
export const MAX_WEEKLY_TARGET = 7;

/** Quantas metas antigas guardar no cronograma */
const MAX_SCHEDULE_ENTRIES = 20;

// ---------- Semana (segunda a domingo, igual ao WeeklyStrip) ----------

/** Segunda-feira 00:00 da semana da data */
export function weekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export const weekStartKey = (date: Date): string => toDateKey(weekStart(date));

/** As 7 chaves de dia (segunda a domingo) da semana que começa em `weekKey` */
export function weekDayKeys(weekKey: string): string[] {
  const monday = parseDateKey(weekKey);
  return Array.from({ length: 7 }, (_, i) => toDateKey(addDays(monday, i)));
}

export const previousWeekKey = (weekKey: string): string => toDateKey(addDays(parseDateKey(weekKey), -7));
export const nextWeekKey = (weekKey: string): string => toDateKey(addDays(parseDateKey(weekKey), 7));

// ---------- Meta semanal e cronograma ----------

/** Valida a meta (1 a 7, inteiro); undefined se inválida */
export function normalizeWeeklyTarget(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.min(MAX_WEEKLY_TARGET, Math.max(MIN_WEEKLY_TARGET, Math.round(value)));
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Cronograma de metas em ordem. Dados sem `weeklyTargets` (só `weeklyTarget`) valem desde sempre,
 * ou desde `weeklyTargetFrom` quando existir.
 */
export function getWeeklySchedule(habit: Habit): WeeklyTargetEntry[] {
  if (Array.isArray(habit.weeklyTargets)) {
    const entries = habit.weeklyTargets
      .map((e) => ({ from: e?.from, target: normalizeWeeklyTarget(e?.target) }))
      .filter((e): e is WeeklyTargetEntry => typeof e.from === 'string' && DATE_KEY_RE.test(e.from) && e.target !== undefined)
      .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
    if (entries.length > 0) return entries;
  }
  const target = normalizeWeeklyTarget(habit.weeklyTarget);
  if (target === undefined) return [];
  const from = typeof habit.weeklyTargetFrom === 'string' && DATE_KEY_RE.test(habit.weeklyTargetFrom)
    ? habit.weeklyTargetFrom
    : '0000-01-01';
  return [{ from, target }];
}

/** Meta que vale na semana (null = a semana é anterior ao modo semanal, ou o hábito não é semanal) */
export function targetForWeek(habit: Habit, weekKey: string): number | null {
  let result: number | null = null;
  for (const entry of getWeeklySchedule(habit)) {
    if (entry.from <= weekKey) result = entry.target;
  }
  return result;
}

/** O hábito segue meta semanal na semana desta data? Antes disso ele segue os dias fixos */
export function isWeeklyOn(habit: Habit, date: Date): boolean {
  return targetForWeek(habit, weekStartKey(date)) !== null;
}

/** O hábito tem uma meta semanal configurada (hoje ou agendada)? */
export function hasWeeklyTarget(habit: Habit): boolean {
  return getWeeklySchedule(habit).length > 0;
}

export interface WeeklyFields {
  weeklyTarget?: number;
  weeklyTargetFrom?: string;
  weeklyTargets?: WeeklyTargetEntry[];
}

/**
 * Calcula os campos semanais ao salvar o hábito:
 * - sem meta (dias fixos): remove tudo;
 * - virou semanal (ou é novo): vale desde a semana atual;
 * - mudou a meta: a nova vale a partir da PRÓXIMA semana (a atual mantém a anterior);
 * - nova mudança antes dessa segunda-feira: substitui a mudança pendente (ou a cancela).
 */
export function applyWeeklyTargetChange(prev: Habit | undefined, newTarget: unknown, today: Date): WeeklyFields {
  const target = normalizeWeeklyTarget(newTarget);
  if (target === undefined) return {};

  const thisWeek = weekStartKey(today);
  let schedule = prev ? getWeeklySchedule(prev) : [];

  if (schedule.length === 0) {
    schedule = [{ from: thisWeek, target }];
  } else {
    const last = schedule[schedule.length - 1];
    if (last.from > thisWeek) {
      // Mudança pendente: substitui (ou cancela, se voltar à meta que vale hoje)
      const before = schedule[schedule.length - 2];
      schedule =
        before && before.target === target
          ? schedule.slice(0, -1)
          : [...schedule.slice(0, -1), { from: last.from, target }];
    } else if (last.target !== target) {
      schedule = [...schedule, { from: nextWeekKey(thisWeek), target }];
    }
  }

  schedule = schedule.slice(-MAX_SCHEDULE_ENTRIES);
  const latest = schedule[schedule.length - 1];
  return { weeklyTarget: latest.target, weeklyTargetFrom: latest.from, weeklyTargets: schedule };
}

// ---------- Contagem e situação da semana ----------

/** Dias da semana em que o hábito foi concluído */
export function weeklyCount(habit: Habit, weekKey: string, logs: LogsMap): number {
  return weekDayKeys(weekKey).filter((k) => (logs[k] || []).includes(habit.id)).length;
}

/** Alguma graça usada nesta semana para o hábito (a semana não cumprida fica perdoada) */
export function weekGraced(habit: Habit, weekKey: string, graces: GracesMap): boolean {
  return weekDayKeys(weekKey).some((k) => (graces[k] || []).includes(habit.id));
}

export interface WeekStatus {
  target: number;
  count: number;
  met: boolean;
  graced: boolean;
}

export function weekStatus(habit: Habit, weekKey: string, logs: LogsMap, graces: GracesMap = {}): WeekStatus | null {
  const target = targetForWeek(habit, weekKey);
  if (target === null) return null;
  const count = weeklyCount(habit, weekKey, logs);
  return { target, count, met: count >= target, graced: weekGraced(habit, weekKey, graces) };
}

/** Primeira semana do hábito (a da criação); '' quando não há data de criação confiável */
function firstWeekKey(habit: Habit): string {
  return habit.createdAt && habit.createdAt > 0 ? weekStartKey(new Date(habit.createdAt)) : '';
}

// ---------- Agendamento ----------

/** O hábito aparece na lista do dia? (semanal: todos os dias; fixo: pelos dias da semana) */
export function isScheduledOn(habit: Habit, date: Date): boolean {
  if (habit.archived) return false;
  return isWeeklyOn(habit, date) || (habit.frequency || []).includes(date.getDay());
}

/**
 * O hábito ainda "conta" no dia (progresso, lembretes)? Hábitos fixos: sempre que agendados.
 * Semanais: se foi concluído no dia ou se a meta da semana ainda não foi cumprida.
 */
export function isDueOn(habit: Habit, date: Date, logs: LogsMap): boolean {
  if (!isScheduledOn(habit, date)) return false;
  if (!isWeeklyOn(habit, date)) return true;
  if ((logs[toDateKey(date)] || []).includes(habit.id)) return true;
  const status = weekStatus(habit, weekStartKey(date), logs);
  return status ? !status.met : false;
}

// ---------- Ofensiva em semanas ----------

/**
 * Semanas consecutivas cumpridas até agora. A semana em andamento não quebra a ofensiva
 * (se já cumpriu a meta, soma). Semana perdoada por dia de graça não quebra nem soma.
 */
export function calculateWeeklyStreak(
  habit: Habit,
  logs: LogsMap,
  today: Date = new Date(),
  graces: GracesMap = {}
): number {
  const thisWeek = weekStartKey(today);
  const first = firstWeekKey(habit);
  let streak = 0;

  const current = weekStatus(habit, thisWeek, logs, graces);
  if (current?.met) streak++;

  let week = thisWeek;
  for (let i = 0; i < 520; i++) {
    week = previousWeekKey(week);
    if (first && week < first) break;
    const st = weekStatus(habit, week, logs, graces);
    if (!st) break; // antes do modo semanal
    if (st.met) streak++;
    else if (!st.graced) break;
  }
  return streak;
}

/** Maior sequência histórica de semanas cumpridas */
export function calculateBestWeeklyStreak(
  habit: Habit,
  logs: LogsMap,
  today: Date = new Date(),
  graces: GracesMap = {}
): number {
  const thisWeek = weekStartKey(today);
  const schedule = getWeeklySchedule(habit);
  if (schedule.length === 0) return 0;

  // Começa na semana mais antiga conhecida: criação, primeiro registro ou início do modo semanal
  let start = firstWeekKey(habit) || thisWeek;
  for (const [dateKey, ids] of Object.entries(logs)) {
    if (ids.includes(habit.id)) {
      const wk = weekStartKey(parseDateKey(dateKey));
      if (wk < start) start = wk;
    }
  }
  if (schedule[0].from > start && schedule[0].from <= thisWeek) start = schedule[0].from;
  if (start < '2020-01-06') start = '2020-01-06';

  let current = 0;
  let best = 0;
  let week = start;
  for (let i = 0; i < 1100 && week <= thisWeek; i++) {
    const st = weekStatus(habit, week, logs, graces);
    if (!st) {
      current = 0;
    } else if (st.met) {
      current++;
      best = Math.max(best, current);
    } else if (week !== thisWeek && !st.graced) {
      current = 0;
    }
    week = nextWeekKey(week);
  }
  return Math.max(best, calculateWeeklyStreak(habit, logs, today, graces));
}

// ---------- Taxa de conclusão (a semana é sucesso ou falha, não cada dia) ----------

/**
 * Resultado de uma semana já encerrada para a taxa: null se não conta.
 * A semana da criação só entra se foi cumprida (evita falha injusta em semana parcial);
 * uma semana perdoada por graça conta como não cumprida (a graça não vale como conclusão).
 */
export function weekOutcome(
  habit: Habit,
  weekKey: string,
  logs: LogsMap,
  today: Date
): { met: boolean } | null {
  const sunday = toDateKey(addDays(parseDateKey(weekKey), 6));
  if (sunday >= toDateKey(today)) return null; // ainda em andamento
  const st = weekStatus(habit, weekKey, logs);
  if (!st) return null;
  if (firstWeekKey(habit) === weekKey && !st.met) return null;
  return { met: st.met };
}
