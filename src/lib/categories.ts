import { type Habit } from '@/types/habit';

export const DEFAULT_CATEGORY = 'Geral';

export interface CategoryCount {
  /** Chave normalizada (sem variações de caixa/espaços) */
  key: string;
  /** Rótulo de exibição (primeira variação encontrada) */
  label: string;
  count: number;
}

const clean = (raw: string | undefined | null) => (raw ?? '').trim().replace(/\s+/g, ' ');

/** Chave de agrupamento: ignora caixa e espaços; vazio vira 'Geral'. */
export function categoryKey(raw: string | undefined | null): string {
  return (clean(raw) || DEFAULT_CATEGORY).toLocaleLowerCase('pt-BR');
}

/** Categorias distintas com contagem: contagem desc., depois alfabética (pt-BR). */
export function getCategoryCounts(habits: Pick<Habit, 'category'>[]): CategoryCount[] {
  const map = new Map<string, CategoryCount>();
  for (const h of habits) {
    const key = categoryKey(h.category);
    const entry = map.get(key);
    if (entry) entry.count += 1;
    else map.set(key, { key, label: clean(h.category) || DEFAULT_CATEGORY, count: 1 });
  }
  return [...map.values()].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR')
  );
}
