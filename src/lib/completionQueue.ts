import { drain, enqueue, type PendingCompletion } from './pendingCompletions';

/**
 * Persistência da fila em IndexedDB (acessível pelo Service Worker e pelo app).
 * A fila inteira fica em um único registro e cada operação roda em UMA transação readwrite,
 * então dois toques seguidos, ou duas abas drenando ao mesmo tempo, não duplicam nem perdem itens.
 */

const DB_NAME = 'mono-habits-sw';
const STORE = 'pendingCompletions';
const KEY = 'queue';

/** Mensagem enviada pelo SW aos clientes abertos quando a fila recebe um item */
export const QUEUE_MESSAGE_TYPE = 'pending-completions';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Lê a fila, aplica `update` e grava o resultado na mesma transação; devolve o valor calculado */
async function transact<T>(update: (queue: unknown) => { next: PendingCompletion[]; result: T }): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      let result: T;
      const getReq = store.get(KEY);
      getReq.onsuccess = () => {
        const out = update(getReq.result);
        result = out.result;
        store.put(out.next, KEY);
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export function enqueueCompletion(item: PendingCompletion, now = Date.now()): Promise<void> {
  return transact((queue) => ({ next: enqueue(queue, item, now), result: undefined }));
}

/** Retorna os itens a aplicar e deixa a fila vazia */
export function drainCompletions(now = Date.now()): Promise<PendingCompletion[]> {
  return transact((queue) => {
    const { ready, remaining } = drain(queue, now);
    return { next: remaining, result: ready };
  });
}
