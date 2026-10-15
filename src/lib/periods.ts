import { type Habit, type HabitPeriod } from '@/types/habit';

/** Ordem em que as seções aparecem na tela de Foco */
export const PERIOD_ORDER: HabitPeriod[] = ['morning', 'afternoon', 'evening', 'any'];

export const PERIOD_LABEL: Record<HabitPeriod, string> = {
  morning: 'Manhã',
  afternoon: 'Tarde',
  evening: 'Noite',
  any: 'Qualquer hora'
};

/** Dados antigos ou inválidos viram 'any' */
export function normalizePeriod(value: unknown): HabitPeriod {
  return value === 'morning' || value === 'afternoon' || value === 'evening' ? value : 'any';
}

/** Manhã 05:00–11:59, tarde 12:00–17:59, noite 18:00–04:59 */
export function getCurrentPeriod(now: Date): Exclude<HabitPeriod, 'any'> {
  const h = now.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'afternoon';
  return 'evening';
}

export interface PeriodSection {
  period: HabitPeriod;
  habits: Habit[];
}

/**
 * Agrupa os hábitos por período, na ordem do dia, omitindo seções vazias.
 * `grouped` é false quando todos são 'any': a tela deve renderizar a lista simples, como antes.
 * A ordem original dos hábitos é preservada dentro de cada seção.
 */
export function groupHabitsByPeriod(habits: Habit[]): { grouped: boolean; sections: PeriodSection[] } {
  const buckets = new Map<HabitPeriod, Habit[]>();
  for (const habit of habits) {
    const period = normalizePeriod(habit.period);
    buckets.set(period, [...(buckets.get(period) ?? []), habit]);
  }
  const sections = PERIOD_ORDER.filter((p) => buckets.has(p)).map((period) => ({
    period,
    habits: buckets.get(period)!
  }));
  const grouped = habits.some((h) => normalizePeriod(h.period) !== 'any');
  return { grouped, sections };
}

/** Uma seção está concluída quando tem hábitos e todos foram feitos */
export function isSectionComplete(section: PeriodSection, completedIds: string[]): boolean {
  return section.habits.length > 0 && section.habits.every((h) => completedIds.includes(h.id));
}
