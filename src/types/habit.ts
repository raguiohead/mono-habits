/** Meta diária de foco com o Pomo: N sessões concluídas ou X minutos focados */
export type PomoGoal = { type: 'sessions'; target: number } | { type: 'minutes'; target: number };

/** Período do dia em que o hábito costuma acontecer ('any' = sem horário definido) */
export type HabitPeriod = 'morning' | 'afternoon' | 'evening' | 'any';

export interface Habit {
  id: string;
  title: string;
  category: string;
  icon: string;
  hideTitle?: boolean;
  period?: HabitPeriod; // ausente em dados antigos = 'any'
  pomoGoal?: PomoGoal; // meta diária com o Pomo (ausente = sem meta)
  frequency: number[]; // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  archived?: boolean;
  createdAt: number;
}

export type LogsMap = Record<string, string[]>; // { 'YYYY-MM-DD': ['habit-1', 'habit-2'] }

/** Dias de graça: hábitos perdoados em cada dia, sem contar como concluídos */
export type GracesMap = Record<string, string[]>; // { 'YYYY-MM-DD': ['habit-1'] }

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
  /** Hábitos agendados, não concluídos e perdoados por dia de graça */
  gracedCount?: number;
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
  habitId?: string; // hábito vinculado (só sessões de foco)
}

export type GraphRange = 7 | 15 | 30 | 90 | 365;
export type SyncStatus = 'offline' | 'connecting' | 'synced' | 'error';
