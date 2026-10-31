import { Capacitor } from '@capacitor/core';
import type { Messaging } from 'firebase/messaging';
import { getFirebaseApp } from './firebase';
import { VAPID_KEY } from './firebaseConfig';
import { PUSH_CHANNEL_ID, isValidVapidKey, nativePushPayload, type PushFailure, type PushPayloadLike } from './push';

let messaging: Messaging | null = null;

async function getMessagingInstance(): Promise<Messaging | null> {
  if (messaging) return messaging;
  const app = getFirebaseApp();
  if (!app) return null;
  const mod = await import('firebase/messaging');
  if (!(await mod.isSupported())) return null;
  messaging = mod.getMessaging(app);
  return messaging;
}

/** Tempo máximo esperando o token do FCM no app Android (sem rede ou sem Google Play Services ele não chega) */
const NATIVE_REGISTER_TIMEOUT_MS = 15000;

/** Android: plugin nativo do Capacitor. Web/PWA: exige a chave VAPID configurada */
export function isPushConfigured(): boolean {
  if (Capacitor.isNativePlatform()) return Capacitor.isPluginAvailable('PushNotifications');
  return isValidVapidKey(VAPID_KEY);
}

export async function isPushSupported(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) return isPushConfigured();
  if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) return false;
  try {
    const mod = await import('firebase/messaging');
    return await mod.isSupported();
  } catch {
    return false;
  }
}

export type EnablePushResult = { ok: true; token: string } | { ok: false; reason: PushFailure };

/** Android: pede a permissão do sistema, cria o canal e espera o token do FCM */
async function enableNativePush(): Promise<EnablePushResult> {
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    let { receive } = await PushNotifications.checkPermissions();
    if (receive !== 'granted') ({ receive } = await PushNotifications.requestPermissions());
    if (receive !== 'granted') return { ok: false, reason: 'denied' };

    await PushNotifications.createChannel({
      id: PUSH_CHANNEL_ID,
      name: 'Novidades do app',
      description: 'Avisos ocasionais sobre novas versões e funções',
      importance: 3
    });

    return await new Promise<EnablePushResult>((resolve) => {
      const listeners = [
        PushNotifications.addListener('registration', ({ value }) => finish({ ok: true, token: value })),
        PushNotifications.addListener('registrationError', () => finish({ ok: false, reason: 'error' }))
      ];
      const timer = setTimeout(() => finish({ ok: false, reason: 'error' }), NATIVE_REGISTER_TIMEOUT_MS);
      function finish(result: EnablePushResult): void {
        clearTimeout(timer);
        listeners.forEach((listener) => void listener.then((handle) => handle.remove()));
        resolve(result);
      }
      // Os listeners precisam estar ativos antes do register(), que entrega o token por evento
      void Promise.all(listeners)
        .then(() => PushNotifications.register())
        .catch(() => finish({ ok: false, reason: 'error' }));
    });
  } catch {
    return { ok: false, reason: 'error' };
  }
}

/** Pede permissão e registra este aparelho no FCM; devolve o token (útil para "mensagem de teste" no Console) */
export async function enablePush(): Promise<EnablePushResult> {
  if (Capacitor.isNativePlatform()) return enableNativePush();
  if (!isValidVapidKey(VAPID_KEY)) return { ok: false, reason: 'no-key' };
  if (!(await isPushSupported())) return { ok: false, reason: 'unsupported' };
  try {
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'denied' };
    const instance = await getMessagingInstance();
    if (!instance) return { ok: false, reason: 'unsupported' };
    const registration = await navigator.serviceWorker.ready;
    const mod = await import('firebase/messaging');
    const token = await mod.getToken(instance, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    return token ? { ok: true, token } : { ok: false, reason: 'error' };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

/** Cancela o registro deste aparelho no FCM */
export async function disablePush(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      await PushNotifications.unregister();
      return;
    }
    const instance = await getMessagingInstance();
    if (!instance) return;
    const mod = await import('firebase/messaging');
    await mod.deleteToken(instance);
  } catch {
    /* nada a desfazer */
  }
}

/** Permissão de notificações negada no sistema (Android) ou no navegador */
export async function isPushBlocked(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const { receive } = await PushNotifications.checkPermissions();
      return receive === 'denied';
    } catch {
      return false;
    }
  }
  return typeof Notification !== 'undefined' && Notification.permission === 'denied';
}

/** Token atual, sem pedir permissão (ou null) */
export async function currentPushToken(): Promise<string | null> {
  if (Capacitor.isNativePlatform()) return null;
  if (!isValidVapidKey(VAPID_KEY) || typeof Notification === 'undefined' || Notification.permission !== 'granted') return null;
  const result = await enablePush();
  return result.ok ? result.token : null;
}

/** Mensagens recebidas com o app aberto (em segundo plano quem mostra é o Service Worker ou o Android) */
export async function onForegroundPush(handler: (payload: PushPayloadLike) => void): Promise<() => void> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const handle = await PushNotifications.addListener('pushNotificationReceived', (notification) =>
        handler(nativePushPayload(notification))
      );
      return () => void handle.remove();
    }
    const instance = await getMessagingInstance();
    if (!instance) return () => undefined;
    const mod = await import('firebase/messaging');
    return mod.onMessage(instance, (payload) => handler(payload as PushPayloadLike));
  } catch {
    return () => undefined;
  }
}
