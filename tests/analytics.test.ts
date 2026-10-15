import { describe, it, expect } from 'vitest';
import {
  calculateStreak,
  getHabitsForDay,
  calculateDailyProgress,
  generateHeatmapDays,
  calculateRetentionRate,
  getBestStreak,
  aggregateBuckets,
  getBucketSize,
  countPerfectDays
} from '@/lib/analytics';
import { type Habit, type LogsMap } from '@/types/habit';

describe('analytics', () => {
  const sampleHabit: Habit = {
    id: 'habit-test-1',
    title: 'Leitura',
    category: 'Estudo',
    icon: 'book',
    frequency: [0, 1, 2, 3, 4, 5, 6],
    archived: false,
    createdAt: Date.now()
  };

  it('calcula streak ativo quando concluído hoje', () => {
    const today = new Date(2026, 9, 14);
    const logs: LogsMap = {
      '2026-10-14': ['habit-test-1'],
      '2026-10-13': ['habit-test-1'],
      '2026-10-12': ['habit-test-1']
    };

    const streak = calculateStreak(sampleHabit, logs, today);
    expect(streak).toBe(3);
  });

  it('mantém o streak de ontem se hoje ainda não foi marcado', () => {
    const today = new Date(2026, 9, 14);
    const logs: LogsMap = {
      '2026-10-13': ['habit-test-1'],
      '2026-10-12': ['habit-test-1']
    };

    const streak = calculateStreak(sampleHabit, logs, today);
    expect(streak).toBe(2);
  });

  it('zera o streak se houve quebra de consistência em dias programados', () => {
    const today = new Date(2026, 9, 14);
    const logs: LogsMap = {
      '2026-10-12': ['habit-test-1']
    };

    const streak = calculateStreak(sampleHabit, logs, today);
    expect(streak).toBe(0);
  });

  it('calcula porcentagem de progresso diário corretamente', () => {
    const habits: Habit[] = [
      { ...sampleHabit, id: 'h1' },
      { ...sampleHabit, id: 'h2' }
    ];

    expect(calculateDailyProgress(habits, ['h1'])).toBe(50);
    expect(calculateDailyProgress(habits, ['h1', 'h2'])).toBe(100);
    expect(calculateDailyProgress(habits, [])).toBe(0);
    expect(calculateDailyProgress([], [])).toBe(0);
  });

  it('filtra hábitos agendados para o dia da semana', () => {
    const habitWeekdayOnly: Habit = {
      ...sampleHabit,
      id: 'h-weekday',
      frequency: [1, 2, 3, 4, 5]
    };
    const habitWeekendOnly: Habit = {
      ...sampleHabit,
      id: 'h-weekend',
      frequency: [0, 6]
    };

    const mondayHabits = getHabitsForDay([habitWeekdayOnly, habitWeekendOnly], 1);
    expect(mondayHabits.map((h) => h.id)).toEqual(['h-weekday']);

    const sundayHabits = getHabitsForDay([habitWeekdayOnly, habitWeekendOnly], 0);
    expect(sundayHabits.map((h) => h.id)).toEqual(['h-weekend']);
  });

  it('gera 91 dias de heatmap com ratios calculados', () => {
    const today = new Date(2026, 9, 14);
    const habits = [sampleHabit];
    const logs: LogsMap = {
      '2026-10-14': ['habit-test-1']
    };

    const heatmap = generateHeatmapDays(habits, logs, today, 91);
    expect(heatmap.length).toBe(91);
    const todayCell = heatmap[heatmap.length - 1];
    expect(todayCell.key).toBe('2026-10-14');
    expect(todayCell.ratio).toBe(1);
  });

  it('calcula taxa de retenção dos últimos 30 dias', () => {
    const today = new Date(2026, 9, 14);
    const habits = [sampleHabit];
    const logs: LogsMap = {
      '2026-10-14': ['habit-test-1'],
      '2026-10-13': ['habit-test-1']
    };

    const heatmap = generateHeatmapDays(habits, logs, today, 91);
    const rate = calculateRetentionRate(heatmap, 30);
    expect(rate).toBeGreaterThan(0);
  });

  it('identifica a maior ofensiva entre hábitos ativos', () => {
    const today = new Date(2026, 9, 14);
    const habitA = { ...sampleHabit, id: 'ha' };
    const habitB = { ...sampleHabit, id: 'hb' };
    const logs: LogsMap = {
      '2026-10-14': ['ha', 'hb'],
      '2026-10-13': ['hb'],
      '2026-10-12': ['hb']
    };

    const best = getBestStreak([habitA, habitB], logs, today);
    expect(best).toBe(3);
  });

  describe('grafo', () => {
    const habits: Habit[] = [
      { ...sampleHabit, id: 'a' },
      { ...sampleHabit, id: 'b' }
    ];
    const today = new Date(2025, 5, 15);

    it('define o tamanho do bloco por período', () => {
      expect([7, 15, 30, 90, 365].map((r) => getBucketSize(r as 7))).toEqual([1, 1, 1, 7, 30]);
    });

    it('agrupa a partir do dia mais recente', () => {
      const days = generateHeatmapDays(habits, { '2025-06-15': ['a', 'b'] }, today, 15);
      const buckets = aggregateBuckets(days, 7);
      expect(buckets).toHaveLength(3);
      expect(buckets[2].endKey).toBe('2025-06-15');
      expect(buckets[2].completedCount).toBe(2);
      expect(buckets[2].scheduledCount).toBe(14);
      expect(buckets[0].startKey).toBe(days[0].key);
    });

    it('conta dias perfeitos', () => {
      const logs: LogsMap = { '2025-06-15': ['a', 'b'], '2025-06-14': ['a'] };
      const days = generateHeatmapDays(habits, logs, today, 7);
      expect(countPerfectDays(days)).toBe(1);
    });
  });
});
