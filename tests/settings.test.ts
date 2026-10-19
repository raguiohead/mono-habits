import { describe, it, expect } from 'vitest';
import {
  buildNativeReminderPlan,
  DEFAULT_SETTINGS,
  isValidTime,
  sanitizeSettings,
  shouldSendReminder
} from '@/lib/settings';
import { type Habit } from '@/types/habit';

describe('sanitizeSettings', () => {
  it('retorna o padrão para dados ausentes ou inválidos', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('lixo')).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ textSize: 'gigante', reminderTime: '25:99', sound: 'sim' })).toEqual(DEFAULT_SETTINGS);
  });

  it('preserva valores válidos', () => {
    const s = sanitizeSettings({
      textSize: 'large',
      motion: 'reduce',
      highContrast: true,
      reminderEnabled: true,
      reminderTime: '07:30',
      sound: false
    });
    expect(s).toMatchObject({
      textSize: 'large',
      motion: 'reduce',
      highContrast: true,
      reminderEnabled: true,
      reminderTime: '07:30',
      sound: false,
      vibration: true
    });
  });
});

describe('focusLayout', () => {
  it('aceita list, bento e gallery; desconhecido vira list', () => {
    expect(sanitizeSettings({ focusLayout: 'gallery' }).focusLayout).toBe('gallery');
    expect(sanitizeSettings({ focusLayout: 'bento' }).focusLayout).toBe('bento');
    expect(sanitizeSettings({ focusLayout: 'list' }).focusLayout).toBe('list');
    expect(sanitizeSettings({ focusLayout: 'masonry' }).focusLayout).toBe('list');
    expect(sanitizeSettings({ focusLayout: 42 }).focusLayout).toBe('list');
  });
});

describe('isValidTime', () => {
  it('valida o formato HH:MM', () => {
    expect(isValidTime('00:00')).toBe(true);
    expect(isValidTime('23:59')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('7:30')).toBe(false);
    expect(isValidTime(null)).toBe(false);
  });
});

describe('shouldSendReminder', () => {
  const base = { time: '20:00', lastSentKey: null, todayKey: '2026-10-15', pendingCount: 2 };

  it('não envia antes do horário', () => {
    expect(shouldSendReminder({ ...base, now: new Date(2026, 9, 15, 19, 59) })).toBe(false);
  });

  it('envia a partir do horário', () => {
    expect(shouldSendReminder({ ...base, now: new Date(2026, 9, 15, 20, 0) })).toBe(true);
    expect(shouldSendReminder({ ...base, now: new Date(2026, 9, 15, 23, 30) })).toBe(true);
  });

  it('não repete no mesmo dia', () => {
    expect(shouldSendReminder({ ...base, lastSentKey: '2026-10-15', now: new Date(2026, 9, 15, 21, 0) })).toBe(false);
  });

  it('não envia sem hábitos pendentes ou com horário inválido', () => {
    expect(shouldSendReminder({ ...base, pendingCount: 0, now: new Date(2026, 9, 15, 21, 0) })).toBe(false);
    expect(shouldSendReminder({ ...base, time: 'xx', now: new Date(2026, 9, 15, 21, 0) })).toBe(false);
  });
});

describe('buildNativeReminderPlan', () => {
  const mkHabit = (id: string, freq: number[], extra: Partial<Habit> = {}): Habit => ({
    id,
    title: `Hábito ${id}`,
    category: 'Geral',
    icon: 'target',
    frequency: freq,
    createdAt: new Date(2026, 0, 1).getTime(),
    ...extra
  });

  it('retorna vazio quando desativado ou horário inválido', () => {
    const h = [mkHabit('h1', [0, 1, 2, 3, 4, 5, 6])];
    expect(
      buildNativeReminderPlan({
        now: new Date(2026, 9, 15, 10, 0),
        reminderEnabled: false,
        reminderTime: '20:00',
        weeklySummaryInReminder: false,
        lastSentKey: null,
        habits: h,
        logs: {}
      })
    ).toEqual({
      immediate: null,
      scheduled: [],
      markSentKey: null,
      nextScheduledToday: null,
      clearDeliveredToday: false
    });
  });

  it('agenda hoje (se antes do horário) e os dias futuros com hábitos previstos, ignorando avoid e dias vazios', () => {
    // 2026-10-15 é quinta-feira (day = 4)
    const habits: Habit[] = [
      mkHabit('h1', [4, 5]), // quinta (offset 0) e sexta (offset 1)
      mkHabit('h2', [4]), // só quinta (offset 0)
      mkHabit('avoid1', [0, 1, 2, 3, 4, 5, 6], { kind: 'avoid' }) // nunca entra
    ];
    const plan = buildNativeReminderPlan({
      now: new Date(2026, 9, 15, 18, 0),
      reminderEnabled: true,
      reminderTime: '20:00',
      weeklySummaryInReminder: false,
      lastSentKey: null,
      habits,
      logs: { '2026-10-15': ['h2'] } // h2 já feito hoje -> falta só 1 hoje
    });

    expect(plan.immediate).toBeNull();
    expect(plan.markSentKey).toBeNull();
    expect(plan.nextScheduledToday).toEqual({ dateKey: '2026-10-15', time: '20:00' });
    expect(plan.clearDeliveredToday).toBe(false);
    expect(plan.scheduled.map((s) => ({ offset: s.offset, dateKey: s.dateKey, body: s.body }))).toEqual([
      { offset: 0, dateKey: '2026-10-15', body: 'Falta 1 hábito para hoje.' },
      { offset: 1, dateKey: '2026-10-16', body: 'Falta 1 hábito para hoje.' }
    ]);
  });

  it('dispara imediato se o horário de hoje já passou e não havia agendamento prévio, mantendo agendamentos futuros', () => {
    const habits: Habit[] = [mkHabit('h1', [4, 5]), mkHabit('h2', [5])];
    const plan = buildNativeReminderPlan({
      now: new Date(2026, 9, 15, 21, 0),
      reminderEnabled: true,
      reminderTime: '20:00',
      weeklySummaryInReminder: false,
      lastSentKey: null,
      habits,
      logs: {}
    });

    expect(plan.immediate).toEqual({
      dateKey: '2026-10-15',
      body: 'Falta 1 hábito para hoje.'
    });
    expect(plan.markSentKey).toBe('2026-10-15');
    expect(plan.nextScheduledToday).toBeNull();
    expect(plan.scheduled.map((s) => ({ offset: s.offset, body: s.body }))).toEqual([
      { offset: 1, body: 'Faltam 2 hábitos para hoje.' }
    ]);
  });

  it('não dispara immediate duplicado quando o lembrete de hoje já tinha sido agendado para o mesmo horário, e limpa se todos concluídos', () => {
    const habits: Habit[] = [mkHabit('h1', [4, 5])];
    const afterScheduled = buildNativeReminderPlan({
      now: new Date(2026, 9, 15, 21, 0),
      reminderEnabled: true,
      reminderTime: '20:00',
      weeklySummaryInReminder: false,
      lastSentKey: null,
      scheduledToday: { dateKey: '2026-10-15', time: '20:00' },
      habits,
      logs: {}
    });

    expect(afterScheduled.immediate).toBeNull();
    expect(afterScheduled.markSentKey).toBe('2026-10-15');
    expect(afterScheduled.nextScheduledToday).toBeNull();

    // Quando o hábito de hoje é concluído antes do horário: limpa scheduledToday e pede clearDeliveredToday
    const allDoneBeforeTime = buildNativeReminderPlan({
      now: new Date(2026, 9, 15, 19, 0),
      reminderEnabled: true,
      reminderTime: '20:00',
      weeklySummaryInReminder: false,
      lastSentKey: null,
      scheduledToday: { dateKey: '2026-10-15', time: '20:00' },
      habits,
      logs: { '2026-10-15': ['h1'] }
    });
    expect(allDoneBeforeTime.nextScheduledToday).toBeNull();
    expect(allDoneBeforeTime.clearDeliveredToday).toBe(true);
    expect(allDoneBeforeTime.scheduled.map((s) => s.offset)).toEqual([1]);
  });

  it('inclui resumo semanal apenas quando hoje é domingo e weeklySummaryInReminder está ativo', () => {
    // 2026-10-18 é domingo (day = 0)
    const habits: Habit[] = [mkHabit('h1', [1, 2, 3, 4, 5, 6])];
    const plan = buildNativeReminderPlan({
      now: new Date(2026, 9, 18, 10, 0),
      reminderEnabled: true,
      reminderTime: '20:00',
      weeklySummaryInReminder: true,
      lastSentKey: null,
      habits,
      logs: { '2026-10-12': ['h1'], '2026-10-13': ['h1'], '2026-10-14': ['h1'] }
    });

    expect(plan.scheduled[0]?.offset).toBe(0);
    expect(plan.scheduled[0]?.body).toContain('50%');
  });
});

