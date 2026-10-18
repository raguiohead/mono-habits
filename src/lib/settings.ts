import { type Habit, type LogsMap, type SlipsMap } from '@/types/habit';
import { getHabitsForDate } from './analytics';
import { addDays, toDateKey } from './dateUtils';
import { isDueOn } from './weekly';
import { buildWeeklySummary } from './weeklySummary';

export type TextSize = 'normal' | 'large' | 'xlarge';
export type FocusLayout = 'list' | 'bento' | 'gallery';
export const FOCUS_LAYOUTS: readonly FocusLayout[] = ['list', 'bento', 'gallery'];
export type MotionPref = 'system' | 'reduce' | 'full';

export interface AppSettings {
  // Acessibilidade
  textSize: TextSize;
  motion: MotionPref;
  highContrast: boolean;
  // Aparência
  focusLayout: FocusLayout; // lista de hábitos do Foco
  // Ofensiva
  graceDaysPerMonth: 0 | 1 | 2; // dias de graça por hábito, por mês
  // Notificações
  reminderEnabled: boolean;
  reminderTime: string; // 'HH:MM'
  weeklySummaryInReminder: boolean; // domingo: acrescenta ao lembrete a taxa da semana (sem nomes de hábitos)
  pomoAlerts: boolean; // notificação do sistema ao fim de uma sessão do Pomo
  sound: boolean;
  vibration: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  textSize: 'normal',
  motion: 'system',
  highContrast: false,
  focusLayout: 'list',
  graceDaysPerMonth: 1,
  reminderEnabled: false,
  reminderTime: '20:00',
  weeklySummaryInReminder: false,
  pomoAlerts: true,
  sound: true,
  vibration: true
};

/** Tamanho-base da fonte (px) por nível; o Tailwind usa rem, então tudo escala junto */
export const TEXT_SIZE_PX: Record<TextSize, number> = { normal: 16, large: 18, xlarge: 20 };

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && TIME_RE.test(value);
}

/** Valida dados vindos do localStorage, caindo para o padrão em campos inválidos */
export function sanitizeSettings(raw: unknown): AppSettings {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
  const d = DEFAULT_SETTINGS;
  return {
    textSize: p.textSize === 'large' || p.textSize === 'xlarge' ? p.textSize : 'normal',
    motion: p.motion === 'reduce' || p.motion === 'full' ? p.motion : 'system',
    highContrast: bool(p.highContrast, d.highContrast),
    focusLayout: FOCUS_LAYOUTS.includes(p.focusLayout as FocusLayout) ? (p.focusLayout as FocusLayout) : 'list',
    graceDaysPerMonth: p.graceDaysPerMonth === 0 || p.graceDaysPerMonth === 2 ? p.graceDaysPerMonth : 1,
    reminderEnabled: bool(p.reminderEnabled, d.reminderEnabled),
    reminderTime: isValidTime(p.reminderTime) ? p.reminderTime : d.reminderTime,
    weeklySummaryInReminder: bool(p.weeklySummaryInReminder, d.weeklySummaryInReminder),
    pomoAlerts: bool(p.pomoAlerts, d.pomoAlerts),
    sound: bool(p.sound, d.sound),
    vibration: bool(p.vibration, d.vibration)
  };
}

/**
 * Decide se o lembrete diário deve disparar agora:
 * já passou do horário, ainda não foi enviado hoje e há hábitos pendentes.
 */
export function shouldSendReminder(opts: {
  now: Date;
  time: string;
  lastSentKey: string | null;
  todayKey: string;
  pendingCount: number;
  /** Envia mesmo sem hábitos pendentes (ex.: domingo com o resumo semanal) */
  allowEmpty?: boolean;
}): boolean {
  if ((opts.pendingCount <= 0 && !opts.allowEmpty) || opts.lastSentKey === opts.todayKey) return false;
  if (!isValidTime(opts.time)) return false;
  const [h, m] = opts.time.split(':').map(Number);
  const minutesNow = opts.now.getHours() * 60 + opts.now.getMinutes();
  return minutesNow >= h * 60 + m;
}

export interface NativeReminderPlanItem {
  offset: number; // 0..6 (ID = 1000 + offset)
  dateKey: string;
  at: Date;
  body: string;
}

export interface NativeReminderPlanResult {
  immediate: { dateKey: string; body: string } | null;
  scheduled: NativeReminderPlanItem[];
  /** Se o agendamento prévio de hoje já foi entregue pelo sistema Android (marca `lastSentKey`) */
  markSentKey: string | null;
  /** Próximo estado do registro de agendamento de hoje (`{ dateKey, time }` quando offset 0 é agendado, `null` caso contrário) */
  nextScheduledToday: { dateKey: string; time: string } | null;
  /** True quando não há mais pendentes hoje (nem resumo de domingo), para remover notificação já entregue do dia */
  clearDeliveredToday: boolean;
}

/**
 * Monta o plano de lembretes nativos para os próximos 7 dias (hoje + 6 dias).
 * - Hoje (offset 0):
 *   - Se o horário já passou: se `scheduledToday` bate com `<todayKey, reminderTime>`, a notificação
 *     agendada já foi entregue pelo sistema Android -> define `markSentKey = todayKey` e não dispara `immediate`.
 *     Caso contrário, usa `shouldSendReminder` para decidir `immediate`.
 *   - Se ainda não passou e há pendentes (ou resumo de domingo): agenda em `scheduled` (offset 0) e grava `nextScheduledToday`.
 * - Dias futuros (offset 1..6): conta hábitos previstos (`getHabitsForDate` + `isDueOn`, `kind !== 'avoid'`),
 *   assumindo nada feito ainda naquele dia futuro. Pula dias com 0 previsto.
 *   O resumo semanal em domingos futuros é omitido para evitar exibir uma taxa calculada antes de a semana acabar.
 */
export function buildNativeReminderPlan(opts: {
  now: Date;
  reminderEnabled: boolean;
  reminderTime: string;
  weeklySummaryInReminder: boolean;
  lastSentKey: string | null;
  scheduledToday?: { dateKey: string; time: string } | null;
  habits: Habit[];
  logs: LogsMap;
  slips?: SlipsMap;
}): NativeReminderPlanResult {
  if (!opts.reminderEnabled || !isValidTime(opts.reminderTime)) {
    return {
      immediate: null,
      scheduled: [],
      markSentKey: null,
      nextScheduledToday: null,
      clearDeliveredToday: false
    };
  }

  const [h, m] = opts.reminderTime.split(':').map(Number);
  const { now, habits, logs, slips = {} } = opts;
  const todayKey = toDateKey(now);

  // Hoje (offset 0)
  const scheduledTodayHabits = getHabitsForDate(habits, now).filter(
    (hab) => hab.kind !== 'avoid' && isDueOn(hab, now, logs)
  );
  const doneToday = logs[todayKey] || [];
  const pendingTodayCount = scheduledTodayHabits.filter((hab) => !doneToday.includes(hab.id)).length;

  let summaryLineToday: string | null = null;
  if (opts.weeklySummaryInReminder && now.getDay() === 0) {
    const summary = buildWeeklySummary(habits, logs, now, { slips, today: addDays(now, 1) });
    if (summary.rate !== null) summaryLineToday = summary.sentences[0];
  }

  const formatBody = (count: number, summary: string | null): string =>
    [
      count === 0
        ? null
        : count === 1
        ? 'Falta 1 hábito para hoje.'
        : `Faltam ${count} hábitos para hoje.`,
      summary
    ]
      .filter(Boolean)
      .join(' ');

  const todayAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
  let immediate: { dateKey: string; body: string } | null = null;
  let markSentKey: string | null = null;
  let nextScheduledToday: { dateKey: string; time: string } | null = null;
  const scheduled: NativeReminderPlanItem[] = [];
  const clearDeliveredToday = pendingTodayCount === 0 && summaryLineToday === null;

  const wasAlreadyScheduledForToday =
    opts.scheduledToday?.dateKey === todayKey && opts.scheduledToday?.time === opts.reminderTime;

  if (now.getTime() >= todayAt.getTime()) {
    if (wasAlreadyScheduledForToday) {
      markSentKey = todayKey;
    } else if (
      shouldSendReminder({
        now,
        time: opts.reminderTime,
        lastSentKey: opts.lastSentKey,
        todayKey,
        pendingCount: pendingTodayCount,
        allowEmpty: summaryLineToday !== null
      })
    ) {
      immediate = { dateKey: todayKey, body: formatBody(pendingTodayCount, summaryLineToday) };
      markSentKey = todayKey;
    }
  } else if (pendingTodayCount > 0 || summaryLineToday !== null) {
    scheduled.push({
      offset: 0,
      dateKey: todayKey,
      at: todayAt,
      body: formatBody(pendingTodayCount, summaryLineToday)
    });
    nextScheduledToday = { dateKey: todayKey, time: opts.reminderTime };
  }

  // Dias futuros (offset 1..6)
  for (let offset = 1; offset <= 6; offset++) {
    const d = addDays(now, offset);
    const dateKey = toDateKey(d);
    // Logs sem entradas no dia futuro (nada feito ainda naquele dia)
    const futureLogs: LogsMap = { ...logs, [dateKey]: [] };
    const plannedCount = getHabitsForDate(habits, d).filter(
      (hab) => hab.kind !== 'avoid' && isDueOn(hab, d, futureLogs)
    ).length;

    if (plannedCount <= 0) continue;

    const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0);
    scheduled.push({
      offset,
      dateKey,
      at,
      body: formatBody(plannedCount, null)
    });
  }

  return {
    immediate,
    scheduled,
    markSentKey,
    nextScheduledToday,
    clearDeliveredToday
  };
}

