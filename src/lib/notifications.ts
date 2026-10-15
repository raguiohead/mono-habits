export type NotifPermission = 'unsupported' | 'default' | 'granted' | 'denied';

export function getPermission(): NotifPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function requestPermission(): Promise<NotifPermission> {
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
