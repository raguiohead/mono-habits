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
import { wipeDeviceDataAndReload, APP_INDEXED_DB_NAMES } from '@/lib/firebase';

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
      databases: async () => [{ name: 'firebaseLocalStorageDb' }, { name: 'firebase-extra-db' }],
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
    expect(loadLocalHabits()).toEqual([]);
    expect(loadLockConfig().enabled).toBe(false);
    expect(getLastSyncedUid()).toBeNull();
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
