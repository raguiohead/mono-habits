/** Uma meta semanal e a segunda-feira a partir da qual ela vale */
export interface WeeklyTargetEntry {
  from: string;
  target: number;
}

/** Meta diária de foco com o Pomo: N sessões concluídas ou X minutos focados */
export type PomoGoal = { type: 'sessions'; target: number } | { type: 'minutes'; target: number };

/** Período do dia em que o hábito costuma acontecer ('any' = sem horário definido) */
export type HabitPeriod = 'morning' | 'afternoon' | 'evening' | 'any';

/** 'build' = hábito a construir (padrão); 'avoid' = hábito a evitar (lógica invertida) */
export type HabitKind = 'build' | 'avoid';

export interface Habit {
  id: string;
  title: string;
  category: string;
  icon: string;
  hideTitle?: boolean;
  description?: string; // descrição curta opcional (até 140 caracteres); ausente = sem descrição
  featured?: boolean; // destaque no layout bento do Foco (no máximo 2 hábitos)
  period?: HabitPeriod; // ausente em dados antigos = 'any'
  kind?: HabitKind; // ausente em dados antigos = 'build'
  pomoGoal?: PomoGoal; // meta diária com o Pomo (ausente = sem meta)
  // Meta semanal ("X vezes por semana") em vez de dias fixos; `frequency` é ignorada enquanto ativa
  weeklyTarget?: number; // 1-7: meta mais recente
  weeklyTargetFrom?: string; // segunda-feira ('YYYY-MM-DD') a partir da qual `weeklyTarget` vale
  weeklyTargets?: WeeklyTargetEntry[]; // cronograma de metas, em ordem; guarda o histórico
  frequency: number[]; // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  archived?: boolean;
  createdAt: number;
}

export type LogsMap = Record<string, string[]>; // { 'YYYY-MM-DD': ['habit-1', 'habit-2'] }

/** Escorregões: hábitos a evitar em que o usuário escorregou em cada dia (o dia vira falha) */
export type SlipsMap = Record<string, string[]>; // { 'YYYY-MM-DD': ['habit-1'] }

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
  /** Contagens para a taxa de conclusão (hábitos semanais entram como semana cumprida/falha) */
  rateScheduled?: number;
  rateCompleted?: number;
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
