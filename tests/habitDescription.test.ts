import { describe, it, expect } from 'vitest';
import { HABIT_DESCRIPTION_MAX, sanitizeHabitDescription } from '@/lib/habitDescription';

describe('sanitizeHabitDescription', () => {
  it('apara as pontas', () => {
    expect(sanitizeHabitDescription('  ler 10 páginas  ')).toBe('ler 10 páginas');
  });

  it('colapsa quebras de linha e espaços repetidos', () => {
    expect(sanitizeHabitDescription('a\n\nb\r\n  c\t\td')).toBe('a b c d');
  });

  it('vazio, só espaços ou não textual vira undefined', () => {
    expect(sanitizeHabitDescription('')).toBeUndefined();
    expect(sanitizeHabitDescription('  \n \t ')).toBeUndefined();
    expect(sanitizeHabitDescription(undefined)).toBeUndefined();
    expect(sanitizeHabitDescription(42)).toBeUndefined();
  });

  it('trunca no limite', () => {
    const out = sanitizeHabitDescription('x'.repeat(HABIT_DESCRIPTION_MAX + 50));
    expect(out).toHaveLength(HABIT_DESCRIPTION_MAX);
  });

  it('mantém texto exatamente no limite', () => {
    const text = 'y'.repeat(HABIT_DESCRIPTION_MAX);
    expect(sanitizeHabitDescription(text)).toBe(text);
  });

  it('não deixa espaço sobrando ao truncar', () => {
    const text = 'a'.repeat(HABIT_DESCRIPTION_MAX - 1) + ' bbb';
    expect(sanitizeHabitDescription(text)).toBe('a'.repeat(HABIT_DESCRIPTION_MAX - 1));
  });
});
