import { Capacitor } from '@capacitor/core';
import type { Messaging } from 'firebase/messaging';
import { getFirebaseApp } from './firebase';
import { VAPID_KEY } from './firebaseConfig';
import { isValidVapidKey, type PushFailure, type PushPayloadLike } from './push';

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

/** Push web: só em navegador/PWA com a chave VAPID configurada (no app Android ainda não) */
export function isPushConfigured(): boolean {
  return !Capacitor.isNativePlatform() && isValidVapidKey(VAPID_KEY);
}

export async function isPushSupported(): Promise<boolean> {
  if (Capacitor.isNativePlatform() || typeof Notification === 'undefined' || !('serviceWorker' in navigator)) return false;
  try {
    const mod = await import('firebase/messaging');
    return await mod.isSupported();
  } catch {
    return false;
  }
}

export type EnablePushResult = { ok: true; token: string } | { ok: false; reason: PushFailure };

/** Pede permissão e registra este aparelho no FCM; devolve o token (útil para "mensagem de teste" no Console) */
export async function enablePush(): Promise<EnablePushResult> {
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
    const instance = await getMessagingInstance();
    if (!instance) return;
    const mod = await import('firebase/messaging');
    await mod.deleteToken(instance);
  } catch {
    /* nada a desfazer */
  }
}

/** Token atual, sem pedir permissão (ou null) */
export async function currentPushToken(): Promise<string | null> {
  if (!isValidVapidKey(VAPID_KEY) || typeof Notification === 'undefined' || Notification.permission !== 'granted') return null;
  const result = await enablePush();
  return result.ok ? result.token : null;
}

/** Mensagens recebidas com o app aberto (em segundo plano o Service Worker mostra a notificação) */
export async function onForegroundPush(handler: (payload: PushPayloadLike) => void): Promise<() => void> {
  try {
    const instance = await getMessagingInstance();
    if (!instance) return () => undefined;
    const mod = await import('firebase/messaging');
    return mod.onMessage(instance, (payload) => handler(payload as PushPayloadLike));
  } catch {
    return () => undefined;
  }
}
