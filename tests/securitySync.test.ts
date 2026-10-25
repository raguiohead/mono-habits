import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  clearLocalAccountData,
  clearLocalUserData,
  evaluateInitialCloudSync,
  getLastSyncedUid,
  loadLockConfig,
  loadLocalHabits,
  loadLocalLogs,
  loadLocalPomoSessions,
  saveLockConfig,
  saveLocalHabits,
  saveLocalLogs,
  saveLocalPomoSessions,
  setLastSyncedUid,
  DEFAULT_HABITS
} from '@/lib/storage';
import { wipeDeviceDataAndReload, APP_INDEXED_DB_NAMES, createFirestoreDb } from '@/lib/firebase';
import { initializeApp, deleteApp } from 'firebase/app';
import { type Firestore } from 'firebase/firestore';

const store = new Map<string, string>();
const memoryStorage: Storage = {
  get length() {
    return store.size;
  },
  clear: () => store.clear(),
  getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
  key: (index: number) => Array.from(store.keys())[index] ?? null,
  removeItem: (key: string) => {
    store.delete(key);
  },
  setItem: (key: string, value: string) => {
    store.set(key, String(value));
  }
};
Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage, configurable: true, writable: true });

describe('A1 — wipeDeviceDataAndReload (limpeza completa na saída / Esqueci o PIN)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('executa signOut (nativo e web), apaga bancos IndexedDB, limpa localStorage (incluindo PIN e lastSyncedUid) e só então recarrega', async () => {
    const order: string[] = [];

    saveLocalHabits(DEFAULT_HABITS);
    saveLockConfig({
      enabled: true,
      pin: { hash: 'aa', salt: 'bb', iterations: 100000, length: 4 },
      timeoutMinutes: 0,
      failedAttempts: 0,
      lockedUntil: 0
    });
    setLastSyncedUid('user-123');

    const deletedDbs: string[] = [];
    const fakeIdb = {
      databases: async () => [
        { name: 'firebaseLocalStorageDb' },
        { name: 'firebase-extra-db' },
        { name: 'firestore/[DEFAULT]/mono-habits/main' }
      ],
      deleteDatabase: (name: string) => {
        deletedDbs.push(name);
        order.push(`idb:${name}`);
        const req: { onsuccess?: () => void; onerror?: () => void; onblocked?: () => void } = {};
        queueMicrotask(() => req.onsuccess?.());
        return req as unknown as IDBOpenDBRequest;
      }
    } as unknown as IDBFactory;

    await wipeDeviceDataAndReload({
      isNative: true,
      nativeSignOutFn: async () => {
        // Enquanto desloga, o PIN ainda deve estar ativo no localStorage caso a aba feche no meio
        expect(loadLockConfig().enabled).toBe(true);
        order.push('nativeSignOut');
      },
      signOutFn: async () => {
        expect(loadLockConfig().enabled).toBe(true);
        order.push('firebaseSignOut');
      },
      idb: fakeIdb,
      reload: () => {
        order.push('reload');
      }
    });

    expect(order[0]).toBe('nativeSignOut');
    expect(order[1]).toBe('firebaseSignOut');
    expect(order[order.length - 1]).toBe('reload');
    for (const dbName of APP_INDEXED_DB_NAMES) {
      expect(deletedDbs).toContain(dbName);
    }
    expect(deletedDbs).toContain('firebase-extra-db');
    expect(deletedDbs).toContain('firestore/[DEFAULT]/mono-habits/main');
    expect(loadLocalHabits()).toEqual([]);
    expect(loadLockConfig().enabled).toBe(false);
    expect(getLastSyncedUid()).toBeNull();
  });

  it('apaga o banco IndexedDB do Firestore persistente e chama terminate e clearIndexedDbPersistence na ordem correta', async () => {
    const order: string[] = [];
    const deletedDbs: string[] = [];
    const fakeDb = { type: 'firestore-mock' } as unknown as Firestore;
    const fakeIdb = {
      databases: async () => [
        { name: 'firestore/[DEFAULT]/mono-habits/main' },
        { name: 'random-unrelated-db' }
      ],
      deleteDatabase: (name: string) => {
        deletedDbs.push(name);
        order.push(`idb:${name}`);
        const req: { onsuccess?: () => void } = {};
        queueMicrotask(() => req.onsuccess?.());
        return req as unknown as IDBOpenDBRequest;
      }
    } as unknown as IDBFactory;

    const terminateFn = vi.fn(async (_db: Firestore) => {
      order.push('terminate');
    });
    const clearFn = vi.fn(async (_db: Firestore) => {
      order.push('clearPersistence');
    });
    const reload = vi.fn(() => {
      order.push('reload');
    });

    await wipeDeviceDataAndReload({
      isNative: false,
      signOutFn: async () => {},
      firestoreDb: fakeDb,
      terminateFirestoreFn: terminateFn,
      clearFirestorePersistenceFn: clearFn,
      idb: fakeIdb,
      reload
    });

    expect(terminateFn).toHaveBeenCalledWith(fakeDb);
    expect(clearFn).toHaveBeenCalledWith(fakeDb);
    expect(order.indexOf('terminate')).toBeLessThan(order.indexOf('clearPersistence'));
    expect(order.indexOf('clearPersistence')).toBeLessThan(order.indexOf('idb:firestore/[DEFAULT]/mono-habits/main'));
    expect(deletedDbs).toContain('firestore/[DEFAULT]/mono-habits/main');
    expect(deletedDbs).not.toContain('random-unrelated-db');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('prossegue com a limpeza e reload mesmo se terminate ou clearIndexedDbPersistence lançarem erro', async () => {
    const reload = vi.fn();
    const deletedDbs: string[] = [];
    const fakeIdb = {
      databases: async () => [{ name: 'firestore/[DEFAULT]/mono-habits/main' }],
      deleteDatabase: (name: string) => {
        deletedDbs.push(name);
        const req: { onsuccess?: () => void } = {};
        queueMicrotask(() => req.onsuccess?.());
        return req as unknown as IDBOpenDBRequest;
      }
    } as unknown as IDBFactory;

    await wipeDeviceDataAndReload({
      isNative: false,
      signOutFn: async () => {},
      firestoreDb: {} as Firestore,
      terminateFirestoreFn: async () => {
        throw new Error('Falha ao terminar');
      },
      clearFirestorePersistenceFn: async () => {
        throw new Error('Falha ao limpar persistência');
      },
      idb: fakeIdb,
      reload
    });

    expect(deletedDbs).toContain('firestore/[DEFAULT]/mono-habits/main');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('prossegue com a limpeza e reload mesmo se signOut falhar ou deleteDatabase bloquear', async () => {
    saveLocalHabits(DEFAULT_HABITS);
    const reload = vi.fn();
    const fakeIdb = {
      deleteDatabase: () => {
        const req: { onsuccess?: () => void; onerror?: () => void; onblocked?: () => void } = {};
        queueMicrotask(() => req.onblocked?.());
        return req as unknown as IDBOpenDBRequest;
      }
    } as unknown as IDBFactory;

    await wipeDeviceDataAndReload({
      isNative: false,
      signOutFn: async () => {
        throw new Error('rede indisponível');
      },
      idb: fakeIdb,
      reload
    });

    expect(loadLocalHabits()).toEqual([]);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('M1 — isolamento entre contas no mesmo aparelho (evaluateInitialCloudSync)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('migra local→nuvem apenas quando a conta na nuvem está 100% vazia e sem outro uid prévio', () => {
    const res = evaluateInitialCloudSync({
      currentUid: 'uid-a',
      lastSyncedUid: null,
      remoteCounts: { habits: 0, logs: 0, graces: 0, slips: 0, pomoSessions: 0 },
      localCounts: { habits: 2, logs: 1, graces: 0, slips: 0, pomoSessions: 3 }
    });
    expect(res).toEqual({ discardLocal: false, migrateLocalToCloud: true });
  });

  it('NÃO migra coleções locais se a conta na nuvem já tiver qualquer dado (ex.: hábitos existem, mas slips/pomo vazios)', () => {
    const res = evaluateInitialCloudSync({
      currentUid: 'uid-a',
      lastSyncedUid: null,
      remoteCounts: { habits: 1, logs: 0, graces: 0, slips: 0, pomoSessions: 0 },
      localCounts: { habits: 0, logs: 2, graces: 1, slips: 1, pomoSessions: 4 }
    });
    expect(res).toEqual({ discardLocal: false, migrateLocalToCloud: false });
  });

  it('descarta dados locais e bloqueia migração quando lastSyncedUid pertence a outra conta', () => {
    const res = evaluateInitialCloudSync({
      currentUid: 'uid-b',
      lastSyncedUid: 'uid-a',
      remoteCounts: { habits: 0, logs: 0, graces: 0, slips: 0, pomoSessions: 0 },
      localCounts: { habits: 3, logs: 5, graces: 1, slips: 1, pomoSessions: 2 }
    });
    expect(res).toEqual({ discardLocal: true, migrateLocalToCloud: false });
  });

  it('clearLocalAccountData apaga hábitos/logs/pomo da conta anterior preservando o bloqueio por PIN', () => {
    saveLocalHabits(DEFAULT_HABITS);
    saveLocalLogs({ '2026-10-18': ['habit-1'] });
    saveLocalPomoSessions([
      {
        id: 'pomo-1',
        kind: 'focus',
        startedAt: 1000,
        endedAt: 2000,
        plannedSeconds: 1500,
        actualSeconds: 1500,
        completed: true
      }
    ]);
    saveLockConfig({
      enabled: true,
      pin: { hash: 'h', salt: 's', iterations: 100000, length: 4 },
      timeoutMinutes: 5,
      failedAttempts: 0,
      lockedUntil: 0
    });

    clearLocalAccountData();

    expect(loadLocalHabits()).toEqual([]);
    expect(loadLocalLogs()).toEqual({});
    expect(loadLocalPomoSessions()).toEqual([]);
    expect(loadLockConfig().enabled).toBe(true);

    clearLocalUserData();
    expect(loadLockConfig().enabled).toBe(false);
  });
});

describe('UX-01 — Inicialização do Firestore com persistentLocalCache e fallback seguro', () => {
  it('inicializa o Firestore com cache persistente e retorna instância válida', async () => {
    const dummyApp = initializeApp({ apiKey: 'fake-api-key', projectId: 'demo-cache-test' }, `test-app-${Date.now()}-1`);
    const firestore = createFirestoreDb(dummyApp);
    expect(firestore).toBeDefined();
    expect(firestore.app).toBe(dummyApp);
    await deleteApp(dummyApp);
  });

  it('faz fallback seguro para getFirestore caso initializeFirestore lance erro (ex.: já iniciado ou sem IndexedDB)', async () => {
    const dummyApp = initializeApp({ apiKey: 'fake-api-key', projectId: 'demo-fallback-test' }, `test-app-${Date.now()}-2`);
    const firstDb = createFirestoreDb(dummyApp);
    // Chamada subsequente no mesmo app lança no initializeFirestore e cai no fallback getFirestore
    const secondDb = createFirestoreDb(dummyApp);
    expect(secondDb).toBeDefined();
    expect(secondDb).toBe(firstDb);
    await deleteApp(dummyApp);
  });
});
