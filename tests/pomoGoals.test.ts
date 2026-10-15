import { describe, it, expect } from 'vitest';
import {
  addDismissal,
  getGoalLock,
  getLinkableHabits,
  goalLabel,
  goalProgress,
  isGoalMet,
  normalizePomoGoal,
  pruneDismissals,
  shouldAutoComplete
} from '@/lib/pomoGoals';
import { toDateKey } from '@/lib/dateUtils';
import { type Habit, type PomoGoal, type PomoSession } from '@/types/habit';

const day = (y: number, m: number, d: number, h = 10, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const KEY = '2025-06-15';

const session = (over: Partial<PomoSession>): PomoSession => ({
  id: String(Math.random()),
  kind: 'focus',
  startedAt: day(2025, 6, 15),
  endedAt: day(2025, 6, 15, 10, 25),
  plannedSeconds: 1500,
  actualSeconds: 1500,
  completed: true,
  habitId: 'h1',
  ...over
});

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1',
  title: 'Ler',
  category: 'Mente',
  icon: 'book',
  frequency: [0, 1, 2, 3, 4, 5, 6],
  createdAt: 0,
  pomoGoal: { type: 'minutes', target: 30 },
  ...over
});

const minutes = (target: number): PomoGoal => ({ type: 'minutes', target });
const sessionsGoal = (target: number): PomoGoal => ({ type: 'sessions', target });

describe('normalizePomoGoal', () => {
  it('aceita metas válidas e limita aos intervalos', () => {
    expect(normalizePomoGoal({ type: 'minutes', target: 30 })).toEqual(minutes(30));
    expect(normalizePomoGoal({ type: 'minutes', target: 1 })).toEqual(minutes(5));
    expect(normalizePomoGoal({ type: 'minutes', target: 999 })).toEqual(minutes(240));
    expect(normalizePomoGoal({ type: 'sessions', target: 0 })).toEqual(sessionsGoal(1));
    expect(normalizePomoGoal({ type: 'sessions', target: 50 })).toEqual(sessionsGoal(12));
    expect(normalizePomoGoal({ type: 'sessions', target: 2.6 })).toEqual(sessionsGoal(3));
  });

  it('rejeita dados inválidos', () => {
    expect(normalizePomoGoal(undefined)).toBeUndefined();
    expect(normalizePomoGoal(null)).toBeUndefined();
    expect(normalizePomoGoal({ type: 'horas', target: 2 })).toBeUndefined();
    expect(normalizePomoGoal({ type: 'minutes', target: '30' })).toBeUndefined();
    expect(normalizePomoGoal({ type: 'minutes', target: NaN })).toBeUndefined();
  });
});

describe('goalProgress', () => {
  it('minutos: soma o tempo real, incluindo sessões interrompidas (parciais)', () => {
    const sessions = [session({ actualSeconds: 1500 }), session({ actualSeconds: 600, completed: false })];
    const p = goalProgress(minutes(30), 'h1', sessions, KEY);
    expect(p.current).toBe(35);
    expect(p.met).toBe(true);
    expect(p.ratio).toBe(1);
    expect(goalLabel(goalProgress(minutes(60), 'h1', sessions, KEY))).toBe('35/60 min');
  });

  it('minutos: não arredonda para cima (29min59s não bate 30 min)', () => {
    const p = goalProgress(minutes(30), 'h1', [session({ actualSeconds: 1799 })], KEY);
    expect(p.met).toBe(false);
    expect(p.current).toBe(29);
    expect(isGoalMet(minutes(30), 'h1', [session({ actualSeconds: 1800 })], KEY)).toBe(true);
  });

  it('sessões: conta só as concluídas', () => {
    const sessions = [session({}), session({ completed: false, actualSeconds: 1400 }), session({})];
    const p = goalProgress(sessionsGoal(3), 'h1', sessions, KEY);
    expect(p.current).toBe(2);
    expect(p.met).toBe(false);
    expect(goalLabel(p)).toBe('2/3 focos');
    expect(isGoalMet(sessionsGoal(2), 'h1', sessions, KEY)).toBe(true);
  });

  it('ignora pausas, sessões sem vínculo e de outros hábitos', () => {
    const sessions = [
      session({ kind: 'short' }),
      session({ kind: 'long' }),
      session({ habitId: undefined }),
      session({ habitId: 'outro' }),
      session({ actualSeconds: 300 })
    ];
    expect(goalProgress(minutes(30), 'h1', sessions, KEY).current).toBe(5);
  });

  it('virada de dia: conta pelo dia em que a sessão começou', () => {
    const late = session({ startedAt: day(2025, 6, 15, 23, 50), actualSeconds: 1500 });
    const next = session({ startedAt: day(2025, 6, 16, 0, 5), actualSeconds: 1500 });
    expect(goalProgress(minutes(25), 'h1', [late, next], '2025-06-15').current).toBe(25);
    expect(goalProgress(minutes(25), 'h1', [late, next], '2025-06-16').current).toBe(25);
    expect(goalProgress(minutes(25), 'h1', [late, next], '2025-06-14').current).toBe(0);
  });

  it('sem sessões o progresso é zero', () => {
    const p = goalProgress(minutes(30), 'h1', [], KEY);
    expect(p).toMatchObject({ current: 0, ratio: 0, met: false });
  });
});

describe('getLinkableHabits', () => {
  const sunday = new Date(2025, 5, 15).getDay();

  it('lista hábitos com meta, agendados hoje, pendentes e com meta não atingida', () => {
    const habits = [
      habit({ id: 'a' }),
      habit({ id: 'sem-meta', pomoGoal: undefined }),
      habit({ id: 'arquivado', archived: true }),
      habit({ id: 'outro-dia', frequency: [(sunday + 1) % 7] }),
      habit({ id: 'concluido' }),
      habit({ id: 'meta-batida' })
    ];
    const sessions = [session({ habitId: 'meta-batida', actualSeconds: 1800 })];
    const ids = getLinkableHabits(habits, { [KEY]: ['concluido'] }, sessions, KEY, sunday).map((h) => h.id);
    expect(ids).toEqual(['a']);
  });
});

describe('shouldAutoComplete (desmarcar manual)', () => {
  const base = {
    goal: minutes(30),
    habitId: 'h1',
    sessions: [session({ actualSeconds: 1800 })],
    dateKey: KEY,
    completedIds: [] as string[],
    dismissedIds: [] as string[]
  };

  it('marca quando a meta foi atingida', () => {
    expect(shouldAutoComplete(base)).toBe(true);
  });

  it('não marca se a meta ainda não foi atingida', () => {
    expect(shouldAutoComplete({ ...base, sessions: [session({ actualSeconds: 600 })] })).toBe(false);
  });

  it('não marca se já estiver concluído', () => {
    expect(shouldAutoComplete({ ...base, completedIds: ['h1'] })).toBe(false);
  });

  it('não remarca depois de desmarcado manualmente no dia', () => {
    expect(shouldAutoComplete({ ...base, dismissedIds: ['h1'] })).toBe(false);
  });
});

describe('desmarcações do dia', () => {
  const today = new Date(2025, 5, 15);

  it('registra sem duplicar e mantém dias anteriores recentes', () => {
    let m = addDismissal({}, '2025-06-15', 'h1', today);
    m = addDismissal(m, '2025-06-15', 'h1', today);
    m = addDismissal(m, '2025-06-15', 'h2', today);
    expect(m).toEqual({ '2025-06-15': ['h1', 'h2'] });
  });

  it('descarta dias antigos e dados inválidos', () => {
    const pruned = pruneDismissals(
      { '2025-06-01': ['x'], '2025-06-14': ['y'], 'lixo': ['z'], '2025-06-15': 'nao-lista' },
      today
    );
    expect(pruned).toEqual({ '2025-06-14': ['y'] });
    expect(pruneDismissals(null, today)).toEqual({});
  });

  it('usa a mesma chave de data local do restante do app', () => {
    expect(toDateKey(new Date(day(2025, 6, 15)))).toBe(KEY);
  });
});

describe('getGoalLock (marcação manual bloqueada)', () => {
  it('bloqueia enquanto a meta de minutos não foi cumprida, informando o progresso', () => {
    const lock = getGoalLock(habit(), [session({ actualSeconds: 600 })], KEY);
    expect(lock).toEqual({ label: '10/30 min' });
  });

  it('libera quando a meta de minutos é cumprida (inclusive com sessões parciais somadas)', () => {
    const sessions = [session({ actualSeconds: 1200, completed: false }), session({ actualSeconds: 600, completed: false })];
    expect(getGoalLock(habit(), sessions, KEY)).toBeNull();
  });

  it('meta de sessões: interrompidas não liberam; concluídas sim', () => {
    const h = habit({ pomoGoal: sessionsGoal(2) });
    const partial = [session({}), session({ completed: false, actualSeconds: 1400 })];
    expect(getGoalLock(h, partial, KEY)).toEqual({ label: '1/2 focos' });
    expect(getGoalLock(h, [session({}), session({})], KEY)).toBeNull();
  });

  it('hábito sem meta nunca é bloqueado', () => {
    expect(getGoalLock(habit({ pomoGoal: undefined }), [], KEY)).toBeNull();
  });

  it('só conta as sessões do dia consultado', () => {
    const yesterday = session({ startedAt: day(2025, 6, 14), actualSeconds: 1800 });
    expect(getGoalLock(habit(), [yesterday], KEY)).toEqual({ label: '0/30 min' });
    expect(getGoalLock(habit(), [yesterday], '2025-06-14')).toBeNull();
  });
});
