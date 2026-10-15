import { describe, it, expect } from 'vitest';
import {
  toDateKey,
  parseDateKey,
  addDays,
  getStartOfWeek,
  formatFriendlyDate
} from '@/lib/dateUtils';

describe('dateUtils', () => {
  it('converte Date para string chave YYYY-MM-DD corretamente', () => {
    const d = new Date(2026, 9, 14); // Outubro = mês 9 (0-indexed)
    expect(toDateKey(d)).toBe('2026-10-14');
  });

  it('faz o parse inverso de YYYY-MM-DD para Date', () => {
    const d = parseDateKey('2026-10-14');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(9);
    expect(d.getDate()).toBe(14);
  });

  it('adiciona e subtrai dias corretamente', () => {
    const d = new Date(2026, 9, 14);
    const next = addDays(d, 5);
    expect(toDateKey(next)).toBe('2026-10-19');

    const prev = addDays(d, -3);
    expect(toDateKey(prev)).toBe('2026-10-11');
  });

  it('retorna a segunda-feira da semana', () => {
    // 2026-10-14 é uma quarta-feira (day = 3)
    const d = new Date(2026, 9, 14);
    const startOfWeek = getStartOfWeek(d);
    // Segunda-feira dessa semana foi 2026-10-12
    expect(toDateKey(startOfWeek)).toBe('2026-10-12');
    expect(startOfWeek.getDay()).toBe(1); // Segunda
  });

  it('formata amigavelmente a data para exibição', () => {
    const formatted = formatFriendlyDate('2026-10-14');
    expect(formatted).toContain('14');
    expect(formatted).toContain('Out');
  });
});
