import { describe, it, expect } from 'vitest';
import {
  GRACE_WINDOW_DAYS,
  addGrace,
  canUseGrace,
  getGraceBlock,
  graceRemaining,
  graceUsed,
  isGraced,
  monthKeyOf,
  removeGrace,
  sanitizeGraces
} from '@/lib/graces';
import { calculateBestStreak, calculateStreak, generateHeatmapDays, calculateRetentionRate } from '@/lib/analytics';
import { DEFAULT_SETTINGS, sanitizeSettings } from '@/lib/settings';
import { type GracesMap, type Habit, type LogsMap } from '@/types/habit';

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1',
  title: 'Ler',
  category: 'Mente',
  icon: 'book',
  frequency: [0, 1, 2, 3, 4, 5, 6],
  createdAt: new Date(2025, 0, 1).getTime(),
  ...over
});

const TODAY = new Date(2025, 5, 15, 12); // domingo, 15/06/2025
const key = (d: number, m = 6) => `2025-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const opts = (over: Record<string, unknown> = {}) => ({
  habit: habit(),
  dateKey: key(14),
  today: TODAY,
  logs: {} as LogsMap,
  graces: {} as GracesMap,
  perMonth: 1,
  ...over
});

describe('cota de dias de graça', () => {
  it('é por hábito e por mês civil do dia perdoado', () => {
    const graces: GracesMap = { [key(3)]: ['h1'], [key(10, 5)]: ['h1'], [key(4)]: ['outro'] };
    expect(monthKeyOf(key(3))).toBe('2025-06');
    expect(graceUsed('h1', '2025-06', graces)).toBe(1);
    expect(graceRemaining('h1', '2025-06', graces, 1)).toBe(0);
    expect(graceRemaining('h1', '2025-06', graces, 2)).toBe(1);
    // outro mês e outro hábito não interferem
    expect(graceRemaining('h1', '2025-05', {}, 1)).toBe(1);
    expect(graceRemaining('outro', '2025-06', graces, 1)).toBe(0);
    expect(graceRemaining('novo', '2025-06', graces, 1)).toBe(1);
  });

  it('virada de mês: a cota volta no mês seguinte', () => {
    const graces: GracesMap = { [key(30, 6)]: ['h1'] };
    expect(graceRemaining('h1', '2025-06', graces, 1)).toBe(0);
    expect(graceRemaining('h1', '2025-07', graces, 1)).toBe(1);
  });

  it('nunca fica negativa (ex.: usuário reduziu a cota depois)', () => {
    const graces: GracesMap = { [key(1)]: ['h1'], [key(2)]: ['h1'] };
    expect(graceRemaining('h1', '2025-06', graces, 1)).toBe(0);
  });

  it('desfazer devolve a cota', () => {
    let g = addGrace({}, key(14), 'h1');
    expect(graceRemaining('h1', '2025-06', g, 1)).toBe(0);
    g = removeGrace(g, key(14), 'h1');
    expect(graceRemaining('h1', '2025-06', g, 1)).toBe(1);
    expect(g).toEqual({}); // dia vazio é descartado
  });

  it('add/remove são idempotentes e imutáveis', () => {
    const base: GracesMap = { [key(14)]: ['a'] };
    expect(addGrace(base, key(14), 'a')).toBe(base);
    expect(removeGrace(base, key(14), 'zzz')).toBe(base);
    expect(addGrace(base, key(14), 'b')[key(14)]).toEqual(['a', 'b']);
    expect(base[key(14)]).toEqual(['a']);
  });
});

describe('quando pode usar o dia de graça', () => {
  it('permite um dia perdido recente', () => {
    expect(getGraceBlock(opts())).toBeNull();
    expect(canUseGrace(opts({ dateKey: key(15) }))).toBe(true); // hoje, ainda pendente
  });

  it('bloqueia quando desativado (cota 0)', () => {
    expect(getGraceBlock(opts({ perMonth: 0 }))).toBe('disabled');
  });

  it('bloqueia dia futuro e fora da janela de 7 dias', () => {
    expect(getGraceBlock(opts({ dateKey: key(16) }))).toBe('future');
    expect(GRACE_WINDOW_DAYS).toBe(7);
    expect(getGraceBlock(opts({ dateKey: key(9) }))).toBeNull(); // hoje - 6
    expect(getGraceBlock(opts({ dateKey: key(8) }))).toBe('too-old'); // hoje - 7
  });

  it('bloqueia dia NÃO agendado do hábito', () => {
    // 14/06/2025 é sábado (6); o hábito só ocorre de segunda a sexta
    const weekdays = habit({ frequency: [1, 2, 3, 4, 5] });
    expect(getGraceBlock(opts({ habit: weekdays, dateKey: key(14) }))).toBe('not-scheduled');
    expect(getGraceBlock(opts({ habit: weekdays, dateKey: key(13) }))).toBeNull(); // sexta
    expect(getGraceBlock(opts({ habit: habit({ archived: true }) }))).toBe('not-scheduled');
  });

  it('bloqueia dia anterior à criação do hábito', () => {
    const recent = habit({ createdAt: new Date(2025, 5, 14).getTime() });
    expect(getGraceBlock(opts({ habit: recent, dateKey: key(13) }))).toBe('not-scheduled');
    expect(getGraceBlock(opts({ habit: recent, dateKey: key(14) }))).toBeNull();
  });

  it('dia concluído de verdade nunca consome cota', () => {
    expect(getGraceBlock(opts({ logs: { [key(14)]: ['h1'] } }))).toBe('completed');
  });

  it('bloqueia dia já perdoado e cota esgotada no mês', () => {
    expect(getGraceBlock(opts({ graces: { [key(14)]: ['h1'] } }))).toBe('already');
    expect(getGraceBlock(opts({ graces: { [key(12)]: ['h1'] } }))).toBe('no-quota');
    expect(getGraceBlock(opts({ graces: { [key(12)]: ['h1'] }, perMonth: 2 }))).toBeNull();
    // cota de outro hábito não conta
    expect(getGraceBlock(opts({ graces: { [key(12)]: ['outro'] } }))).toBeNull();
  });
});

describe('ofensiva atravessando um dia perdoado', () => {
  // concluído de 10 a 12 e de 14 a 15; dia 13 perdido
  const logs: LogsMap = {
    [key(10)]: ['h1'],
    [key(11)]: ['h1'],
    [key(12)]: ['h1'],
    [key(14)]: ['h1'],
    [key(15)]: ['h1']
  };

  it('sem graça, o dia perdido quebra a ofensiva', () => {
    expect(calculateStreak(habit(), logs, TODAY)).toBe(2);
    expect(calculateBestStreak(habit(), logs, TODAY)).toBe(3);
  });

  it('com graça, não quebra e não soma +1', () => {
    const graces: GracesMap = { [key(13)]: ['h1'] };
    expect(calculateStreak(habit(), logs, TODAY, graces)).toBe(5); // 15,14,(13 perdoado),12,11,10
    expect(calculateBestStreak(habit(), logs, TODAY, graces)).toBe(5);
  });

  it('desfazer a graça volta a quebrar a ofensiva', () => {
    const graces = removeGrace({ [key(13)]: ['h1'] }, key(13), 'h1');
    expect(calculateStreak(habit(), logs, TODAY, graces)).toBe(2);
  });

  it('graça de outro hábito não afeta este', () => {
    expect(calculateStreak(habit(), logs, TODAY, { [key(13)]: ['outro'] })).toBe(2);
  });

  it('o dia perdoado não soma: 3 concluídos + 1 perdoado = 3', () => {
    const l: LogsMap = { [key(15)]: ['h1'], [key(13)]: ['h1'], [key(12)]: ['h1'] };
    expect(calculateStreak(habit(), l, TODAY, { [key(14)]: ['h1'] })).toBe(3);
  });

  it('hoje pendente e perdoado não quebra a ofensiva', () => {
    const l: LogsMap = { [key(14)]: ['h1'], [key(13)]: ['h1'] };
    expect(calculateStreak(habit(), l, TODAY, { [key(15)]: ['h1'] })).toBe(2);
  });
});

describe('heatmap e taxa', () => {
  it('sinaliza o dia perdoado, sem contá-lo como concluído', () => {
    const habits = [habit(), habit({ id: 'h2' })];
    const logs: LogsMap = { [key(15)]: ['h1', 'h2'], [key(14)]: ['h1'] };
    const graces: GracesMap = { [key(14)]: ['h2'] };
    const days = generateHeatmapDays(habits, logs, TODAY, 2, graces);
    const d14 = days.find((d) => d.key === key(14))!;
    expect(d14.completedCount).toBe(1);
    expect(d14.gracedCount).toBe(1);
    expect(d14.ratio).toBe(0.5);
    expect(days.find((d) => d.key === key(15))!.gracedCount).toBe(0);
    // a taxa não considera o perdão como conclusão: 3 de 4
    expect(calculateRetentionRate(days, 2)).toBe(75);
  });

  it('graça sobre um hábito concluído no dia não é sinalizada', () => {
    const days = generateHeatmapDays([habit()], { [key(14)]: ['h1'] }, TODAY, 2, { [key(14)]: ['h1'] });
    expect(days.find((d) => d.key === key(14))!.gracedCount).toBe(0);
  });
});

describe('persistência e configuração', () => {
  it('sanitiza dados inválidos do armazenamento', () => {
    expect(sanitizeGraces(null)).toEqual({});
    expect(
      sanitizeGraces({ [key(14)]: ['a', 'a', 1, ''], lixo: ['x'], [key(13)]: 'x', [key(12)]: [] })
    ).toEqual({ [key(14)]: ['a'] });
    expect(isGraced({ [key(14)]: ['a'] }, key(14), 'a')).toBe(true);
  });

  it('graceDaysPerMonth: padrão 1 e aceita só 0, 1 ou 2', () => {
    expect(DEFAULT_SETTINGS.graceDaysPerMonth).toBe(1);
    expect(sanitizeSettings({ graceDaysPerMonth: 0 }).graceDaysPerMonth).toBe(0);
    expect(sanitizeSettings({ graceDaysPerMonth: 2 }).graceDaysPerMonth).toBe(2);
    expect(sanitizeSettings({ graceDaysPerMonth: 5 }).graceDaysPerMonth).toBe(1);
    expect(sanitizeSettings({ graceDaysPerMonth: '2' }).graceDaysPerMonth).toBe(1);
  });
});
