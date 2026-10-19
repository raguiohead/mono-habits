import type { Habit } from '@/types/habit';
import { isValidTime, type AppSettings } from './settings';

export const HIDDEN_TITLE = '•••••••••••';
export const HIDDEN_LABEL = 'Hábito oculto';

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/**
 * O modo discreto global está ativo agora? 'on' sempre, 'off' nunca. 'auto' vale dentro da janela
 * [discreetFrom, discreetTo), que pode cruzar a meia-noite (22:00 a 07:00). Horários inválidos ou
 * janela vazia (início = fim) não ativam nada.
 */
export function isDiscreetNow(
  settings: Pick<AppSettings, 'discreetMode' | 'discreetFrom' | 'discreetTo'>,
  now: Date
): boolean {
  if (settings.discreetMode === 'on') return true;
  if (settings.discreetMode !== 'auto') return false;
  if (!isValidTime(settings.discreetFrom) || !isValidTime(settings.discreetTo)) return false;
  const from = toMinutes(settings.discreetFrom);
  const to = toMinutes(settings.discreetTo);
  if (from === to) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  return from < to ? cur >= from && cur < to : cur >= from || cur < to;
}

/** Título oculto: pela escolha do hábito (olho) ou pelo modo discreto global */
export const isHabitHidden = (habit: Pick<Habit, 'hideTitle'>, discreet: boolean): boolean =>
  Boolean(habit.hideTitle) || discreet;

/** Único ponto que decide o que mostrar no lugar do título; use no lugar de habit.title */
export const displayTitle = (habit: Pick<Habit, 'title' | 'hideTitle'>, discreet: boolean, hidden = HIDDEN_TITLE): string =>
  isHabitHidden(habit, discreet) ? hidden : habit.title;
