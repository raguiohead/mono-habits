export type TextSize = 'normal' | 'large' | 'xlarge';
export type FocusLayout = 'list' | 'bento';
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
    focusLayout: p.focusLayout === 'bento' ? 'bento' : 'list',
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
