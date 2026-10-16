/** Limite de caracteres da descrição opcional de um hábito */
export const HABIT_DESCRIPTION_MAX = 140;

/**
 * Normaliza a descrição: colapsa quebras de linha e espaços repetidos, apara as pontas e
 * trunca no limite. Vazia (ou não textual) vira undefined, para não gravar campo vazio.
 */
export function sanitizeHabitDescription(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const clean = value.replace(/\s+/g, ' ').trim();
  if (!clean) return undefined;
  const cut = Array.from(clean).slice(0, HABIT_DESCRIPTION_MAX).join('').trimEnd();
  return cut || undefined;
}
