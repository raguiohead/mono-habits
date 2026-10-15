import { type PomoKind, type PomoSession } from '@/types/habit';
import { toDateKey } from './dateUtils';

export const FOCUS_BEFORE_LONG_BREAK = 4;

export interface PomoDurations {
  focus: number; // minutos
  short: number;
  long: number;
}

export const DEFAULT_DURATIONS: PomoDurations = { focus: 25, short: 5, long: 15 };

export const MIN_MINUTES = 1;
export const MAX_MINUTES = 180;

export const PRESETS: Record<PomoKind, number[]> = {
  focus: [15, 25, 45, 60, 90],
  short: [3, 5, 10],
  long: [10, 15, 20, 30]
};

export const KIND_LABEL: Record<PomoKind, string> = {
  focus: 'Foco',
  short: 'Pausa',
  long: 'Pausa longa'
};

export function clampMinutes(value: number): number {
  if (!Number.isFinite(value)) return MIN_MINUTES;
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(value)));
}

/** Formata segundos como MM:SS (ou H:MM:SS a partir de 1h) */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Formata uma duração em segundos como "1h40", "25min" ou "40s" */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h === 0) return `${m}min`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

/**
 * Define a próxima etapa do ciclo clássico:
 * a cada 4 focos concluídos vem a pausa longa, senão a pausa curta.
 * `cycleCount` já deve incluir o foco que acabou de terminar.
 */
export function getNextKind(
  finished: PomoKind,
  cycleCount: number
): { kind: PomoKind; cycleCount: number } {
  if (finished === 'focus') {
    return cycleCount >= FOCUS_BEFORE_LONG_BREAK
      ? { kind: 'long', cycleCount }
      : { kind: 'short', cycleCount };
  }
  return {
    kind: 'focus',
    cycleCount: finished === 'long' ? 0 : cycleCount
  };
}

export interface PomoDaySummary {
  focusSessions: number; // focos concluídos
  focusSeconds: number; // tempo real de foco (inclui parciais)
  interrupted: number;
}

export function summarizeDay(sessions: PomoSession[], dateKey: string): PomoDaySummary {
  const summary: PomoDaySummary = { focusSessions: 0, focusSeconds: 0, interrupted: 0 };
  for (const s of sessions) {
    if (toDateKey(new Date(s.startedAt)) !== dateKey) continue;
    if (!s.completed) summary.interrupted++;
    if (s.kind !== 'focus') continue;
    summary.focusSeconds += s.actualSeconds;
    if (s.completed) summary.focusSessions++;
  }
  return summary;
}

/** Ordena da mais recente para a mais antiga */
export function sortSessions(sessions: PomoSession[]): PomoSession[] {
  return [...sessions].sort((a, b) => b.startedAt - a.startedAt);
}
