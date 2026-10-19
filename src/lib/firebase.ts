import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  reauthenticateWithCredential,
  signOut,
  onAuthStateChanged,
  deleteUser,
  reauthenticateWithPopup,
  type Auth,
  type AuthCredential,
  type User
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  getDocs,
  type DocumentReference,
  type Firestore
} from 'firebase/firestore';
import { clearLocalUserData } from './storage';

const env = import.meta.env;

export const appId = env.VITE_APP_ID || 'mono-habit-tracker';

/** Subcoleções usadas pelo app sob `/artifacts/{appId}/users/{uid}` */
export const USER_COLLECTIONS = ['habits', 'logs', 'graces', 'slips', 'pomoSessions'] as const;

/** Bancos IndexedDB do Firebase Auth/SDK e da fila do Service Worker a apagar na limpeza do aparelho */
export const APP_INDEXED_DB_NAMES = [
  'firebaseLocalStorageDb',
  'firebase-heartbeat-database',
  'firebase-installations-database',
  'mono-habits-sw'
] as const;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyBOi3SkoF6Et81bLEzttdwdZXXP8AlPL-E',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'mono-habits.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'mono-habits',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'mono-habits.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '423856759350',
  appId: env.VITE_FIREBASE_APP_ID || '1:423856759350:web:476fde2f03cfbbcb906e97'
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    // No nativo, getAuth carregaria o resolver de popup/redirect, que trava na WebView
    auth = Capacitor.isNativePlatform()
      ? initializeAuth(app, { persistence: indexedDBLocalPersistence })
      : getAuth(app);
    db = getFirestore(app);
  } catch (error) {
    console.warn('[Firebase] Falha na inicialização:', error);
  }
}

const BATCH_CHUNK_SIZE = 450;

/**
 * Remove em lote (writeBatch) todos os documentos do usuário no Firestore
 * (hábitos, check-ins, dias de graça, escorregões, sessões Pomo e documento raiz do usuário).
 */
export async function deleteAllCloudData(uid: string): Promise<void> {
  if (!db) return;
  const activeDb = db;
  const snaps = await Promise.all(
    USER_COLLECTIONS.map((name) => getDocs(collection(activeDb, 'artifacts', appId, 'users', uid, name)))
  );
  const refs: DocumentReference[] = [];
  for (const snap of snaps) {
    for (const d of snap.docs) {
      refs.push(d.ref);
    }
  }
  refs.push(doc(activeDb, 'artifacts', appId, 'users', uid));

  for (let i = 0; i < refs.length; i += BATCH_CHUNK_SIZE) {
    const batch = writeBatch(activeDb);
    for (const ref of refs.slice(i, i + BATCH_CHUNK_SIZE)) {
      batch.delete(ref);
    }
    await batch.commit();
  }
}

/** Login Google nativo (plugin Capacitor) → credencial do Firebase JS SDK. Lança se o usuário cancelar. */
export async function getNativeGoogleCredential(): Promise<AuthCredential> {
  const result = await FirebaseAuthentication.signInWithGoogle();
  const idToken = result.credential?.idToken;
  if (!idToken) throw new Error('Google não retornou idToken.');
  return GoogleAuthProvider.credential(idToken, result.credential?.accessToken);
}

/** Detecta cancelamento do seletor de contas nativo (as mensagens variam entre versões do Android) */
export function isNativeSignInCanceled(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  return /cancel/i.test(`${e?.code ?? ''} ${e?.message ?? ''}`);
}

/** Encerra a sessão nativa do plugin (ignora erro) */
export async function nativeSignOut(): Promise<void> {
  try {
    await FirebaseAuthentication.signOut();
  } catch {
    // sem sessão nativa: nada a fazer
  }
}

function deleteSingleIndexedDb(idb: IDBFactory, name: string, timeoutMs = 400): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    try {
      const req = idb.deleteDatabase(name);
      const done = () => {
        clearTimeout(timer);
        finish();
      };
      req.onsuccess = done;
      req.onerror = done;
      req.onblocked = done;
    } catch {
      clearTimeout(timer);
      finish();
    }
  });
}

/** Apaga os bancos IndexedDB do Firebase Auth e do app para não restaurar a sessão após reload */
export async function deleteAppIndexedDatabases(
  idb: IDBFactory | null | undefined = typeof indexedDB !== 'undefined' ? indexedDB : null
): Promise<void> {
  if (!idb) return;
  const names = new Set<string>(APP_INDEXED_DB_NAMES);
  if (typeof idb.databases === 'function') {
    try {
      const dbs = await idb.databases();
      for (const info of dbs) {
        if (info?.name && (/^firebase/i.test(info.name) || /^mono-habits/i.test(info.name))) {
          names.add(info.name);
        }
      }
    } catch {
      /* alguns navegadores não expõem indexedDB.databases() */
    }
  }
  await Promise.all(Array.from(names).map((name) => deleteSingleIndexedDb(idb, name)));
}

/**
 * Encerra a sessão Firebase (web e nativa), apaga os bancos IndexedDB da sessão/fila,
 * limpa o localStorage do usuário (incluindo o PIN) e só então recarrega a página.
 */
export async function wipeDeviceDataAndReload(opts?: {
  reload?: () => void;
  signOutFn?: () => Promise<void>;
  nativeSignOutFn?: () => Promise<void>;
  isNative?: boolean;
  idb?: IDBFactory | null;
}): Promise<void> {
  const isNative = opts?.isNative ?? Capacitor.isNativePlatform();
  const runNativeSignOut = opts?.nativeSignOutFn ?? nativeSignOut;
  const runSignOut =
    opts?.signOutFn ??
    (async () => {
      if (auth) await signOut(auth);
    });
  const reload = opts?.reload ?? (() => window.location.reload());

  if (isNative) {
    try {
      await runNativeSignOut();
    } catch {
      /* ignora erro do plugin nativo */
    }
  }
  try {
    await runSignOut();
  } catch {
    /* ignora falha ao deslogar */
  }
  await deleteAppIndexedDatabases(opts?.idb);
  clearLocalUserData();
  reload();
}

export {
  app,
  auth,
  db,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  reauthenticateWithCredential,
  signOut,
  onAuthStateChanged,
  deleteUser,
  reauthenticateWithPopup,
  collection,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  getDocs,
  type User
};
