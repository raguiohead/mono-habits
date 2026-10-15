export interface Habit {
  id: string;
  title: string;
  category: string;
  icon: string;
  hideTitle?: boolean;
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

export type TabType = 'today' | 'stats' | 'manage';
export type SyncStatus = 'offline' | 'connecting' | 'synced' | 'error';
