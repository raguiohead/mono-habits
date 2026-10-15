/** Período do dia em que o hábito costuma acontecer ('any' = sem horário definido) */
export type HabitPeriod = 'morning' | 'afternoon' | 'evening' | 'any';

export interface Habit {
  id: string;
  title: string;
  category: string;
  icon: string;
  hideTitle?: boolean;
  period?: HabitPeriod; // ausente em dados antigos = 'any'
  frequency: number[]; // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  archived?: boolean;
  createdAt: number;
}

export type LogsMap = Record<string, string[]>; // { 'YYYY-MM-DD': ['habit-1', 'habit-2'] }

export interface WeekDay {
  date: Date;
  key: string;
  dayName: string;
  dayNumber: number;
  isToday: boolean;
  isFuture: boolean;
}

export interface HeatmapDay {
  date: Date;
  key: string;
  completedCount: number;
  scheduledCount: number;
  ratio: number;
}

export type TabType = 'today' | 'stats' | 'pomo' | 'manage';

export type PomoKind = 'focus' | 'short' | 'long';

/** Sessão de Pomodoro registrada (concluída ou interrompida) */
export interface PomoSession {
  id: string;
  kind: PomoKind;
  startedAt: number; // epoch ms
  endedAt: number; // epoch ms
  plannedSeconds: number;
  actualSeconds: number;
  completed: boolean;
}

export type GraphRange = 7 | 15 | 30 | 90 | 365;
export type SyncStatus = 'offline' | 'connecting' | 'synced' | 'error';
