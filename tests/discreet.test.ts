import { describe, it, expect } from 'vitest';
import { displayTitle, isDiscreetNow, isHabitHidden } from '@/lib/discreet';
import { DEFAULT_SETTINGS, sanitizeSettings } from '@/lib/settings';
import { buildWeeklySummary } from '@/lib/weeklySummary';
import type { Habit } from '@/types/habit';

const at = (h: number, m = 0) => new Date(2025, 5, 10, h, m);
const auto = (discreetFrom: string, discreetTo: string) => ({ discreetMode: 'auto' as const, discreetFrom, discreetTo });

describe('isDiscreetNow', () => {
  it("'on' sempre e 'off' nunca", () => {
    expect(isDiscreetNow({ ...auto('22:00', '07:00'), discreetMode: 'on' }, at(12))).toBe(true);
    expect(isDiscreetNow({ ...auto('22:00', '07:00'), discreetMode: 'off' }, at(23))).toBe(false);
  });
  it('janela no mesmo dia: início incluso, fim excluso', () => {
    const s = auto('09:00', '17:00');
    expect(isDiscreetNow(s, at(8, 59))).toBe(false);
    expect(isDiscreetNow(s, at(9, 0))).toBe(true);
    expect(isDiscreetNow(s, at(16, 59))).toBe(true);
    expect(isDiscreetNow(s, at(17, 0))).toBe(false);
  });
  it('janela que cruza a meia-noite', () => {
    const s = auto('22:00', '07:00');
    expect(isDiscreetNow(s, at(21, 59))).toBe(false);
    expect(isDiscreetNow(s, at(22, 0))).toBe(true);
    expect(isDiscreetNow(s, at(23, 30))).toBe(true);
    expect(isDiscreetNow(s, at(0, 0))).toBe(true);
    expect(isDiscreetNow(s, at(6, 59))).toBe(true);
    expect(isDiscreetNow(s, at(7, 0))).toBe(false);
    expect(isDiscreetNow(s, at(12, 0))).toBe(false);
  });
  it('horários inválidos ou janela vazia não ativam', () => {
    expect(isDiscreetNow(auto('25:00', '07:00'), at(23))).toBe(false);
    expect(isDiscreetNow(auto('22:00', 'abc'), at(23))).toBe(false);
    expect(isDiscreetNow(auto('', ''), at(23))).toBe(false);
    expect(isDiscreetNow(auto('08:00', '08:00'), at(8))).toBe(false);
  });
});

describe('título oculto', () => {
  const h = { title: 'Terapia', hideTitle: false };
  it('o modo global oculta todos; o hábito oculto continua oculto com o global desligado', () => {
    expect(isHabitHidden(h, false)).toBe(false);
    expect(isHabitHidden(h, true)).toBe(true);
    expect(isHabitHidden({ ...h, hideTitle: true }, false)).toBe(true);
    expect(displayTitle(h, false)).toBe('Terapia');
    expect(displayTitle(h, true)).not.toContain('Terapia');
    expect(displayTitle(h, true, 'Hábito oculto')).toBe('Hábito oculto');
  });
});

describe('configurações do modo discreto', () => {
  it('padrão desligado e valores inválidos voltam ao padrão', () => {
    expect(DEFAULT_SETTINGS.discreetMode).toBe('off');
    const s = sanitizeSettings({ discreetMode: 'xyz', discreetFrom: '99:99', discreetTo: 5 });
    expect(s.discreetMode).toBe('off');
    expect(s.discreetFrom).toBe(DEFAULT_SETTINGS.discreetFrom);
    expect(s.discreetTo).toBe(DEFAULT_SETTINGS.discreetTo);
    expect(sanitizeSettings({ discreetMode: 'auto', discreetFrom: '21:30', discreetTo: '06:15' })).toMatchObject({
      discreetMode: 'auto', discreetFrom: '21:30', discreetTo: '06:15'
    });
  });
});

describe('resumo semanal no modo discreto', () => {
  const base = { icon: 'x', category: 'c', frequency: [0, 1, 2, 3, 4, 5, 6], createdAt: new Date(2025, 0, 1).getTime() };
  const habits = [
    { ...base, id: 'a', title: 'Remédio da depressão' },
    { ...base, id: 'b', title: 'Terapia semanal' },
    { ...base, id: 'c', title: 'Academia' }
  ] as Habit[];
  // 'a' sempre feito, 'b' e 'c' quase nunca, ao longo de várias semanas
  const logs: Record<string, string[]> = {};
  for (let i = 1; i <= 60; i++) {
    const d = new Date(2025, 5, 10 - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    logs[key] = i % 9 === 0 ? ['a', 'b'] : ['a'];
  }
  it('nenhum título aparece nas frases com o modo discreto global', () => {
    const text = buildWeeklySummary(habits, logs, new Date(2025, 5, 2), { today: new Date(2025, 5, 10), discreet: true }).sentences.join(' ');
    for (const h of habits) expect(text).not.toContain(h.title);
    // controle: sem o modo discreto o mesmo resumo cita algum título (o teste não é trivial)
    const plain = buildWeeklySummary(habits, logs, new Date(2025, 5, 2), { today: new Date(2025, 5, 10) }).sentences.join(' ');
    expect(habits.some((h) => plain.includes(h.title))).toBe(true);
  });
});
