/**
 * Fila de conclusões feitas pela notificação ("Marcar como feito").
 * O Service Worker não acessa o localStorage, então grava aqui (via IndexedDB) e o app aplica
 * a fila quando estiver aberto. Este arquivo tem só a lógica pura, usada pelo SW e pelo app.
 */

export interface PendingCompletion {
  habitId: string;
  dateKey: string; // 'YYYY-MM-DD'
  at: number; // epoch ms de quando o botão foi tocado
}

/** Itens mais antigos que isso são descartados, em vez de marcar um dia que já passou */
export const MAX_AGE_MS = 36 * 60 * 60 * 1000;

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidCompletion(value: unknown): value is PendingCompletion {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.habitId === 'string' &&
    v.habitId.length > 0 &&
    typeof v.dateKey === 'string' &&
    DATE_KEY_RE.test(v.dateKey) &&
    typeof v.at === 'number' &&
    Number.isFinite(v.at)
  );
}

const keyOf = (item: PendingCompletion) => `${item.habitId}|${item.dateKey}`;

/** Remove itens inválidos, expirados (> 36h) e duplicados (mesmo hábito e dia, mantém o mais antigo) */
export function normalizeQueue(queue: unknown, now: number): PendingCompletion[] {
  if (!Array.isArray(queue)) return [];
  const byKey = new Map<string, PendingCompletion>();
  for (const item of queue) {
    if (!isValidCompletion(item)) continue;
    if (now - item.at > MAX_AGE_MS) continue;
    const key = keyOf(item);
    const existing = byKey.get(key);
    if (!existing || item.at < existing.at) byKey.set(key, { ...item });
  }
  return [...byKey.values()].sort((a, b) => a.at - b.at);
}

/** Adiciona um item. Um segundo toque no mesmo hábito/dia (clique duplo) não gera item novo */
export function enqueue(queue: unknown, item: PendingCompletion, now: number): PendingCompletion[] {
  return normalizeQueue([...(Array.isArray(queue) ? queue : []), item], now);
}

/** Esvazia a fila: devolve o que deve ser aplicado agora e a fila restante (sempre vazia) */
export function drain(
  queue: unknown,
  now: number
): { ready: PendingCompletion[]; remaining: PendingCompletion[] } {
  return { ready: normalizeQueue(queue, now), remaining: [] };
}
