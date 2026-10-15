import { describe, it, expect } from 'vitest';
import {
  addSlip,
  avoidDayStatus,
  calculateAvoidStreak,
  calculateBestAvoidStreak,
  canSlipOn,
  getEffectiveCompletedIds,
  isAvoidScheduled,
  normalizeKind,
  removeSlip,
  sanitizeSlips
} from '@/lib/avoid';
import {
  calculateBestStreak,
  calculateDailyProgress,
  calculateRetentionRate,
  calculateStreak,
  generateHeatmapDays,
  getBestCurrentStreak,
  getBestStreak
} from '@/lib/analytics';
import { getGraceBlock } from '@/lib/graces';
import { getHabitsForDate } from '@/lib/analytics';
import { isDueOn, isScheduledOn, isWeeklyOn } from '@/lib/weekly';
import { type Habit, type LogsMap, type SlipsMap } from '@/types/habit';

// Hoje = quarta 18/06/2025 (meio do dia)
const TODAY = new Date(2025, 5, 18, 12);
const k = (d: number, m = 6) => `2025-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const date = (d: number) => new Date(2025, 5, d, 12);

const avoid = (over: Partial<Habit> = {}): Habit => ({
  id: 'a',
  title: 'Não fumar',
  category: 'Saúde',
  icon: 'heart',
  kind: 'avoid',
  frequency: [0, 1, 2, 3, 4, 5, 6],
  createdAt: new Date(2025, 5, 1).getTime(), // 01/06
  ...over
});
const build = (over: Partial<Habit> = {}): Habit => ({
  id: 'b',
  title: 'Ler',
  category: 'Mente',
  icon: 'book',
  frequency: [0, 1, 2, 3, 4, 5, 6],
  createdAt: new Date(2025, 0, 1).getTime(),
  ...over
});

describe('agenda do hábito a evitar', () => {
  it('só vale a partir do dia da criação e nos dias da semana agendados', () => {
    const h = avoid({ createdAt: new Date(2025, 5, 10, 18).getTime() });
    expect(isAvoidScheduled(h, date(9))).toBe(false); // antes de criar
    expect(isAvoidScheduled(h, date(10))).toBe(true); // dia da criação
    expect(isAvoidScheduled(avoid({ frequency: [1] }), date(18))).toBe(false); // quarta, só segunda
    expect(isAvoidScheduled(avoid({ archived: true }), date(18))).toBe(false);
  });

  it('kind: padrão é build; só "avoid" é aceito', () => {
    expect(normalizeKind(undefined)).toBe('build');
    expect(normalizeKind('lixo')).toBe('build');
    expect(normalizeKind('avoid')).toBe('avoid');
  });

  it('aparece na lista a partir da criação e nunca é semanal', () => {
    const h = avoid({ createdAt: new Date(2025, 5, 10).getTime(), weeklyTarget: 3, weeklyTargetFrom: k(2) });
    expect(isScheduledOn(h, date(9))).toBe(false);
    expect(isScheduledOn(h, date(10))).toBe(true);
    expect(isWeeklyOn(h, date(18))).toBe(false); // meta semanal é ignorada
    expect(getHabitsForDate([h, build()], date(18)).map((x) => x.id)).toEqual(['a', 'b']);
    expect(isDueOn(h, date(18), {})).toBe(true);
  });
});

describe('ofensiva de hábito a evitar', () => {
  it('conta os dias desde a criação, com hoje já contando (em andamento)', () => {
    expect(calculateAvoidStreak(avoid(), {}, TODAY)).toBe(18); // 1 a 18/06
  });

  it('hábito novo criado hoje já tem 1 dia (hoje em andamento)', () => {
    const h = avoid({ createdAt: TODAY.getTime() });
    expect(calculateAvoidStreak(h, {}, TODAY)).toBe(1);
    expect(avoidDayStatus(h, k(18), TODAY, {})).toBe('in-progress');
  });

  it('hábito ainda não criado (data futura) não tem ofensiva', () => {
    expect(calculateAvoidStreak(avoid({ createdAt: new Date(2025, 5, 20).getTime() }), {}, TODAY)).toBe(0);
  });

  it('um escorregão recomeça a contagem no dia seguinte', () => {
    const slips: SlipsMap = { [k(10)]: ['a'] };
    expect(calculateAvoidStreak(avoid(), slips, TODAY)).toBe(8); // 11 a 18
  });

  it('escorregão hoje zera; escorregão ontem deixa só o dia de hoje', () => {
    expect(calculateAvoidStreak(avoid(), { [k(18)]: ['a'] }, TODAY)).toBe(0);
    expect(calculateAvoidStreak(avoid(), { [k(17)]: ['a'] }, TODAY)).toBe(1);
  });

  it('escorregão de outro hábito não interfere', () => {
    expect(calculateAvoidStreak(avoid(), { [k(10)]: ['outro'] }, TODAY)).toBe(18);
  });

  it('dias não agendados não quebram nem somam', () => {
    // só dias úteis (seg-sex). 01/06 é domingo. Dias úteis de 2 a 18: 2-6, 9-13, 16-18 = 13
    const h = avoid({ frequency: [1, 2, 3, 4, 5] });
    expect(calculateAvoidStreak(h, {}, TODAY)).toBe(13);
    // escorregão num sábado (não agendado) é ignorado
    expect(calculateAvoidStreak(h, { [k(14)]: ['a'] }, TODAY)).toBe(13);
    // escorregão numa sexta quebra: dias úteis depois de 13/06 = 16, 17, 18
    expect(calculateAvoidStreak(h, { [k(13)]: ['a'] }, TODAY)).toBe(3);
  });

  it('melhor ofensiva: maior trecho limpo desde a criação', () => {
    const slips: SlipsMap = { [k(5)]: ['a'], [k(12)]: ['a'] };
    // 1-4 (4), 6-11 (6), 13-18 (6)
    expect(calculateBestAvoidStreak(avoid(), slips, TODAY)).toBe(6);
    expect(calculateBestAvoidStreak(avoid(), {}, TODAY)).toBe(18);
  });

  it('a melhor ofensiva não diminui depois de um escorregão hoje', () => {
    const slips: SlipsMap = { [k(18)]: ['a'] };
    expect(calculateBestAvoidStreak(avoid(), slips, TODAY)).toBe(17);
    expect(calculateAvoidStreak(avoid(), slips, TODAY)).toBe(0);
  });

  it('calculateStreak/calculateBestStreak delegam e ignoram os logs', () => {
    const h = avoid();
    // logs "marcando" todos os dias não importam para um hábito a evitar
    const logs: LogsMap = Object.fromEntries(Array.from({ length: 18 }, (_, i) => [k(i + 1), ['a']]));
    const slips: SlipsMap = { [k(10)]: ['a'] };
    expect(calculateStreak(h, logs, TODAY, {}, slips)).toBe(8);
    expect(calculateBestStreak(h, logs, TODAY, {}, slips)).toBe(9); // 1-9
    expect(calculateStreak(h, {}, TODAY, {}, slips)).toBe(8);
  });

  it('entra nos resumos de ofensiva (em dias)', () => {
    const slips: SlipsMap = { [k(10)]: ['a'] };
    expect(getBestCurrentStreak([avoid(), build()], {}, TODAY, {}, slips)).toBe(8);
    expect(getBestStreak([avoid()], {}, TODAY, {}, slips)).toBe(9);
  });
});

describe('situação do dia e escorregão', () => {
  const slips: SlipsMap = { [k(10)]: ['a'] };

  it('clean / slipped / in-progress / future / n/a', () => {
    const h = avoid({ createdAt: new Date(2025, 5, 5).getTime() });
    expect(avoidDayStatus(h, k(9), TODAY, slips)).toBe('clean');
    expect(avoidDayStatus(h, k(10), TODAY, slips)).toBe('slipped');
    expect(avoidDayStatus(h, k(18), TODAY, slips)).toBe('in-progress');
    expect(avoidDayStatus(h, k(19), TODAY, slips)).toBe('future');
    expect(avoidDayStatus(h, k(4), TODAY, slips)).toBe('n/a'); // antes de criar
  });

  it('só é possível escorregar em dia agendado, existente e não futuro', () => {
    expect(canSlipOn(avoid(), k(18), TODAY)).toBe(true);
    expect(canSlipOn(avoid(), k(19), TODAY)).toBe(false);
    expect(canSlipOn(avoid({ createdAt: new Date(2025, 5, 10).getTime() }), k(9), TODAY)).toBe(false);
    expect(canSlipOn(avoid({ frequency: [1] }), k(18), TODAY)).toBe(false);
    expect(canSlipOn(build(), k(18), TODAY)).toBe(false); // hábito a construir não tem escorregão
  });

  it('add/remove são idempotentes e descartam dia vazio', () => {
    let s = addSlip({}, k(10), 'a');
    expect(addSlip(s, k(10), 'a')).toBe(s);
    s = addSlip(s, k(10), 'b');
    expect(s[k(10)]).toEqual(['a', 'b']);
    s = removeSlip(removeSlip(s, k(10), 'a'), k(10), 'b');
    expect(s).toEqual({});
    expect(removeSlip(s, k(10), 'x')).toBe(s);
  });

  it('sanitiza dados inválidos', () => {
    expect(sanitizeSlips(null)).toEqual({});
    expect(sanitizeSlips({ [k(10)]: ['a', 'a', 1], lixo: ['x'], [k(11)]: [] })).toEqual({ [k(10)]: ['a'] });
  });

  it('hábito a evitar não usa dia de graça', () => {
    expect(
      getGraceBlock({ habit: avoid(), dateKey: k(17), today: TODAY, logs: {}, graces: {}, perMonth: 1 })
    ).toBe('avoid');
  });
});

describe('progresso diário misto', () => {
  const habits = [build({ id: 'b1' }), build({ id: 'b2' }), avoid({ id: 'a1' }), avoid({ id: 'a2' })];

  it('hábitos a evitar contam como feitos por padrão', () => {
    const done = getEffectiveCompletedIds(habits, k(18), { [k(18)]: ['b2'] }, {}, TODAY);
    expect(done.sort()).toEqual(['a1', 'a2', 'b2']);
    expect(calculateDailyProgress(habits, done)).toBe(75);
  });

  it('o escorregão faz o hábito perder 1', () => {
    const done = getEffectiveCompletedIds(habits, k(18), { [k(18)]: ['b2'] }, { [k(18)]: ['a2'] }, TODAY);
    expect(done.sort()).toEqual(['a1', 'b2']);
    expect(calculateDailyProgress(habits, done)).toBe(50);
  });

  it('ignora logs de hábito a evitar e não conta dia futuro como limpo', () => {
    expect(getEffectiveCompletedIds(habits, k(18), { [k(18)]: ['a1', 'a2'] }, { [k(18)]: ['a1', 'a2'] }, TODAY)).toEqual([]);
    expect(getEffectiveCompletedIds(habits, k(19), {}, {}, TODAY)).toEqual([]);
  });

  it('só avoid: tudo limpo = 100%', () => {
    const only = [avoid({ id: 'a1' }), avoid({ id: 'a2' })];
    expect(calculateDailyProgress(only, getEffectiveCompletedIds(only, k(18), {}, {}, TODAY))).toBe(100);
  });
});

describe('heatmap e taxa', () => {
  it('dia limpo é sucesso; escorregão é falha; antes da criação não conta', () => {
    const h = avoid({ createdAt: new Date(2025, 5, 14).getTime() });
    const days = generateHeatmapDays([h], {}, TODAY, 7, {}, { [k(16)]: ['a'] }); // 12 a 18
    const d = (n: number) => days.find((x) => x.key === k(n))!;
    expect(d(13)).toMatchObject({ scheduledCount: 0, ratio: 0 }); // antes de criar
    expect(d(14)).toMatchObject({ scheduledCount: 1, completedCount: 1, ratio: 1 });
    expect(d(16)).toMatchObject({ scheduledCount: 1, completedCount: 0, ratio: 0 }); // escorregou
    expect(d(18)).toMatchObject({ scheduledCount: 1, completedCount: 1, ratio: 1 }); // hoje: sucesso corrente
    // taxa: 5 dias agendados (14 a 18), 4 limpos
    expect(calculateRetentionRate(days, 7)).toBe(80);
  });

  it('mistura com hábito a construir', () => {
    const days = generateHeatmapDays([build(), avoid()], { [k(17)]: ['b'] }, TODAY, 2, {}, { [k(17)]: ['a'] });
    const d17 = days.find((x) => x.key === k(17))!;
    expect(d17).toMatchObject({ scheduledCount: 2, completedCount: 1, ratio: 0.5 }); // build feito, avoid escorregou
    const d18 = days.find((x) => x.key === k(18))!;
    expect(d18).toMatchObject({ scheduledCount: 2, completedCount: 1, ratio: 0.5 }); // build pendente, avoid limpo
  });

  it('logs de hábito a evitar não contam como conclusão', () => {
    const days = generateHeatmapDays([avoid()], { [k(17)]: ['a'] }, TODAY, 2, {}, { [k(17)]: ['a'] });
    expect(days.find((x) => x.key === k(17))!.completedCount).toBe(0);
  });

  it('dados antigos (sem kind) continuam iguais', () => {
    const days = generateHeatmapDays([build()], { [k(17)]: ['b'] }, TODAY, 2);
    expect(days.map((d) => [d.scheduledCount, d.completedCount])).toEqual([
      [1, 1],
      [1, 0]
    ]);
  });
});
