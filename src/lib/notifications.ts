import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export type NotifPermission = 'unsupported' | 'default' | 'granted' | 'denied';

// No app nativo (WebView Android) a API Notification não existe: usa LocalNotifications
const NATIVE_CHANNEL_ID = 'mono-habits';

// Cache síncrono do estado da permissão nativa (getPermission é síncrona)
let nativePermission: NotifPermission = 'default';

function mapNativePermission(display: string): NotifPermission {
  if (display === 'granted') return 'granted';
  if (display === 'denied') return 'denied';
  // 'prompt' e 'prompt-with-rationale'
  return 'default';
}

if (Capacitor.isNativePlatform()) {
  LocalNotifications.checkPermissions()
    .then((res) => {
      nativePermission = mapNativePermission(res.display);
    })
    .catch(() => {});
}

let nativeChannelReady: Promise<void> | null = null;

// Cria o canal Android uma única vez (preguiçoso)
function ensureNativeChannel(): Promise<void> {
  if (!nativeChannelReady) {
    nativeChannelReady = LocalNotifications.createChannel({
      id: NATIVE_CHANNEL_ID,
      name: 'MONO // HABITS',
      importance: 5,
      vibration: true,
      visibility: 1
    }).catch((err) => {
      nativeChannelReady = null;
      throw err;
    });
  }
  return nativeChannelReady;
}

// Hash numérico positivo de 31 bits: o mesmo tag gera o mesmo id e substitui a notificação anterior
function hashTag(tag: string): number {
  let h = 0;
  for (let i = 0; i < tag.length; i++) {
    h = (Math.imul(h, 31) + tag.charCodeAt(i)) | 0;
  }
  return h & 0x7fffffff;
}

export function getPermission(): NotifPermission {
  if (Capacitor.isNativePlatform()) return nativePermission;
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function requestPermission(): Promise<NotifPermission> {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await LocalNotifications.requestPermissions();
      nativePermission = mapNativePermission(res.display);
    } catch {
      // mantém o último estado conhecido
    }
    return nativePermission;
  }
  if (getPermission() === 'unsupported') return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return getPermission();
  }
}

export interface NotificationAction {
  action: string;
  title: string;
}

export interface NotificationExtras {
  /** Botões da notificação (só aparecem quando exibida pelo Service Worker e o navegador suporta) */
  actions?: NotificationAction[];
  /** Dados lidos pelo Service Worker no clique */
  data?: Record<string, unknown>;
}

/** Quantos botões o navegador suporta (0 = nenhum, ex.: iOS e Firefox no desktop) */
export function getMaxActions(): number {
  if (Capacitor.isNativePlatform()) return 0;
  if (typeof Notification === 'undefined') return 0;
  const max = (Notification as unknown as { maxActions?: number }).maxActions;
  return typeof max === 'number' ? max : 0;
}

/**
 * Exibe uma notificação do sistema. Prefere o Service Worker (necessário no Android/PWA)
 * e cai para a API direta, que não suporta botões. Retorna false se não foi possível exibir.
 */
export async function showSystemNotification(
  title: string,
  body: string,
  tag: string,
  extras: NotificationExtras = {}
): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    // 'actions' são ignoradas no nativo; mesmo tag → mesmo id → substitui a anterior
    try {
      // O usuário pode ter mudado a permissão nas configurações do Android: revalida o cache
      try {
        const res = await LocalNotifications.checkPermissions();
        nativePermission = mapNativePermission(res.display);
      } catch {
        // em erro mantém o cache
      }
      if (nativePermission !== 'granted') return false;
      await ensureNativeChannel();
      // isExactNotification: false evita a tela de configurações de alarme exato (SCHEDULE_EXACT_ALARM)
      await LocalNotifications.schedule({
        notifications: [{ id: hashTag(tag), title, body, channelId: NATIVE_CHANNEL_ID, isExactNotification: false }]
      });
      return true;
    } catch {
      return false;
    }
  }
  if (getPermission() !== 'granted') return false;
  const actions = (extras.actions ?? []).slice(0, getMaxActions());
  const base: NotificationOptions = {
    body,
    tag,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    ...(extras.data ? { data: extras.data } : {})
  };
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    // showNotification exige um SW ativo; logo após a instalação ele ainda pode não estar
    if (reg?.active) {
      const withActions: NotificationOptions & { actions?: NotificationAction[] } =
        actions.length > 0 ? { ...base, actions } : base;
      await reg.showNotification(title, withActions);
      return true;
    }
    // A API direta não aceita botões (lança TypeError), então eles ficam de fora aqui
    new Notification(title, base);
    return true;
  } catch {
    return false;
  }
}
