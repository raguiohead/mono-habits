import { describe, it, expect } from 'vitest';
import { USAGE_EVENT_NAMES, isDoNotTrack, sanitizeUsageEvent } from '@/lib/usage';
import { isValidVapidKey, pushToastText } from '@/lib/push';
import { DEFAULT_SETTINGS, sanitizeSettings } from '@/lib/settings';

describe('eventos de uso (lista fechada)', () => {
  it('só aceita eventos conhecidos', () => {
    expect(sanitizeUsageEvent('habit_title_changed', { title: 'Terapia' })).toBeNull();
    expect(sanitizeUsageEvent('__proto__')).toBeNull();
    expect(sanitizeUsageEvent('constructor')).toBeNull();
    expect(USAGE_EVENT_NAMES).toContain('screen_view');
  });
  it('mantém só parâmetros permitidos com valores permitidos', () => {
    expect(sanitizeUsageEvent('screen_view', { tab: 'pomo' })).toEqual({ name: 'screen_view', params: { tab: 'pomo' } });
    expect(sanitizeUsageEvent('screen_view', { tab: 'Terapia da depressão' })).toEqual({ name: 'screen_view', params: {} });
    expect(sanitizeUsageEvent('habit_created', { kind: 'avoid', title: 'segredo', email: 'a@b.c' })).toEqual({
      name: 'habit_created',
      params: { kind: 'avoid' }
    });
    expect(sanitizeUsageEvent('discreet_toggle', { enabled: true })).toEqual({ name: 'discreet_toggle', params: { enabled: 'true' } });
  });
  it('nenhum valor livre sobrevive, qualquer que seja o evento', () => {
    for (const name of USAGE_EVENT_NAMES) {
      const out = sanitizeUsageEvent(name, { tab: 'x', kind: 'x', type: 'x', enabled: 'x', title: 'x', habitId: 'x' });
      expect(out).not.toBeNull();
      expect(Object.keys(out!.params)).toEqual([]);
    }
  });
  it('respeita "Não rastrear"', () => {
    expect(isDoNotTrack({ doNotTrack: '1' })).toBe(true);
    expect(isDoNotTrack({ doNotTrack: 'yes' })).toBe(true);
    expect(isDoNotTrack({ doNotTrack: '0' })).toBe(false);
    expect(isDoNotTrack({ doNotTrack: null })).toBe(false);
    expect(isDoNotTrack(undefined)).toBe(false);
  });
});

describe('push', () => {
  it('pushToastText junta título e corpo, aceita data e corta o excesso', () => {
    expect(pushToastText({ notification: { title: 'Novidade', body: 'Wrapped chegou' } })).toBe('Novidade: Wrapped chegou');
    expect(pushToastText({ notification: { title: 'Só título' } })).toBe('Só título');
    expect(pushToastText({ data: { title: 'T', body: 'B' } })).toBe('T: B');
    expect(pushToastText({ notification: { title: 5 as unknown as string } })).toBe('');
    expect(pushToastText(null)).toBe('');
    expect(pushToastText({ notification: { body: 'x'.repeat(300) } }).length).toBeLessThanOrEqual(160);
  });
  it('valida o formato da chave VAPID', () => {
    expect(isValidVapidKey('B' + 'a1_-'.repeat(21))).toBe(true);
    expect(isValidVapidKey('')).toBe(false);
    expect(isValidVapidKey('curta')).toBe(false);
    expect(isValidVapidKey('tem espaço' + 'a'.repeat(70))).toBe(false);
    expect(isValidVapidKey(undefined)).toBe(false);
  });
});

describe('configurações opcionais', () => {
  it('analytics e push começam desligados e a leitura é estrita', () => {
    expect(DEFAULT_SETTINGS.analyticsEnabled).toBe(false);
    expect(DEFAULT_SETTINGS.pushEnabled).toBe(false);
    expect(sanitizeSettings({ analyticsEnabled: 'yes', pushEnabled: 1 })).toMatchObject({ analyticsEnabled: false, pushEnabled: false });
    expect(sanitizeSettings({ analyticsEnabled: true, pushEnabled: true })).toMatchObject({ analyticsEnabled: true, pushEnabled: true });
  });
});
