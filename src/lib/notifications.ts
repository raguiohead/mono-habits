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

/** Faixa fixa de IDs para lembretes diários nativos (hoje = 1000, até +6 dias = 1006) */
export const NATIVE_REMINDER_BASE_ID = 1000;
const NATIVE_REMINDER_IDS = [1000, 1001, 1002, 1003, 1004, 1005, 1006];

/** ID fixo para a notificação agendada de fim do Pomo no nativo */
export const NATIVE_POMO_ID = 2000;

// Tokens de sequência por canal (lembretes e Pomo) para evitar que um schedule com awaits
// sobrescreva um cancel ou um novo schedule disparado logo depois.
let reminderSeq = 0;
let pomoSeq = 0;

/** Revalida o estado da permissão nativa no Android (ex.: ao voltar das configurações do sistema) */
export async function refreshNativePermission(): Promise<NotifPermission> {
  if (!Capacitor.isNativePlatform()) return getPermission();
  try {
    const res = await LocalNotifications.checkPermissions();
    nativePermission = mapNativePermission(res.display);
  } catch {
    /* mantém o cache */
  }
  return nativePermission;
}

/** Remove a notificação de lembrete de hoje já entregue da bandeja do sistema (1000 e hashTag('daily-reminder')) */
export async function removeDeliveredTodayReminder(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.removeDeliveredNotificationsById({
      ids: [NATIVE_REMINDER_BASE_ID, hashTag('daily-reminder')]
    });
  } catch {
    /* ignora falha */
  }
}

/** Cancela todos os lembretes diários agendados no nativo (IDs 1000–1006) */
export async function cancelNativeReminders(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  reminderSeq += 1;
  try {
    await LocalNotifications.cancel({
      notifications: NATIVE_REMINDER_IDS.map((id) => ({ id }))
    });
  } catch {
    /* ignora falha de cancelamento */
  }
}

/**
 * Cancela os lembretes anteriores (1000–1006) e agenda os novos para os próximos dias no nativo.
 * Usa alarme inexato com `allowWhileIdle: true` (funciona com o app fechado sem exigir SCHEDULE_EXACT_ALARM).
 */
export async function scheduleNativeReminders(
  items: { offset: number; at: Date; body: string }[]
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  const seq = ++reminderSeq;
  try {
    await LocalNotifications.cancel({
      notifications: NATIVE_REMINDER_IDS.map((id) => ({ id }))
    });
  } catch {
    /* ignora falha de cancelamento */
  }
  if (seq !== reminderSeq) return false;
  if (items.length === 0) return true;
  try {
    try {
      const res = await LocalNotifications.checkPermissions();
      nativePermission = mapNativePermission(res.display);
    } catch {
      /* mantém o cache */
    }
    if (seq !== reminderSeq || nativePermission !== 'granted') return false;
    await ensureNativeChannel();
    if (seq !== reminderSeq) return false;
    await LocalNotifications.schedule({
      notifications: items.map((it) => ({
        id: NATIVE_REMINDER_BASE_ID + it.offset,
        title: 'MONO // HABITS',
        body: it.body,
        channelId: NATIVE_CHANNEL_ID,
        schedule: { at: it.at, allowWhileIdle: true },
        isExactNotification: false
      }))
    });
    return true;
  } catch {
    return false;
  }
}

/** Cancela a notificação agendada do Pomo no nativo (ID 2000) e opcionalmente remove a já entregue da bandeja */
export async function cancelNativePomoNotification(removeDelivered: boolean = false): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  pomoSeq += 1;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: NATIVE_POMO_ID }] });
  } catch {
    /* ignora falha de cancelamento */
  }
  if (removeDelivered) {
    try {
      await LocalNotifications.removeDeliveredNotificationsById({ ids: [NATIVE_POMO_ID] });
    } catch {
      /* ignora falha de remoção */
    }
  }
}

/** Verifica se o alarme exato está concedido no Android (sem abrir configurações) */
export async function checkNativeExactAlarm(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const res = await LocalNotifications.checkExactNotificationSetting();
    return res.exact_alarm === 'granted';
  } catch {
    return false;
  }
}

/** Abre a tela do sistema Android para permitir alarmes exatos e retorna se foi concedido */
export async function openNativeExactAlarmSetting(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const res = await LocalNotifications.changeExactNotificationSetting();
    return res.exact_alarm === 'granted';
  } catch {
    return false;
  }
}

/**
 * Agenda a notificação de fim do Pomo no nativo para `endsAt` (ID 2000).
 * Se alarmes exatos estiverem concedidos (`checkExactNotificationSetting() === 'granted'`),
 * agenda com exatidão (`isExactNotification: true`); caso contrário, usa alarme inexato
 * (`isExactNotification: false`, `allowWhileIdle: true`) sem abrir a tela de configurações.
 */
export async function scheduleNativePomoNotification(endsAt: number, body: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  const seq = ++pomoSeq;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: NATIVE_POMO_ID }] });
  } catch {
    /* ignora falha de cancelamento */
  }
  if (seq !== pomoSeq || endsAt <= Date.now()) return false;
  try {
    try {
      const res = await LocalNotifications.checkPermissions();
      nativePermission = mapNativePermission(res.display);
    } catch {
      /* mantém o cache */
    }
    if (seq !== pomoSeq || nativePermission !== 'granted') return false;
    await ensureNativeChannel();
    if (seq !== pomoSeq) return false;
    const exact = await checkNativeExactAlarm();
    if (seq !== pomoSeq || endsAt <= Date.now()) return false;
    await LocalNotifications.schedule({
      notifications: [
        {
          id: NATIVE_POMO_ID,
          title: 'MONO // HABITS · Pomo',
          body,
          channelId: NATIVE_CHANNEL_ID,
          schedule: { at: new Date(endsAt), allowWhileIdle: true },
          isExactNotification: exact
        }
      ]
    });
    return true;
  } catch {
    return false;
  }
}

