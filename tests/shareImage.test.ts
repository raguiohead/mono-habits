import { describe, it, expect } from 'vitest';
import {
  CARD_H, CARD_W, PALETTES, buildWrappedCards, buildWrappedStats, dataSpanDays, formatHours, formatInt,
  formatPercent, isWrappedAvailable, layoutGrid, ratioLevel, strongestWeekday, wrappedPeriod, type GridDay
} from '@/lib/shareImage';
import { toDateKey, addDays } from '@/lib/dateUtils';
import type { HeatmapDay, PomoSession } from '@/types/habit';

const day = (date: Date, completed: number, scheduled: number): HeatmapDay => ({
  date, key: toDateKey(date), completedCount: completed, scheduledCount: scheduled,
  ratio: scheduled ? completed / scheduled : 0
});
// 2025-06-02 é segunda-feira
const MON = new Date(2025, 5, 2);
const run = (n: number, f: (i: number) => [number, number], start = MON) =>
  Array.from({ length: n }, (_, i) => { const [c, s] = f(i); return day(addDays(start, i), c, s); });

describe('ratioLevel', () => {
  it('segue os limites da grade do app', () => {
    expect(ratioLevel(0, 3)).toBe(0);
    expect(ratioLevel(0.5, 0)).toBe(0);
    expect(ratioLevel(0.2, 3)).toBe(1);
    expect(ratioLevel(0.35, 3)).toBe(1);
    expect(ratioLevel(0.5, 3)).toBe(2);
    expect(ratioLevel(0.9, 3)).toBe(3);
    expect(ratioLevel(1, 3)).toBe(4);
  });
});

describe('layoutGrid', () => {
  const area = { x: 90, y: 590, w: 900, h: 560 };
  const grid = (days: HeatmapDay[]): GridDay[] => days.map((d) => ({ key: d.key, ratio: d.ratio, scheduled: d.scheduledCount }));

  it('uma coluna por semana e a segunda-feira na linha 0', () => {
    const l = layoutGrid(grid(run(14, () => [1, 1])), area);
    expect(l.cols).toBe(2);
    expect(l.cells[0]).toMatchObject({ col: 0, row: 0 });
    expect(l.cells[6]).toMatchObject({ col: 0, row: 6 });
    expect(l.cells[7]).toMatchObject({ col: 1, row: 0 });
  });
  it('começar no meio da semana deixa o início da primeira coluna vazio', () => {
    const l = layoutGrid(grid(run(5, () => [1, 1], addDays(MON, 3))), area); // quinta-feira
    expect(l.cells[0].row).toBe(3);
    expect(l.cells[0].col).toBe(0);
    expect(l.cells[4].col).toBe(1); // segunda seguinte
  });
  it('todas as células cabem na área, sem sobreposição, e respeitam o tamanho máximo', () => {
    for (const n of [7, 30, 90, 365]) {
      const l = layoutGrid(grid(run(n, () => [1, 1])), area, { maxCell: 110 });
      expect(l.cell).toBeLessThanOrEqual(110);
      for (const c of l.cells) {
        expect(c.x).toBeGreaterThanOrEqual(area.x - 0.001);
        expect(c.y).toBeGreaterThanOrEqual(area.y - 0.001);
        expect(c.x + c.size).toBeLessThanOrEqual(area.x + area.w + 0.001);
        expect(c.y + c.size).toBeLessThanOrEqual(area.y + area.h + 0.001);
      }
      const seen = new Set(l.cells.map((c) => `${c.col}:${c.row}`));
      expect(seen.size).toBe(l.cells.length);
    }
  });
  it('365 dias gera ~53 colunas e células menores que 7 dias', () => {
    const big = layoutGrid(grid(run(365, () => [1, 1])), area);
    const small = layoutGrid(grid(run(7, () => [1, 1])), area, { maxCell: 110 });
    expect(big.cols).toBeGreaterThanOrEqual(53);
    expect(big.cell).toBeLessThan(small.cell);
  });
  it('lista vazia não quebra', () => {
    expect(layoutGrid([], area).cells).toEqual([]);
  });
});

describe('formatação', () => {
  it('porcentagem limitada a 0-100', () => {
    expect(formatPercent(86.6)).toBe('87%');
    expect(formatPercent(140)).toBe('100%');
    expect(formatPercent(-3)).toBe('0%');
  });
  it('inteiros e horas em pt-BR', () => {
    expect(formatInt(1234)).toBe('1.234');
    expect(formatHours(0)).toBe('0 min');
    expect(formatHours(1500)).toBe('25 min');
    expect(formatHours(3600)).toBe('1,0 h');
    expect(formatHours(45000)).toBe('12,5 h');
  });
});

describe('estatísticas do Wrapped', () => {
  it('strongestWeekday escolhe a maior taxa e ignora pouca amostra', () => {
    // 4 semanas: segundas sempre feitas, quartas nunca
    const days = run(28, (i) => (i % 7 === 0 ? [1, 1] : i % 7 === 2 ? [0, 1] : [0, 0]));
    const s = strongestWeekday(days)!;
    expect(s.dow).toBe(1);
    expect(s.rate).toBe(100);
    expect(strongestWeekday(run(3, () => [1, 1]))).toBeNull();
  });
  it('buildWrappedStats soma só focos concluídos dentro do período', () => {
    const days = run(10, () => [1, 1]);
    const t0 = days[0].date.getTime();
    const s = (o: Partial<PomoSession>): PomoSession => ({ id: 'x', kind: 'focus', startedAt: t0 + 1000, endedAt: t0 + 2000, plannedSeconds: 1500, actualSeconds: 1500, completed: true, ...o });
    const stats = buildWrappedStats(days, [s({}), s({ actualSeconds: 600 }), s({ completed: false }), s({ kind: 'short' }), s({ startedAt: t0 - 86400000 * 5 })], 9);
    expect(stats.focusSessions).toBe(2);
    expect(stats.focusSeconds).toBe(2100);
    expect(stats.perfectDays).toBe(10);
    expect(stats.bestStreak).toBe(9);
  });
  it('buildWrappedCards gera 3 cartões e só inclui habitCount quando informado', () => {
    const days = run(10, () => [1, 1]);
    const stats = buildWrappedStats(days, [], 5);
    const without = buildWrappedCards('dark', '2025', days, 80, stats);
    expect(without.map((c) => c.kind)).toEqual(['grid', 'numbers', 'weekday']);
    expect(without.every((c) => !('habitCount' in c))).toBe(true);
    const withCount = buildWrappedCards('dark', '2025', days, 80, stats, 4);
    expect(withCount.every((c) => 'habitCount' in c && c.habitCount === 4)).toBe(true);
  });
  it('os cartões nunca carregam títulos de hábitos (só campos numéricos e rótulos fixos)', () => {
    const days = run(10, () => [1, 1]);
    const json = JSON.stringify(buildWrappedCards('light', 'Últimos 365 dias', days, 80, buildWrappedStats(days, [], 5)));
    expect(json).not.toMatch(/title"\s*:\s*"(?!Últimos|\d{4})/);
  });
});

describe('disponibilidade do Wrapped', () => {
  it('dezembro ou 60+ dias de dados', () => {
    expect(isWrappedAvailable(new Date(2025, 11, 1), 3)).toBe(true);
    expect(isWrappedAvailable(new Date(2025, 5, 10), 59)).toBe(false);
    expect(isWrappedAvailable(new Date(2025, 5, 10), 60)).toBe(true);
  });
  it('wrappedPeriod: ano corrente em dezembro, senão 365 dias', () => {
    expect(wrappedPeriod(new Date(2025, 11, 31))).toEqual({ days: 365, label: '2025' });
    expect(wrappedPeriod(new Date(2025, 11, 1)).days).toBe(335);
    expect(wrappedPeriod(new Date(2025, 5, 10))).toEqual({ days: 365, label: 'Últimos 365 dias' });
  });
  it('dataSpanDays usa o primeiro hábito ou check-in', () => {
    const now = new Date(2025, 5, 30);
    const habit = { id: 'a', title: 'x', category: 'c', icon: 'i', frequency: [], createdAt: new Date(2025, 5, 1).getTime() };
    expect(dataSpanDays([habit], {}, now)).toBe(29);
    expect(dataSpanDays([habit], { '2025-04-01': ['a'] }, now)).toBe(90);
    expect(dataSpanDays([], {}, now)).toBe(0);
  });
});

describe('cartão', () => {
  it('dimensões 1080x1350 e paletas invertidas entre temas', () => {
    expect([CARD_W, CARD_H]).toEqual([1080, 1350]);
    expect(PALETTES.dark.bg).not.toBe(PALETTES.light.bg);
    expect(PALETTES.dark.levels[4]).toBe(PALETTES.light.bg);
  });
});
