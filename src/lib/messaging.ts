import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { app, db, doc, setDoc, appId } from './firebase';
import { showSystemNotification } from './notifications';

const env = import.meta.env;
const vapidKey: string | undefined = env.VITE_FIREBASE_VAPID_KEY;

/** Registra o SW do FCM passando a config pública do Firebase via query string. */
async function registerMessagingSW(): Promise<ServiceWorkerRegistration> {
  const qs = new URLSearchParams({
    apiKey: env.VITE_FIREBASE_API_KEY || '',
    projectId: env.VITE_FIREBASE_PROJECT_ID || '',
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: env.VITE_FIREBASE_APP_ID || ''
  });
  return navigator.serviceWorker.register(`/firebase-messaging-sw.js?${qs}`);
}

let unsubscribeForeground: (() => void) | null = null;

/**
 * Obtém o token FCM do dispositivo e o salva em users/{uid}/fcmTokens/{token}
 * (coberto pelas regras do Firestore existentes). Exige permissão de notificação já concedida.
 * Retorna o token ou null se push não estiver disponível.
 */
export async function registerPushToken(uid: string): Promise<string | null> {
  if (!app || !db || !vapidKey) return null;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return null;
  try {
    if (!(await isSupported())) return null;
    const registration = await registerMessagingSW();
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
    if (!token) return null;

    await setDoc(
      doc(db, 'artifacts', appId, 'users', uid, 'fcmTokens', token),
      { token, userAgent: navigator.userAgent, updatedAt: Date.now() },
      { merge: true }
    );

    // Mensagens recebidas com o app aberto não são exibidas pelo SDK: mostramos manualmente.
    unsubscribeForeground?.();
    unsubscribeForeground = onMessage(messaging, (payload) => {
      const title = payload.notification?.title || payload.data?.title || 'MONO // HABITS';
      const body = payload.notification?.body || payload.data?.body || '';
      void showSystemNotification(title, body, payload.data?.tag || 'push');
    });
    return token;
  } catch (error) {
    console.warn('[FCM] Falha ao registrar token:', error);
    return null;
  }
}

/**
 * Publica as preferências de lembrete para a Cloud Function que envia o push diário.
 * O fuso do aparelho é enviado junto, para o horário ser respeitado onde o usuário estiver.
 */
export async function syncReminderPrefs(
  uid: string,
  prefs: { reminderEnabled: boolean; reminderTime: string }
): Promise<void> {
  if (!db) return;
  try {
    await setDoc(
      doc(db, 'artifacts', appId, 'users', uid, 'prefs', 'notifications'),
      {
        reminderEnabled: prefs.reminderEnabled,
        reminderTime: prefs.reminderTime,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        updatedAt: Date.now()
      },
      { merge: true }
    );
  } catch (error) {
    console.warn('[FCM] Falha ao sincronizar preferências:', error);
  }
}
