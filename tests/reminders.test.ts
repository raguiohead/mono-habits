import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const { dueReminder, countPending, reminderBody } = createRequire(import.meta.url)('../functions/lib/reminders.js');

const prefs = { reminderEnabled: true, reminderTime: '20:00', timezone: 'America/Sao_Paulo' };

describe('dueReminder', () => {
  // 23:05 UTC = 20:05 em São Paulo (UTC-3)
  const at = new Date('2026-10-15T23:05:00Z');

  it('dispara após o horário local do usuário', () => {
    expect(dueReminder({ now: at, prefs })).toEqual({ dateKey: '2026-10-15', weekday: 4 });
  });
  it('não dispara antes do horário', () => {
    expect(dueReminder({ now: new Date('2026-10-15T22:55:00Z'), prefs })).toBeNull();
  });
  it('não dispara se já enviado hoje', () => {
    expect(dueReminder({ now: at, prefs: { ...prefs, lastSentKey: '2026-10-15' } })).toBeNull();
  });
  it('não dispara fora da janela de 2h', () => {
    expect(dueReminder({ now: new Date('2026-10-16T02:30:00Z'), prefs })).toBeNull();
  });
  it('respeita lembrete desativado e dados inválidos', () => {
    expect(dueReminder({ now: at, prefs: { ...prefs, reminderEnabled: false } })).toBeNull();
    expect(dueReminder({ now: at, prefs: { ...prefs, reminderTime: '25:00' } })).toBeNull();
    expect(dueReminder({ now: at, prefs: { ...prefs, timezone: 'Nope/Zone' } })).toBeNull();
  });
  it('usa a data local do fuso (virada de dia)', () => {
    // 02:10 UTC de 16/10 ainda é 15/10 às 23:10 em São Paulo
    const r = dueReminder({ now: new Date('2026-10-16T02:10:00Z'), prefs: { ...prefs, reminderTime: '23:00' } });
    expect(r?.dateKey).toBe('2026-10-15');
  });
});

describe('countPending / reminderBody', () => {
  const habits = [
    { id: 'a', frequency: [4] },
    { id: 'b', frequency: [4] },
    { id: 'c', frequency: [1] },
    { id: 'd', frequency: [4], archived: true }
  ];
  it('conta só hábitos de hoje, não arquivados e não concluídos', () => {
    expect(countPending(habits, ['a'], 4)).toBe(1);
    expect(countPending(habits, undefined, 4)).toBe(2);
  });
  it('mensagem no singular/plural', () => {
    expect(reminderBody(1)).toBe('Falta 1 hábito para hoje.');
    expect(reminderBody(3)).toBe('Faltam 3 hábitos para hoje.');
  });
});
