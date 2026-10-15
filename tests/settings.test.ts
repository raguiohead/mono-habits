import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, isValidTime, sanitizeSettings, shouldSendReminder } from '@/lib/settings';

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
