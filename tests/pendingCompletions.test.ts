import { describe, it, expect } from 'vitest';
import {
  MAX_AGE_MS,
  drain,
  enqueue,
  isValidCompletion,
  normalizeQueue,
  type PendingCompletion
} from '@/lib/pendingCompletions';

const NOW = 1_800_000_000_000;
const item = (habitId: string, dateKey = '2026-10-15', at = NOW): PendingCompletion => ({ habitId, dateKey, at });

describe('pendingCompletions', () => {
  it('valida o formato dos itens', () => {
    expect(isValidCompletion(item('a'))).toBe(true);
    expect(isValidCompletion(null)).toBe(false);
    expect(isValidCompletion({ habitId: '', dateKey: '2026-10-15', at: 1 })).toBe(false);
    expect(isValidCompletion({ habitId: 'a', dateKey: '15/10/2026', at: 1 })).toBe(false);
    expect(isValidCompletion({ habitId: 'a', dateKey: '2026-10-15', at: NaN })).toBe(false);
  });

  it('enqueue adiciona itens', () => {
    const q = enqueue(enqueue([], item('a'), NOW), item('b'), NOW);
    expect(q.map((i) => i.habitId)).toEqual(['a', 'b']);
  });

  it('clique duplo no mesmo hábito/dia não duplica e mantém o toque mais antigo', () => {
    const q = enqueue(enqueue([], item('a', '2026-10-15', NOW - 500), NOW), item('a', '2026-10-15', NOW), NOW);
    expect(q).toHaveLength(1);
    expect(q[0].at).toBe(NOW - 500);
  });

  it('o mesmo hábito em dias diferentes são itens distintos', () => {
    const q = enqueue(enqueue([], item('a', '2026-10-14'), NOW), item('a', '2026-10-15'), NOW);
    expect(q).toHaveLength(2);
  });

  it('descarta itens com mais de 36h, mas mantém o limite exato', () => {
    const q = normalizeQueue(
      [item('velho', '2026-10-13', NOW - MAX_AGE_MS - 1), item('limite', '2026-10-14', NOW - MAX_AGE_MS), item('novo')],
      NOW
    );
    expect(q.map((i) => i.habitId)).toEqual(['limite', 'novo']);
  });

  it('enqueue também limpa itens expirados e inválidos já guardados', () => {
    const q = enqueue([item('velho', '2026-10-13', NOW - MAX_AGE_MS - 5), { lixo: true }], item('a'), NOW);
    expect(q.map((i) => i.habitId)).toEqual(['a']);
  });

  it('drain devolve os válidos e esvazia a fila', () => {
    const { ready, remaining } = drain([item('a'), item('a'), item('velho', '2026-10-01', 0)], NOW);
    expect(ready.map((i) => i.habitId)).toEqual(['a']);
    expect(remaining).toEqual([]);
  });

  it('tolera dados corrompidos', () => {
    expect(normalizeQueue(undefined, NOW)).toEqual([]);
    expect(normalizeQueue('x', NOW)).toEqual([]);
    expect(drain(null, NOW)).toEqual({ ready: [], remaining: [] });
  });
});
