import { describe, it, expect } from 'vitest';
import {
  applyWeeklyTargetChange,
  calculateBestWeeklyStreak,
  calculateWeeklyStreak,
  isDueOn,
  isScheduledOn,
  isWeeklyOn,
  normalizeWeeklyTarget,
  previousWeekKey,
  targetForWeek,
  weekDayKeys,
  weekOutcome,
  weekStartKey,
  weekStatus,
  weeklyCount
} from '@/lib/weekly';
import {
  calculateBestStreak,
  calculateRetentionRate,
  calculateStreak,
  generateHeatmapDays,
  getHabitsForDate,
  getWeeklyStreakSummary
} from '@/lib/analytics';
import { getGraceBlock } from '@/lib/graces';
import { getLinkableHabits } from '@/lib/pomoGoals';
import { type GracesMap, type Habit, type LogsMap } from '@/types/habit';

// Junho/2025: seg 2 · seg 9 · seg 16 (semanas). Hoje = quarta 18/06.
const TODAY = new Date(2025, 5, 18, 12);
const k = (d: number, m = 6) => `2025-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const date = (d: number, m = 6) => new Date(2025, m - 1, d, 12);

const weekly = (target: number, over: Partial<Habit> = {}): Habit => ({
  id: 'w',
  title: 'Treinar',
  category: 'Saúde',
  icon: 'dumbbell',
  frequency: [1],
  createdAt: new Date(2025, 0, 1).getTime(),
  weeklyTarget: target,
  weeklyTargetFrom: k(2, 5), // 2025-05-02 (antes de tudo)
  ...over
});
const fixed = (over: Partial<Habit> = {}): Habit => ({
  id: 'f',
  title: 'Ler',
  category: 'Mente',
  icon: 'book',
  frequency: [0, 1, 2, 3, 4, 5, 6],
  createdAt: new Date(2025, 0, 1).getTime(),
  ...over
});

/** Marca N dias da semana que começa em `monday` (dia do mês), a partir da segunda */
const doneInWeek = (monday: number, n: number, id = 'w', m = 6): LogsMap => {
  const logs: LogsMap = {};
  for (let i = 0; i < n; i++) logs[k(monday + i, m)] = [id];
  return logs;
};
const merge = (...maps: LogsMap[]): LogsMap => Object.assign({}, ...maps);

describe('semana (segunda a domingo)', () => {
  it('virada de semana: domingo é da semana que termina, segunda abre a seguinte', () => {
    expect(weekStartKey(new Date(2025, 5, 15, 23, 59))).toBe(k(9)); // domingo
    expect(weekStartKey(new Date(2025, 5, 16, 0, 0))).toBe(k(16)); // segunda
    expect(weekStartKey(new Date(2025, 5, 9))).toBe(k(9));
    expect(previousWeekKey(k(16))).toBe(k(9));
  });

  it('devolve as 7 chaves da semana, de segunda a domingo', () => {
    const days = weekDayKeys(k(9));
    expect(days).toHaveLength(7);
    expect(days[0]).toBe(k(9));
    expect(days[6]).toBe(k(15));
  });

  it('atravessa a virada de mês', () => {
    // semana de 30/06/2025 (segunda) termina em 06/07
    expect(weekDayKeys('2025-06-30')[6]).toBe('2025-07-06');
    expect(weekStartKey(new Date(2025, 6, 2))).toBe('2025-06-30');
  });
});

describe('meta semanal', () => {
  it('valida a meta entre 1 e 7', () => {
    expect(normalizeWeeklyTarget(3)).toBe(3);
    expect(normalizeWeeklyTarget(0)).toBe(1);
    expect(normalizeWeeklyTarget(12)).toBe(7);
    expect(normalizeWeeklyTarget(2.6)).toBe(3);
    expect(normalizeWeeklyTarget('3')).toBeUndefined();
    expect(normalizeWeeklyTarget(NaN)).toBeUndefined();
    expect(normalizeWeeklyTarget(undefined)).toBeUndefined();
  });

  it('dados antigos (sem meta semanal) seguem os dias fixos', () => {
    expect(isWeeklyOn(fixed(), TODAY)).toBe(false);
    expect(targetForWeek(fixed(), k(16))).toBeNull();
  });

  it('antes do início do modo semanal o hábito segue os dias fixos', () => {
    const h = weekly(3, { weeklyTargetFrom: k(16), frequency: [1] });
    expect(isWeeklyOn(h, date(11))).toBe(false); // semana anterior: dias fixos (só segunda)
    expect(isScheduledOn(h, date(11))).toBe(false); // quarta, não é segunda
    expect(isScheduledOn(h, date(9))).toBe(true); // segunda
    expect(isWeeklyOn(h, date(18))).toBe(true);
    expect(isScheduledOn(h, date(18))).toBe(true); // semanal: todos os dias
  });

  it('meta 7: só cumpre com os 7 dias', () => {
    const h = weekly(7);
    expect(weekStatus(h, k(9), doneInWeek(9, 6))?.met).toBe(false);
    expect(weekStatus(h, k(9), doneInWeek(9, 7))?.met).toBe(true);
  });

  it('semana parcial: conta o que foi feito e ainda não está cumprida', () => {
    const st = weekStatus(weekly(3), k(16), doneInWeek(16, 2));
    expect(st).toMatchObject({ count: 2, target: 3, met: false });
    expect(weeklyCount(weekly(3), k(16), doneInWeek(16, 2))).toBe(2);
  });
});

describe('mudança de meta (weeklyTargetFrom / cronograma)', () => {
  it('hábito novo ou que virou semanal: a meta vale desde a semana atual', () => {
    const r = applyWeeklyTargetChange(undefined, 3, TODAY);
    expect(r.weeklyTarget).toBe(3);
    expect(r.weeklyTargetFrom).toBe(k(16));
    expect(r.weeklyTargets).toEqual([{ from: k(16), target: 3 }]);
  });

  it('mudar no meio da semana: a atual mantém a antiga; a nova vale na semana seguinte', () => {
    const base = weekly(3, { weeklyTargetFrom: k(2), weeklyTargets: [{ from: k(2), target: 3 }] });
    const r = applyWeeklyTargetChange(base, 5, TODAY);
    expect(r.weeklyTarget).toBe(5);
    expect(r.weeklyTargetFrom).toBe(k(23)); // próxima segunda
    const h = { ...base, ...r };
    expect(targetForWeek(h, k(16))).toBe(3); // esta semana continua 3
    expect(targetForWeek(h, k(23))).toBe(5); // a próxima já é 5
    expect(targetForWeek(h, k(9))).toBe(3); // histórico intacto
  });

  it('a mudança não reescreve semanas já encerradas', () => {
    const base = weekly(2, { weeklyTargetFrom: k(2), weeklyTargets: [{ from: k(2), target: 2 }] });
    const h = { ...base, ...applyWeeklyTargetChange(base, 4, TODAY) };
    const logs = merge(doneInWeek(2, 2), doneInWeek(9, 2)); // 2 por semana
    expect(weekStatus(h, k(9), logs)?.met).toBe(true); // continuou valendo 2
    expect(weekStatus(h, k(23), doneInWeek(23, 2))?.met).toBe(false); // agora exige 4
  });

  it('nova mudança antes da segunda-feira substitui a pendente; voltar à meta atual a cancela', () => {
    const base = weekly(3, { weeklyTargetFrom: k(2), weeklyTargets: [{ from: k(2), target: 3 }] });
    const pend = { ...base, ...applyWeeklyTargetChange(base, 5, TODAY) };
    const replaced = { ...pend, ...applyWeeklyTargetChange(pend, 6, TODAY) };
    expect(replaced.weeklyTargets).toEqual([
      { from: k(2), target: 3 },
      { from: k(23), target: 6 }
    ]);
    const cancelled = { ...pend, ...applyWeeklyTargetChange(pend, 3, TODAY) };
    expect(cancelled.weeklyTargets).toEqual([{ from: k(2), target: 3 }]);
    expect(targetForWeek(cancelled, k(23))).toBe(3);
  });

  it('meta igual não cria entrada nova', () => {
    const base = weekly(3, { weeklyTargetFrom: k(2), weeklyTargets: [{ from: k(2), target: 3 }] });
    expect(applyWeeklyTargetChange(base, 3, TODAY).weeklyTargets).toEqual([{ from: k(2), target: 3 }]);
  });

  it('voltar para dias fixos remove os campos semanais', () => {
    expect(applyWeeklyTargetChange(weekly(3), undefined, TODAY)).toEqual({});
  });

  it('aceita dados só com weeklyTarget (sem cronograma)', () => {
    const legacy: Habit = { ...fixed(), weeklyTarget: 4 };
    expect(targetForWeek(legacy, k(16))).toBe(4);
    expect(targetForWeek(legacy, '2020-01-06')).toBe(4);
  });
});

describe('quando o hábito aparece e conta no dia', () => {
  it('semanal aparece todos os dias; fixo só nos dias da semana', () => {
    const habits = [weekly(3), fixed({ frequency: [1] })]; // fixo: só segunda
    expect(getHabitsForDate(habits, date(18)).map((h) => h.id)).toEqual(['w']); // quarta
    expect(getHabitsForDate(habits, date(16)).map((h) => h.id)).toEqual(['w', 'f']); // segunda
    expect(getHabitsForDate([weekly(3, { archived: true })], date(18))).toEqual([]);
  });

  it('semanal só pesa no dia enquanto a meta da semana não foi cumprida (ou foi feito no dia)', () => {
    const h = weekly(2);
    const logs = doneInWeek(16, 2); // seg e ter: meta cumprida
    expect(isDueOn(h, date(18), {})).toBe(true); // nada feito: devido
    expect(isDueOn(h, date(18), logs)).toBe(false); // meta cumprida e hoje não feito: não pesa
    expect(isDueOn(h, date(17), logs)).toBe(true); // feito neste dia: conta
    expect(isDueOn(fixed(), date(18), {})).toBe(true); // fixo: sempre
  });
});

describe('ofensiva semanal', () => {
  it('conta semanas consecutivas cumpridas; a semana em andamento não quebra', () => {
    const h = weekly(3);
    const logs = merge(doneInWeek(2, 3), doneInWeek(9, 3), doneInWeek(16, 1)); // atual: 1 de 3
    expect(calculateWeeklyStreak(h, logs, TODAY)).toBe(2);
    expect(calculateStreak(h, logs, TODAY)).toBe(2); // calculateStreak delega para semanas
  });

  it('a semana atual cumprida soma +1', () => {
    const h = weekly(3);
    const logs = merge(doneInWeek(2, 3), doneInWeek(9, 3), doneInWeek(16, 3));
    expect(calculateWeeklyStreak(h, logs, TODAY)).toBe(3);
  });

  it('uma semana encerrada sem a meta quebra a ofensiva', () => {
    const h = weekly(3);
    const logs = merge(doneInWeek(2, 3), doneInWeek(9, 2), doneInWeek(16, 3)); // semana 9: 2 de 3
    expect(calculateWeeklyStreak(h, logs, TODAY)).toBe(1); // só a atual
    expect(calculateWeeklyStreak(h, merge(doneInWeek(2, 3), doneInWeek(9, 2), doneInWeek(16, 1)), TODAY)).toBe(0);
  });

  it('melhor ofensiva também em semanas', () => {
    const h = weekly(2, { createdAt: new Date(2025, 4, 1).getTime() });
    // semanas a partir de 12/05: ok, ok, falha, ok, ok, ok (9/6 e 16/6 incluídas)
    const logs = merge(
      doneInWeek(12, 2),
      doneInWeek(19, 2),
      doneInWeek(26, 1),
      doneInWeek(2, 2),
      doneInWeek(9, 2),
      doneInWeek(16, 2)
    );
    expect(calculateBestWeeklyStreak(h, logs, TODAY)).toBe(3);
    expect(calculateBestStreak(h, logs, TODAY)).toBe(3);
    expect(calculateWeeklyStreak(h, logs, TODAY)).toBe(3);
  });

  it('antes do início do modo semanal a ofensiva para', () => {
    const h = weekly(2, { weeklyTargetFrom: k(9) });
    const logs = merge(doneInWeek(2, 2), doneInWeek(9, 2)); // semana 2 não conta (era dias fixos)
    expect(calculateWeeklyStreak(h, logs, TODAY)).toBe(1);
  });

  it('com meta alterada no meio, cada semana usa a meta vigente nela', () => {
    const h = weekly(2, {
      weeklyTargetFrom: k(16),
      weeklyTargets: [
        { from: k(2), target: 2 },
        { from: k(16), target: 4 }
      ]
    });
    const logs = merge(doneInWeek(2, 2), doneInWeek(9, 2), doneInWeek(16, 2));
    expect(calculateWeeklyStreak(h, logs, TODAY)).toBe(2); // semana atual (meta 4) em andamento, não quebra
    expect(weekStatus(h, k(16), logs)?.met).toBe(false);
  });

  it('uma semana não cumprida e perdoada por dia de graça não quebra nem soma', () => {
    const h = weekly(3);
    const logs = merge(doneInWeek(26, 3, 'w', 5), doneInWeek(2, 3), doneInWeek(9, 1), doneInWeek(16, 1));
    const graces: GracesMap = { [k(13)]: ['w'] }; // graça na semana de 9/6
    expect(calculateWeeklyStreak(h, logs, TODAY)).toBe(0); // sem graça: semana 9 quebra
    expect(calculateWeeklyStreak(h, logs, TODAY, graces)).toBe(2); // 2/6 e 26/5; a semana 9 é neutra
  });

  it('resumo semanal entre os hábitos', () => {
    const habits = [weekly(2), fixed()];
    const logs = merge(doneInWeek(9, 2), doneInWeek(16, 2));
    expect(getWeeklyStreakSummary(habits, logs, TODAY)).toMatchObject({ count: 1, current: 2 });
  });
});

describe('graça em hábito semanal', () => {
  const base = {
    habit: weekly(3),
    dateKey: k(13),
    today: TODAY,
    logs: {} as LogsMap,
    graces: {} as GracesMap,
    perMonth: 1
  };

  it('permite perdoar a semana ainda não cumprida', () => {
    expect(getGraceBlock({ ...base, logs: doneInWeek(9, 1) })).toBeNull();
  });

  it('semana já cumprida não precisa de graça', () => {
    expect(getGraceBlock({ ...base, logs: doneInWeek(9, 3) })).toBe('week-met');
  });

  it('só uma graça por semana (outro dia da mesma semana já perdoado)', () => {
    expect(getGraceBlock({ ...base, dateKey: k(14), graces: { [k(12)]: ['w'] }, perMonth: 2 })).toBe('already');
  });

  it('dia concluído continua não podendo ser perdoado', () => {
    expect(getGraceBlock({ ...base, logs: { [k(13)]: ['w'] } })).toBe('completed');
  });
});

describe('heatmap e taxa de conclusão', () => {
  const habit = weekly(2, { createdAt: new Date(2025, 4, 1).getTime() });

  it('dia com conclusão fica cheio; dias restantes de semana cumprida não penalizam', () => {
    const logs = merge(doneInWeek(9, 2)); // seg 9 e ter 10: meta cumprida
    const days = generateHeatmapDays([habit], logs, TODAY, 14);
    const d = (n: number) => days.find((x) => x.key === k(n))!;
    expect(d(9)).toMatchObject({ scheduledCount: 1, completedCount: 1, ratio: 1 });
    expect(d(10)).toMatchObject({ scheduledCount: 1, completedCount: 1, ratio: 1 });
    expect(d(12)).toMatchObject({ scheduledCount: 0, ratio: 0 }); // sem penalidade
  });

  it('a taxa trata a semana como sucesso ou falha, não cada dia', () => {
    // semana de 2/6: 1 de 2 (falha); semana de 9/6: 2 de 2 (sucesso)
    const logs = merge(doneInWeek(2, 1), doneInWeek(9, 2));
    const days = generateHeatmapDays([habit], logs, TODAY, 14); // 5/6..18/6 não cobre dom 1/6; inclui dom 8 e dom 15
    const sunday8 = days.find((x) => x.key === k(8))!;
    const sunday15 = days.find((x) => x.key === k(15))!;
    expect(sunday8).toMatchObject({ rateScheduled: 1, rateCompleted: 0 });
    expect(sunday15).toMatchObject({ rateScheduled: 1, rateCompleted: 1 });
    expect(calculateRetentionRate(days, 14)).toBe(50);
  });

  it('a semana em andamento não entra na taxa', () => {
    // janela de 16 a 18/6: só a semana em andamento (nenhum domingo encerrando semana)
    const days = generateHeatmapDays([habit], doneInWeek(16, 1), TODAY, 3);
    expect(calculateRetentionRate(days, 3)).toBe(0);
    expect(days.every((x) => (x.rateScheduled ?? 0) === 0)).toBe(true);
  });

  it('a semana da criação só conta se cumprida (evita falha em semana parcial)', () => {
    const recent = weekly(3, { createdAt: new Date(2025, 5, 11).getTime(), weeklyTargetFrom: k(9) }); // criado numa quarta
    expect(weekOutcome(recent, k(9), doneInWeek(11, 1), TODAY)).toBeNull();
    expect(weekOutcome(recent, k(9), doneInWeek(11, 3), TODAY)).toEqual({ met: true });
    expect(weekOutcome(weekly(3), k(9), doneInWeek(9, 1), TODAY)).toEqual({ met: false });
  });

  it('o dia perdoado é sinalizado, sem contar como concluído', () => {
    const days = generateHeatmapDays([habit], doneInWeek(9, 1), TODAY, 14, { [k(12)]: ['w'] });
    const d12 = days.find((x) => x.key === k(12))!;
    expect(d12.gracedCount).toBe(1);
    expect(d12.completedCount).toBe(0);
  });

  it('hábitos de dias fixos não mudam (taxa por dia)', () => {
    const f = fixed();
    const days = generateHeatmapDays([f], { [k(17)]: ['f'], [k(18)]: ['f'] }, TODAY, 2);
    expect(days.map((d) => [d.scheduledCount, d.completedCount, d.rateScheduled, d.rateCompleted])).toEqual([
      [1, 1, 1, 1],
      [1, 1, 1, 1]
    ]);
    expect(calculateRetentionRate(days, 2)).toBe(100);
  });
});

describe('vinculo com o Pomo', () => {
  it('hábito semanal com meta do Pomo é vinculável em qualquer dia da semana', () => {
    const h = weekly(3, { frequency: [], pomoGoal: { type: 'minutes', target: 30 } });
    const wed = date(18);
    expect(getLinkableHabits([h], {}, [], k(18), wed.getDay()).map((x) => x.id)).toEqual(['w']);
  });
});
