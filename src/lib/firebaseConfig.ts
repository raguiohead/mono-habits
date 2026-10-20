// Configuração do app web do Firebase (valores públicos). Usada pela página e pelo Service Worker.
// Cast: o Service Worker é checado com tsconfig próprio, sem os tipos do Vite
const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyBOi3SkoF6Et81bLEzttdwdZXXP8AlPL-E',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'mono-habits.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'mono-habits',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'mono-habits.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '423856759350',
  appId: env.VITE_FIREBASE_APP_ID || '1:423856759350:web:476fde2f03cfbbcb906e97',
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || 'G-80Y4TC0MDL'
};

/**
 * Chave pública Web Push (VAPID) do Firebase Cloud Messaging: Console > Configurações do projeto >
 * Cloud Messaging > Certificados Web Push. Sem ela o push web fica indisponível.
 */
export const VAPID_KEY: string = env.VITE_FIREBASE_VAPID_KEY || '';
