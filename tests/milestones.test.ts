import { describe, it, expect } from 'vitest';
import {
  diffMilestones,
  getHabitMilestones,
  highestMilestone,
  nextMilestone,
  reachedMilestones,
  sanitizeMilestonesSeen,
  seedSeen
} from '@/lib/milestones';
import { toDateKey } from '@/lib/dateUtils';
import type { Habit, LogsMap } from '@/types/habit';

describe('marcos', () => {
  it('cruza os limites exatos', () => {
    expect(reachedMilestones(6)).toEqual([]);
    expect(reachedMilestones(7)).toEqual([7]);
    expect(reachedMilestones(100)).toEqual([7, 30, 100]);
    expect(reachedMilestones(400)).toEqual([7, 30, 100, 365]);
    expect(highestMilestone(29)).toBe(7);
    expect(highestMilestone(0)).toBeNull();
    expect(nextMilestone(30)).toBe(100);
    expect(nextMilestone(365)).toBeNull();
  });
});

const NOW = new Date(2025, 5, 30, 12);
const daysAgo = (n: number) => new Date(2025, 5, 30 - n, 12);
const habit = (o: Partial<Habit> = {}): Habit =>
  ({ id: 'h', title: 'x', category: 'c', icon: 'book', frequency: [0, 1, 2, 3, 4, 5, 6], createdAt: new Date(2025, 0, 1).getTime(), ...o }) as Habit;
const logsFor = (offsets: number[]): LogsMap => {
  const l: LogsMap = {};
  for (const o of offsets) l[toDateKey(daysAgo(o))] = ['h'];
  return l;
};
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe('getHabitMilestones', () => {
  it('usa a melhor ofensiva histórica, mesmo depois de a atual cair', () => {
    // 35 dias seguidos (de 60 a 26 atrás), depois nada
    const m = getHabitMilestones(habit(), logsFor(range(26, 60)), NOW);
    expect(m.best).toBe(35);
    expect(m.reached).toEqual([7, 30]);
    expect(m.highest).toBe(30);
    expect(m.next).toBe(100);
  });
  it('ofensiva que cai e volta não perde marcos', () => {
    const m = getHabitMilestones(habit(), logsFor([...range(40, 60), 0, 1, 2]), NOW);
    expect(m.best).toBe(21);
    expect(m.reached).toEqual([7]);
  });
  it('hábito a evitar conta dias limpos', () => {
    const h = habit({ kind: 'avoid', createdAt: daysAgo(40).getTime() });
    const m = getHabitMilestones(h, {}, NOW, {}, {});
    expect(m.reached).toEqual([7, 30]);
  });
});

describe('diffMilestones / seedSeen', () => {
  it('semeia sem avisar e depois só avisa os novos', () => {
    const seen = seedSeen([{ id: 'a', reached: [7, 30] }]);
    expect(diffMilestones([{ id: 'a', reached: [7, 30] }], seen).announce).toEqual([]);
    const d = diffMilestones([{ id: 'a', reached: [7, 30, 100] }], seen);
    expect(d.announce).toEqual([{ id: 'a', milestone: 100 }]);
    expect(d.next.a).toEqual([7, 30, 100]);
  });
  it('vários marcos de uma vez viram um aviso com o maior', () => {
    const d = diffMilestones([{ id: 'a', reached: [7, 30] }], { a: [] });
    expect(d.announce).toEqual([{ id: 'a', milestone: 30 }]);
    expect(d.next.a).toEqual([7, 30]);
  });
  it('hábito novo sem registro no seen avisa quando atinge', () => {
    expect(diffMilestones([{ id: 'n', reached: [7] }], {}).announce).toEqual([{ id: 'n', milestone: 7 }]);
  });
});

describe('sanitizeMilestonesSeen', () => {
  it('descarta lixo e aceita só marcos válidos', () => {
    expect(sanitizeMilestonesSeen(null)).toBeNull();
    expect(sanitizeMilestonesSeen([1])).toBeNull();
    expect(sanitizeMilestonesSeen({ a: [7, 8, 'x'], b: 'z' })).toEqual({ a: [7] });
  });
});
