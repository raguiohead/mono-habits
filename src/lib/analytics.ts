import { type Habit, type LogsMap, type GracesMap, type HeatmapDay, type GraphRange } from '@/types/habit';
import { toDateKey, addDays, parseDateKey } from './dateUtils';
import {
  calculateBestWeeklyStreak,
  calculateWeeklyStreak,
  hasWeeklyTarget,
  isScheduledOn,
  isWeeklyOn,
  weekOutcome,
  weekStartKey
} from './weekly';

/**
 * Calcula a sequência consecutiva (streak) de um hábito até a data de referência.
 * Se o hábito ainda não foi concluído hoje, verifica a partir de ontem para não zerar no meio do dia.
 * Um dia de graça (hábito agendado, não concluído e perdoado) não quebra a sequência nem soma +1.
 * Hábitos com meta semanal contam SEMANAS consecutivas cumpridas (ver lib/weekly.ts).
 */
export function calculateStreak(
  habit: Habit,
  logs: LogsMap,
  today: Date = new Date(),
  graces: GracesMap = {}
): number {
  if (isWeeklyOn(habit, today)) return calculateWeeklyStreak(habit, logs, today, graces);
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
      } else if (!(graces[dKey] || []).includes(habit.id)) {
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
 * Hábitos que aparecem na data: os semanais aparecem todos os dias; os de dias fixos, pelos dias da semana
 */
export function getHabitsForDate(habits: Habit[], date: Date): Habit[] {
  return habits.filter((h) => isScheduledOn(h, date));
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
 * Gera a grade de dados do heatmap (padrão 91 dias / 13 semanas completas).
 * Dias de graça não contam como concluídos (a taxa os trata como não concluídos); só são sinalizados.
 * Hábitos semanais: o dia com conclusão conta cheio e os demais dias nunca penalizam a célula;
 * para a taxa, cada semana encerrada é um sucesso ou uma falha (contado no domingo).
 */
export function generateHeatmapDays(
  habits: Habit[],
  logs: LogsMap,
  today: Date = new Date(),
  totalDays: number = 91,
  graces: GracesMap = {}
): HeatmapDay[] {
  const result: HeatmapDay[] = [];
  const active = habits.filter((h) => !h.archived);

  for (let i = totalDays - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    const key = toDateKey(d);
    const dow = d.getDay();
    const completedIds = logs[key] || [];
    const gracedIds = graces[key] || [];

    // Hábitos de dias fixos agendados neste dia da semana (em semana sem modo semanal)
    const fixed = active.filter((h) => !isWeeklyOn(h, d) && (h.frequency || []).includes(dow));
    const weekly = active.filter((h) => isWeeklyOn(h, d));
    const weeklyDone = weekly.filter((h) => completedIds.includes(h.id));

    const scheduledCount = fixed.length + weeklyDone.length;
    const fixedDone = fixed.filter((h) => completedIds.includes(h.id)).length;
    const completedCount = fixedDone + weeklyDone.length;
    const ratio = scheduledCount > 0 ? completedCount / scheduledCount : 0;
    const gracedCount = [...fixed, ...weekly].filter(
      (h) => !completedIds.includes(h.id) && gracedIds.includes(h.id)
    ).length;

    // Taxa: fixos por dia; semanais por semana encerrada (contada no domingo)
    let rateScheduled = fixed.length;
    let rateCompleted = fixedDone;
    if (dow === 0) {
      const wk = weekStartKey(d);
      for (const h of active) {
        if (!hasWeeklyTarget(h)) continue;
        const outcome = weekOutcome(h, wk, logs, today);
        if (!outcome) continue;
        rateScheduled += 1;
        if (outcome.met) rateCompleted += 1;
      }
    }

    result.push({
      date: d,
      key,
      completedCount,
      scheduledCount,
      ratio,
      gracedCount,
      rateScheduled,
      rateCompleted
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
    totalScheduled += item.rateScheduled ?? item.scheduledCount;
    totalCompleted += item.rateCompleted ?? item.completedCount;
  });

  if (totalScheduled === 0) return 0;
  return Math.round((totalCompleted / totalScheduled) * 100);
}

/**
 * Calcula a maior sequência consecutiva histórica (best streak) de um hábito,
 * varrendo desde habit.createdAt até hoje.
 * Dias não agendados (fora de habit.frequency) não quebram nem somam; dias de graça também não.
 * Hábitos com meta semanal: maior sequência de SEMANAS cumpridas.
 */
export function calculateBestStreak(
  habit: Habit,
  logs: LogsMap,
  today: Date = new Date(),
  graces: GracesMap = {}
): number {
  if (isWeeklyOn(habit, today)) return calculateBestWeeklyStreak(habit, logs, today, graces);
  const freq = habit.frequency || [0, 1, 2, 3, 4, 5, 6];
  if (freq.length === 0) return 0;

  const todayKey = toDateKey(today);
  const todayDate = parseDateKey(todayKey);

  // Determina a data inicial (habit.createdAt ou data do primeiro registro)
  const validCreated = habit.createdAt && habit.createdAt > 0 ? habit.createdAt : todayDate.getTime();
  let startMs = validCreated;

  for (const dateKey of Object.keys(logs)) {
    if ((logs[dateKey] || []).includes(habit.id)) {
      const logTime = parseDateKey(dateKey).getTime();
      if (logTime < startMs) {
        startMs = logTime;
      }
    }
  }

  // Limite razoável de segurança contra timestamps inconsistentes (ex: epoch 0)
  const minAllowed = new Date(2020, 0, 1).getTime();
  if (startMs < minAllowed) {
    startMs = minAllowed;
  }

  let cursor = parseDateKey(toDateKey(new Date(startMs)));
  if (cursor.getTime() > todayDate.getTime()) {
    cursor = new Date(todayDate);
  }

  let currentStreak = 0;
  let bestStreak = 0;

  while (cursor.getTime() <= todayDate.getTime()) {
    const dKey = toDateKey(cursor);
    const dayOfWeek = cursor.getDay();

    if (freq.includes(dayOfWeek)) {
      const isToday = dKey === todayKey;
      const completedOnDay = (logs[dKey] || []).includes(habit.id);

      if (completedOnDay) {
        currentStreak++;
        if (currentStreak > bestStreak) {
          bestStreak = currentStreak;
        }
      } else if (!(graces[dKey] || []).includes(habit.id)) {
        // Se for hoje e ainda não foi concluído, não quebra a sequência histórica
        if (!isToday) {
          currentStreak = 0;
        }
      }
    }

    cursor = addDays(cursor, 1);
  }

  const current = calculateStreak(habit, logs, today, graces);
  return Math.max(bestStreak, current);
}

/**
 * Retorna a maior ofensiva histórica real, em DIAS, entre os hábitos ativos de dias fixos
 * (hábitos semanais contam semanas: veja getWeeklyStreakSummary)
 */
export function getBestStreak(
  habits: Habit[],
  logs: LogsMap,
  today: Date = new Date(),
  graces: GracesMap = {}
): number {
  const active = habits.filter((h) => !h.archived && !isWeeklyOn(h, today));
  if (active.length === 0) return 0;
  return Math.max(...active.map((h) => calculateBestStreak(h, logs, today, graces)), 0);
}

/**
 * Retorna a maior ofensiva atual, em DIAS, entre os hábitos ativos de dias fixos
 */
export function getBestCurrentStreak(
  habits: Habit[],
  logs: LogsMap,
  today: Date = new Date(),
  graces: GracesMap = {}
): number {
  const active = habits.filter((h) => !h.archived && !isWeeklyOn(h, today));
  if (active.length === 0) return 0;
  return Math.max(...active.map((h) => calculateStreak(h, logs, today, graces)), 0);
}

/** Ofensivas em SEMANAS (melhor e atual) entre os hábitos ativos com meta semanal */
export function getWeeklyStreakSummary(
  habits: Habit[],
  logs: LogsMap,
  today: Date = new Date(),
  graces: GracesMap = {}
): { best: number; current: number; count: number } {
  const weekly = habits.filter((h) => !h.archived && isWeeklyOn(h, today));
  return {
    count: weekly.length,
    best: Math.max(0, ...weekly.map((h) => calculateBestWeeklyStreak(h, logs, today, graces))),
    current: Math.max(0, ...weekly.map((h) => calculateWeeklyStreak(h, logs, today, graces)))
  };
}

export const getCurrentBestStreak = getBestCurrentStreak;
export const getBestHistoricalStreak = getBestStreak;

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

export interface GraphBucket {
  key: string;
  startKey: string;
  endKey: string;
  completedCount: number;
  scheduledCount: number;
  ratio: number;
}

/** Agrupa os dias em blocos (1 dia, 1 semana, ~1 mês) conforme o período do Grafo */
export function getBucketSize(range: GraphRange): number {
  if (range <= 30) return 1;
  if (range <= 90) return 7;
  return 30;
}

export function aggregateBuckets(days: HeatmapDay[], bucketSize: number): GraphBucket[] {
  const buckets: GraphBucket[] = [];
  const size = Math.max(1, bucketSize);
  // Agrupa a partir do dia mais recente para que o último bloco esteja sempre completo
  for (let end = days.length; end > 0; end -= size) {
    const slice = days.slice(Math.max(0, end - size), end);
    const completedCount = slice.reduce((acc, d) => acc + d.completedCount, 0);
    const scheduledCount = slice.reduce((acc, d) => acc + d.scheduledCount, 0);
    buckets.unshift({
      key: slice[0].key,
      startKey: slice[0].key,
      endKey: slice[slice.length - 1].key,
      completedCount,
      scheduledCount,
      ratio: scheduledCount > 0 ? completedCount / scheduledCount : 0
    });
  }
  return buckets;
}

/** Dias em que todos os hábitos agendados foram concluídos */
export function countPerfectDays(days: HeatmapDay[]): number {
  return days.filter((d) => d.scheduledCount > 0 && d.completedCount === d.scheduledCount).length;
}
