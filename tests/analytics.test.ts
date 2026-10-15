import { describe, it, expect } from 'vitest';
import {
  calculateStreak,
  calculateBestStreak,
  getHabitsForDay,
  calculateDailyProgress,
  generateHeatmapDays,
  calculateRetentionRate,
  getBestStreak,
  getBestCurrentStreak,
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

  describe('calculateBestStreak e getBestStreak', () => {
    it('calcula melhor sequência para sequência simples', () => {
      const today = new Date(2026, 9, 14);
      const habit: Habit = {
        ...sampleHabit,
        id: 'h-simple',
        createdAt: new Date(2026, 9, 10).getTime()
      };
      const logs: LogsMap = {
        '2026-10-10': ['h-simple'],
        '2026-10-11': ['h-simple'],
        '2026-10-12': ['h-simple'],
        '2026-10-13': ['h-simple'],
        '2026-10-14': ['h-simple']
      };

      expect(calculateStreak(habit, logs, today)).toBe(5);
      expect(calculateBestStreak(habit, logs, today)).toBe(5);
    });

    it('calcula melhor sequência com lacunas mantendo o recorde histórico', () => {
      const today = new Date(2026, 9, 20);
      const habit: Habit = {
        ...sampleHabit,
        id: 'h-gaps',
        createdAt: new Date(2026, 9, 1).getTime()
      };
      // Sequência de 4 dias (10 a 13), lacuna (14 a 18), sequência atual de 2 dias (19 e 20)
      const logs: LogsMap = {
        '2026-10-10': ['h-gaps'],
        '2026-10-11': ['h-gaps'],
        '2026-10-12': ['h-gaps'],
        '2026-10-13': ['h-gaps'],
        // 14 a 18 não concluídos
        '2026-10-19': ['h-gaps'],
        '2026-10-20': ['h-gaps']
      };

      expect(calculateStreak(habit, logs, today)).toBe(2);
      expect(calculateBestStreak(habit, logs, today)).toBe(4);
    });

    it('calcula melhor sequência com frequência parcial (dias não agendados não quebram nem somam)', () => {
      // 2026-10-12 (Seg = 1), 14 (Qua = 3), 16 (Sex = 5)
      // 2026-10-19 (Seg = 1) não feito
      // 2026-10-21 (Qua = 3) feito
      const today = new Date(2026, 9, 21);
      const habit: Habit = {
        ...sampleHabit,
        id: 'h-partial',
        frequency: [1, 3, 5], // Seg, Qua, Sex
        createdAt: new Date(2026, 9, 10).getTime()
      };
      const logs: LogsMap = {
        '2026-10-12': ['h-partial'],
        '2026-10-14': ['h-partial'],
        '2026-10-16': ['h-partial'],
        // 2026-10-19 (Seg) quebrou
        '2026-10-21': ['h-partial'] // Hoje (Qua)
      };

      expect(calculateStreak(habit, logs, today)).toBe(1);
      expect(calculateBestStreak(habit, logs, today)).toBe(3);
    });

    it('calcula corretamente para hábito recém-criado', () => {
      const today = new Date(2026, 9, 14);
      const newHabit: Habit = {
        ...sampleHabit,
        id: 'h-new',
        createdAt: today.getTime()
      };

      // Sem logs
      expect(calculateStreak(newHabit, {}, today)).toBe(0);
      expect(calculateBestStreak(newHabit, {}, today)).toBe(0);

      // Concluído hoje
      const logsToday: LogsMap = {
        '2026-10-14': ['h-new']
      };
      expect(calculateStreak(newHabit, logsToday, today)).toBe(1);
      expect(calculateBestStreak(newHabit, logsToday, today)).toBe(1);
    });

    it('calcula corretamente para hábito antigo sem logs', () => {
      const today = new Date(2026, 9, 14);
      const habitNoLogs: Habit = {
        ...sampleHabit,
        id: 'h-empty',
        createdAt: new Date(2026, 8, 1).getTime()
      };

      expect(calculateStreak(habitNoLogs, {}, today)).toBe(0);
      expect(calculateBestStreak(habitNoLogs, {}, today)).toBe(0);
    });

    it('preserva melhor sequência quando hoje ainda não foi marcado', () => {
      const today = new Date(2026, 9, 14);
      const habit: Habit = {
        ...sampleHabit,
        id: 'h-pending',
        createdAt: new Date(2026, 9, 10).getTime()
      };
      const logs: LogsMap = {
        '2026-10-11': ['h-pending'],
        '2026-10-12': ['h-pending'],
        '2026-10-13': ['h-pending']
      };

      expect(calculateStreak(habit, logs, today)).toBe(3);
      expect(calculateBestStreak(habit, logs, today)).toBe(3);
    });

    it('distingue melhor ofensiva histórica de melhor ofensiva atual no conjunto de hábitos', () => {
      const today = new Date(2026, 9, 20);
      const habitA: Habit = {
        ...sampleHabit,
        id: 'ha',
        createdAt: new Date(2026, 9, 1).getTime()
      };
      const habitB: Habit = {
        ...sampleHabit,
        id: 'hb',
        createdAt: new Date(2026, 9, 1).getTime()
      };

      // Habit A: atual 2, melhor 2
      // Habit B: histórico de 6 dias (01 a 06), depois quebrou e hoje está zerado (0)
      const logs: LogsMap = {
        '2026-10-19': ['ha'],
        '2026-10-20': ['ha'],
        '2026-10-01': ['hb'],
        '2026-10-02': ['hb'],
        '2026-10-03': ['hb'],
        '2026-10-04': ['hb'],
        '2026-10-05': ['hb'],
        '2026-10-06': ['hb']
      };

      // A maior melhor ofensiva histórica é do habitB (6 dias)
      expect(getBestStreak([habitA, habitB], logs, today)).toBe(6);
      // A maior ofensiva atual ativa é do habitA (2 dias)
      expect(getBestCurrentStreak([habitA, habitB], logs, today)).toBe(2);
    });
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
