import type { Habit, HeatmapDay, LogsMap, PomoSession } from '@/types/habit';
import { parseDateKey } from './dateUtils';

export const CARD_W = 1080;
export const CARD_H = 1350;

export type ShareTheme = 'light' | 'dark';

// ---------- Níveis e cores (monocromático) ----------

export type GridLevel = 0 | 1 | 2 | 3 | 4;

/** Mesmos limites da grade do app (getHeatmapCellClass); 0 = sem nada agendado ou 0% */
export function ratioLevel(ratio: number, scheduled: number): GridLevel {
  if (!(scheduled > 0) || !(ratio > 0)) return 0;
  if (ratio <= 0.35) return 1;
  if (ratio <= 0.7) return 2;
  if (ratio < 1) return 3;
  return 4;
}

export interface SharePalette {
  bg: string;
  fg: string;
  muted: string;
  levels: [string, string, string, string, string];
}

export const PALETTES: Record<ShareTheme, SharePalette> = {
  dark: {
    bg: '#09090b',
    fg: '#fafafa',
    muted: '#a1a1aa',
    levels: ['#27272a', '#52525b', '#a1a1aa', '#e4e4e7', '#fafafa']
  },
  light: {
    bg: '#fafafa',
    fg: '#09090b',
    muted: '#52525b',
    levels: ['#e4e4e7', '#a1a1aa', '#71717a', '#3f3f46', '#09090b']
  }
};

// ---------- Layout da grade (coordenadas puras) ----------

export interface GridCell {
  key: string;
  col: number;
  row: number;
  x: number;
  y: number;
  size: number;
  level: GridLevel;
}

export interface GridLayout {
  cells: GridCell[];
  cell: number;
  cols: number;
  /** Retângulo realmente ocupado (centralizado na área) */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GridDay {
  key: string;
  ratio: number;
  scheduled: number;
}

const DAY_MS = 86400000;
const mondayIndex = (d: Date) => (d.getDay() + 6) % 7;

/**
 * Colunas = semanas (segunda a domingo), linhas = dias da semana, como o Grafo de 90/365 dias.
 * O tamanho da célula cabe na área e é limitado por `maxCell`; a grade é centralizada.
 */
export function layoutGrid(
  days: GridDay[],
  area: { x: number; y: number; w: number; h: number },
  opts: { maxCell?: number; gap?: number } = {}
): GridLayout {
  const gapRatio = opts.gap ?? 0.18;
  const maxCell = opts.maxCell ?? 120;
  if (days.length === 0) return { cells: [], cell: 0, cols: 0, x: area.x, y: area.y, width: 0, height: 0 };

  const first = parseDateKey(days[0].key);
  const firstMonday = new Date(first.getFullYear(), first.getMonth(), first.getDate() - mondayIndex(first));
  const placed = days.map((d) => {
    const date = parseDateKey(d.key);
    const offset = Math.round((date.getTime() - firstMonday.getTime()) / DAY_MS);
    return { d, col: Math.floor(offset / 7), row: mondayIndex(date) };
  });
  const cols = Math.max(...placed.map((p) => p.col)) + 1;

  const byWidth = area.w / (cols + (cols - 1) * gapRatio);
  const byHeight = area.h / (7 + 6 * gapRatio);
  const cell = Math.max(1, Math.floor(Math.min(byWidth, byHeight, maxCell)));
  const gap = cell * gapRatio;
  const width = cols * cell + (cols - 1) * gap;
  const height = 7 * cell + 6 * gap;
  const x0 = area.x + (area.w - width) / 2;
  const y0 = area.y + (area.h - height) / 2;

  return {
    cell,
    cols,
    x: x0,
    y: y0,
    width,
    height,
    cells: placed.map(({ d, col, row }) => ({
      key: d.key,
      col,
      row,
      x: x0 + col * (cell + gap),
      y: y0 + row * (cell + gap),
      size: cell,
      level: ratioLevel(d.ratio, d.scheduled)
    }))
  };
}

// ---------- Formatação ----------

export const formatPercent = (rate: number): string => `${Math.round(Math.min(100, Math.max(0, rate)))}%`;

export const formatInt = (n: number): string => Math.round(n).toLocaleString('pt-BR');

/** Menos de 1 h em minutos; a partir de 1 h em horas com uma casa ("12,5 h") */
export function formatHours(seconds: number): string {
  const s = Math.max(0, seconds);
  if (s < 3600) return `${Math.round(s / 60)} min`;
  return `${(Math.round((s / 3600) * 10) / 10).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`;
}

export const WEEKDAY_NAMES = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

// ---------- Estatísticas ----------

export function toGridDays(days: HeatmapDay[]): GridDay[] {
  return days.map((d) => ({ key: d.key, ratio: d.ratio, scheduled: d.scheduledCount }));
}

export interface WeekdayStrength {
  dow: number; // 0 = domingo
  rate: number; // 0-100
}

/** Dia da semana com a maior taxa de conclusão (mínimo de agendamentos para valer) */
export function strongestWeekday(days: HeatmapDay[], minScheduled = 4): WeekdayStrength | null {
  const sched = Array(7).fill(0) as number[];
  const done = Array(7).fill(0) as number[];
  for (const d of days) {
    const dow = d.date.getDay();
    sched[dow] += d.scheduledCount;
    done[dow] += d.completedCount;
  }
  let best: WeekdayStrength | null = null;
  for (let dow = 0; dow < 7; dow++) {
    if (sched[dow] < minScheduled) continue;
    const rate = (done[dow] / sched[dow]) * 100;
    if (!best || rate > best.rate) best = { dow, rate };
  }
  return best;
}

export interface WrappedStats {
  perfectDays: number;
  bestStreak: number;
  focusSessions: number;
  focusSeconds: number;
  strongest: WeekdayStrength | null;
}

/** Números do período do Wrapped; só sessões de foco concluídas dentro do período contam */
export function buildWrappedStats(
  days: HeatmapDay[],
  sessions: PomoSession[],
  bestStreak: number
): WrappedStats {
  const startMs = days.length > 0 ? days[0].date.getTime() : 0;
  const startOfFirst = new Date(startMs);
  startOfFirst.setHours(0, 0, 0, 0);
  const focus = sessions.filter((s) => s.kind === 'focus' && s.completed && s.startedAt >= startOfFirst.getTime());
  return {
    perfectDays: days.filter((d) => d.scheduledCount > 0 && d.completedCount === d.scheduledCount).length,
    bestStreak,
    focusSessions: focus.length,
    focusSeconds: focus.reduce((sum, s) => sum + Math.max(0, s.actualSeconds), 0),
    strongest: strongestWeekday(days)
  };
}

/** Dias entre o primeiro dado (criação de hábito ou primeiro check-in) e hoje */
export function dataSpanDays(habits: Habit[], logs: LogsMap, now: Date): number {
  const times: number[] = [];
  for (const h of habits) if (h.createdAt > 0) times.push(h.createdAt);
  for (const key of Object.keys(logs)) if ((logs[key] || []).length > 0) times.push(parseDateKey(key).getTime());
  if (times.length === 0) return 0;
  const first = new Date(Math.min(...times));
  const a = new Date(first.getFullYear(), first.getMonth(), first.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.max(0, Math.round((b - a) / DAY_MS));
}

/** Visível em dezembro ou com pelo menos 60 dias de dados */
export function isWrappedAvailable(now: Date, spanDays: number): boolean {
  return now.getMonth() === 11 || spanDays >= 60;
}

/** Em dezembro, o ano corrente até hoje; nos demais meses, os últimos 365 dias */
export function wrappedPeriod(now: Date): { days: number; label: string } {
  if (now.getMonth() === 11) {
    const start = new Date(now.getFullYear(), 0, 1).getTime();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return { days: Math.round((today - start) / DAY_MS) + 1, label: String(now.getFullYear()) };
  }
  return { days: 365, label: 'Últimos 365 dias' };
}

// ---------- Cartões ----------

export type ShareCardSpec =
  | {
      kind: 'grid';
      theme: ShareTheme;
      title: string; // ex.: "Últimos 30 dias"
      days: GridDay[];
      rate: number;
      bestStreak: number;
      habitCount?: number; // só quando o usuário escolher incluir
    }
  | {
      kind: 'numbers';
      theme: ShareTheme;
      title: string;
      items: { label: string; value: string }[];
      habitCount?: number;
    }
  | {
      kind: 'weekday';
      theme: ShareTheme;
      title: string;
      weekday: string | null;
      rate: number;
      habitCount?: number;
    };

/** Cartões do Wrapped: ano em grade, números do ano e dia da semana mais forte */
export function buildWrappedCards(
  theme: ShareTheme,
  title: string,
  days: HeatmapDay[],
  rate: number,
  stats: WrappedStats,
  habitCount?: number
): ShareCardSpec[] {
  const base = habitCount !== undefined ? { habitCount } : {};
  return [
    { kind: 'grid', theme, title, days: toGridDays(days), rate, bestStreak: stats.bestStreak, ...base },
    {
      kind: 'numbers',
      theme,
      title,
      items: [
        { label: 'dias perfeitos', value: formatInt(stats.perfectDays) },
        { label: 'melhor ofensiva', value: `${formatInt(stats.bestStreak)} ${stats.bestStreak === 1 ? 'dia' : 'dias'}` },
        { label: 'sessões de foco', value: formatInt(stats.focusSessions) },
        { label: 'tempo focado', value: formatHours(stats.focusSeconds) }
      ],
      ...base
    },
    {
      kind: 'weekday',
      theme,
      title,
      weekday: stats.strongest ? WEEKDAY_NAMES[stats.strongest.dow] : null,
      rate: stats.strongest ? stats.strongest.rate : 0,
      ...base
    }
  ];
}
