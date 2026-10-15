import type { Habit } from '@/types/habit';

export const MAX_FEATURED = 2;

/** Quantos hábitos ativos já estão em destaque (opcionalmente ignorando um) */
export function countFeatured(habits: Habit[], exceptId?: string): number {
  return habits.filter((h) => h.featured && !h.archived && h.id !== exceptId).length;
}

/** Dá para destacar este hábito? (no máximo MAX_FEATURED ativos em destaque) */
export function canFeature(habits: Habit[], habitId?: string): boolean {
  return countFeatured(habits, habitId) < MAX_FEATURED;
}

/** Só os hábitos ativos em destaque valem no layout; acima do limite, os demais viram células comuns */
export function featuredIds(habits: Habit[]): Set<string> {
  return new Set(habits.filter((h) => h.featured && !h.archived).slice(0, MAX_FEATURED).map((h) => h.id));
}
