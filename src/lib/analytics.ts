import { type Habit, type LogsMap, type HeatmapDay } from '@/types/habit';
import { toDateKey, addDays } from './dateUtils';

/**
 * Calcula a sequência consecutiva (streak) de um hábito até a data de referência.
 * Se o hábito ainda não foi concluído hoje, verifica a partir de ontem para não zerar no meio do dia.
 */
export function calculateStreak(habit: Habit, logs: LogsMap, today: Date = new Date()): number {
  let streak = 0;
  const freq = habit.frequency || [0, 1, 2, 3, 4, 5, 6];
  const todayKey = toDateKey(today);
  let cursor = new Date(today);

  const todayCompleted = (logs[todayKey] || []).includes(habit.id);
  if (!todayCompleted) {
    cursor = addDays(cursor, -1);
  }

  for (let i = 0; i < 365; i++) {
    const dKey = toDateKey(cursor);
    const dayOfWeek = cursor.getDay();

    if (freq.includes(dayOfWeek)) {
      const completedOnDay = (logs[dKey] || []).includes(habit.id);
      if (completedOnDay) {
        streak++;
      } else {
        break;
      }
    }
    cursor = addDays(cursor, -1);
  }

  return streak;
}

/**
 * Retorna os hábitos agendados para um determinado dia da semana
 */
export function getHabitsForDay(habits: Habit[], dayOfWeek: number): Habit[] {
  return habits.filter((h) => !h.archived && (h.frequency || []).includes(dayOfWeek));
}

/**
 * Calcula a porcentagem de conclusão diária
 */
export function calculateDailyProgress(habitsForDay: Habit[], completedIds: string[]): number {
  if (habitsForDay.length === 0) return 0;
  const completedCount = habitsForDay.filter((h) => completedIds.includes(h.id)).length;
  return Math.round((completedCount / habitsForDay.length) * 100);
}

/**
 * Gera a grade de dados do heatmap (padrão 91 dias / 13 semanas completas)
 */
export function generateHeatmapDays(
  habits: Habit[],
  logs: LogsMap,
  today: Date = new Date(),
  totalDays: number = 91
): HeatmapDay[] {
  const result: HeatmapDay[] = [];
  const active = habits.filter((h) => !h.archived);

  for (let i = totalDays - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    const key = toDateKey(d);
    const dow = d.getDay();
    const scheduled = active.filter((h) => (h.frequency || []).includes(dow));
    const completedIds = logs[key] || [];
    const completedCount = scheduled.filter((h) => completedIds.includes(h.id)).length;
    const ratio = scheduled.length > 0 ? completedCount / scheduled.length : 0;

    result.push({
      date: d,
      key,
      completedCount,
      scheduledCount: scheduled.length,
      ratio
    });
  }

  return result;
}

/**
 * Calcula a retenção / consistência nos últimos 30 dias
 */
export function calculateRetentionRate(heatmapDays: HeatmapDay[], daysCount: number = 30): number {
  const slice = heatmapDays.slice(-daysCount);
  let totalScheduled = 0;
  let totalCompleted = 0;

  slice.forEach((item) => {
    totalScheduled += item.scheduledCount;
    totalCompleted += item.completedCount;
  });

  if (totalScheduled === 0) return 0;
  return Math.round((totalCompleted / totalScheduled) * 100);
}

/**
 * Retorna a maior ofensiva entre todos os hábitos ativos
 */
export function getBestStreak(habits: Habit[], logs: LogsMap, today: Date = new Date()): number {
  const active = habits.filter((h) => !h.archived);
  if (active.length === 0) return 0;
  return Math.max(...active.map((h) => calculateStreak(h, logs, today)), 0);
}

/**
 * Classes Tailwind estritamente monocromáticas para as células do Heatmap
 */
export function getHeatmapCellClass(ratio: number, darkMode: boolean): string {
  if (ratio === 0) {
    return darkMode ? 'bg-zinc-900 border-zinc-800/80' : 'bg-zinc-100 border-zinc-200/80';
  }
  if (ratio <= 0.35) {
    return darkMode ? 'bg-zinc-700 border-zinc-600' : 'bg-zinc-300 border-zinc-300';
  }
  if (ratio <= 0.7) {
    return darkMode ? 'bg-zinc-400 border-zinc-300' : 'bg-zinc-500 border-zinc-500';
  }
  if (ratio < 1) {
    return darkMode ? 'bg-zinc-200 border-zinc-100' : 'bg-zinc-700 border-zinc-700';
  }
  return darkMode ? 'bg-white border-white' : 'bg-zinc-950 border-zinc-950';
}
