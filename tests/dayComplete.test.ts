import { describe, it, expect } from 'vitest';
import { computeDayProgress, isReducedMotion, shouldPlayCompletion } from '@/lib/dayComplete';
import type { Habit } from '@/types/habit';

const T = '2025-06-11';
describe('shouldPlayCompletion', () => {
  it('toca ao concluir o último hábito de hoje', () => {
    expect(shouldPlayCompletion(2, 3, 3, T, null)).toBe(true);
    expect(shouldPlayCompletion(2, 3, 3, T, '2025-06-10')).toBe(true);
  });
  it('toca no salto em lote (1/3 -> 3/3)', () => {
    expect(shouldPlayCompletion(1, 3, 3, T, null)).toBe(true);
  });
  it('não repete no mesmo dia', () => {
    expect(shouldPlayCompletion(2, 3, 3, T, T)).toBe(false);
  });
  it('não toca se já estava completo (carregar o app / excluir pendente)', () => {
    expect(shouldPlayCompletion(3, 3, 3, T, null)).toBe(false);
    expect(shouldPlayCompletion(2, 2, 2, T, null)).toBe(false);
  });
  it('não toca ao desmarcar nem sem hábitos', () => {
    expect(shouldPlayCompletion(3, 2, 3, T, null)).toBe(false);
    expect(shouldPlayCompletion(0, 0, 0, T, null)).toBe(false);
  });
  it('não toca ao editar dias passados', () => {
    expect(shouldPlayCompletion(2, 3, 3, T, null, '2025-06-09')).toBe(false);
  });
});

const base = { name: 'x', createdAt: new Date(2025, 5, 1).getTime(), frequency: [0, 1, 2, 3, 4, 5, 6] };
const habit = (o: Partial<Habit>): Habit => ({ id: 'a', ...base, ...o }) as Habit;
const NOW = new Date(2025, 5, 11, 12);

describe('computeDayProgress', () => {
  it('conta feitos e agendados', () => {
    const hs = [habit({ id: 'a' }), habit({ id: 'b' })];
    expect(computeDayProgress(hs, { [T]: ['a'] }, {}, NOW)).toEqual({ done: 1, scheduled: 2 });
  });
  it('hábito a evitar vale como feito até escorregar', () => {
    const hs = [habit({ id: 'a' }), habit({ id: 'v', kind: 'avoid' })];
    expect(computeDayProgress(hs, { [T]: ['a'] }, {}, NOW)).toEqual({ done: 2, scheduled: 2 });
    expect(computeDayProgress(hs, { [T]: ['a'] }, { [T]: ['v'] }, NOW)).toEqual({ done: 1, scheduled: 2 });
  });
});

describe('isReducedMotion', () => {
  it('respeita a preferência do app e do sistema', () => {
    expect(isReducedMotion('reduce', false)).toBe(true);
    expect(isReducedMotion('full', true)).toBe(false);
    expect(isReducedMotion('system', true)).toBe(true);
    expect(isReducedMotion('system', false)).toBe(false);
  });
});
