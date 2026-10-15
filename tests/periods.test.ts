import { describe, it, expect } from 'vitest';
import {
  getCurrentPeriod,
  groupHabitsByPeriod,
  isSectionComplete,
  normalizePeriod
} from '@/lib/periods';
import { type Habit } from '@/types/habit';

const habit = (id: string, period?: unknown): Habit => ({
  id,
  title: id,
  category: 'Geral',
  icon: 'target',
  frequency: [0, 1, 2, 3, 4, 5, 6],
  createdAt: 0,
  ...(period !== undefined ? { period: period as Habit['period'] } : {})
});

describe('periods', () => {
  it('normaliza valores antigos ou inválidos para any', () => {
    expect(normalizePeriod(undefined)).toBe('any');
    expect(normalizePeriod('madrugada')).toBe('any');
    expect(normalizePeriod(null)).toBe('any');
    expect(normalizePeriod('morning')).toBe('morning');
  });

  it('detecta o período atual pelas fronteiras da hora', () => {
    const at = (h: number, m = 0) => getCurrentPeriod(new Date(2025, 5, 15, h, m));
    expect(at(4, 59)).toBe('evening');
    expect(at(5, 0)).toBe('morning');
    expect(at(11, 59)).toBe('morning');
    expect(at(12, 0)).toBe('afternoon');
    expect(at(17, 59)).toBe('afternoon');
    expect(at(18, 0)).toBe('evening');
    expect(at(0, 0)).toBe('evening');
  });

  it('não agrupa quando todos são any (ou sem o campo)', () => {
    const r = groupHabitsByPeriod([habit('a'), habit('b', 'any'), habit('c', 'lixo')]);
    expect(r.grouped).toBe(false);
    expect(r.sections).toHaveLength(1);
    expect(r.sections[0].period).toBe('any');
    expect(r.sections[0].habits.map((h) => h.id)).toEqual(['a', 'b', 'c']);
  });

  it('agrupa na ordem do dia, omite seções vazias e preserva a ordem interna', () => {
    const r = groupHabitsByPeriod([
      habit('n1', 'evening'),
      habit('x1'),
      habit('m1', 'morning'),
      habit('n2', 'evening'),
      habit('m2', 'morning')
    ]);
    expect(r.grouped).toBe(true);
    expect(r.sections.map((s) => s.period)).toEqual(['morning', 'evening', 'any']);
    expect(r.sections[0].habits.map((h) => h.id)).toEqual(['m1', 'm2']);
    expect(r.sections[1].habits.map((h) => h.id)).toEqual(['n1', 'n2']);
  });

  it('lista vazia não gera seções', () => {
    expect(groupHabitsByPeriod([])).toEqual({ grouped: false, sections: [] });
  });

  it('seção concluída exige hábitos e todos feitos', () => {
    const section = { period: 'morning' as const, habits: [habit('a'), habit('b')] };
    expect(isSectionComplete(section, ['a'])).toBe(false);
    expect(isSectionComplete(section, ['a', 'b', 'z'])).toBe(true);
    expect(isSectionComplete({ period: 'any', habits: [] }, [])).toBe(false);
  });
});
