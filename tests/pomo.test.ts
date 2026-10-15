import { describe, it, expect } from 'vitest';
import {
  formatClock,
  formatDuration,
  getNextKind,
  summarizeDay,
  clampMinutes,
  sortSessions
} from '@/lib/pomo';
import { toDateKey } from '@/lib/dateUtils';
import { type PomoSession } from '@/types/habit';

const make = (over: Partial<PomoSession>): PomoSession => ({
  id: 'p',
  kind: 'focus',
  startedAt: Date.now(),
  endedAt: Date.now(),
  plannedSeconds: 1500,
  actualSeconds: 1500,
  completed: true,
  ...over
});

describe('pomo', () => {
  it('formata o relógio', () => {
    expect(formatClock(1500)).toBe('25:00');
    expect(formatClock(59.2)).toBe('01:00');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatClock(-3)).toBe('00:00');
  });

  it('formata durações', () => {
    expect(formatDuration(40)).toBe('40s');
    expect(formatDuration(1500)).toBe('25min');
    expect(formatDuration(6000)).toBe('1h40');
  });

  it('limita os minutos', () => {
    expect(clampMinutes(0)).toBe(1);
    expect(clampMinutes(500)).toBe(180);
    expect(clampMinutes(NaN)).toBe(1);
  });

  it('segue o ciclo clássico: 4 focos e pausa longa', () => {
    expect(getNextKind('focus', 1)).toEqual({ kind: 'short', cycleCount: 1 });
    expect(getNextKind('focus', 4)).toEqual({ kind: 'long', cycleCount: 4 });
    expect(getNextKind('short', 1)).toEqual({ kind: 'focus', cycleCount: 1 });
    expect(getNextKind('long', 4)).toEqual({ kind: 'focus', cycleCount: 0 });
  });

  it('resume o dia contando parciais no tempo focado', () => {
    const now = Date.now();
    const sessions = [
      make({ startedAt: now }),
      make({ startedAt: now, actualSeconds: 600, completed: false }),
      make({ kind: 'short', startedAt: now, actualSeconds: 300, plannedSeconds: 300 }),
      make({ startedAt: now - 3 * 86400000 })
    ];
    expect(summarizeDay(sessions, toDateKey(new Date(now)))).toEqual({
      focusSessions: 1,
      focusSeconds: 2100,
      interrupted: 1
    });
  });

  it('ordena da mais recente para a mais antiga', () => {
    const r = sortSessions([make({ id: 'a', startedAt: 1 }), make({ id: 'b', startedAt: 2 })]);
    expect(r.map((s) => s.id)).toEqual(['b', 'a']);
  });
});
