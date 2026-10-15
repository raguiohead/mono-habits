import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  deleteUser,
  reauthenticateWithPopup,
  type Auth,
  type User
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  type Firestore
} from 'firebase/firestore';

const env = import.meta.env;

export const appId = env.VITE_APP_ID || 'mono-habit-tracker';

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
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
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (error) {
    console.warn('[Firebase] Falha na inicialização:', error);
  }
}

/** Remove todos os documentos do usuário no Firestore (hábitos, check-ins, sessões Pomo, tokens de push e preferências) */
export async function deleteAllCloudData(uid: string): Promise<void> {
  if (!db) return;
  for (const name of ['habits', 'logs', 'pomoSessions', 'fcmTokens', 'prefs']) {
    const snap = await getDocs(collection(db, 'artifacts', appId, 'users', uid, name));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  }
}

export {
  app,
  auth,
  db,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  deleteUser,
  reauthenticateWithPopup,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  type User
};
