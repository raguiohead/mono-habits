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

/**
 * Exibe uma notificação do sistema. Prefere o Service Worker (necessário no Android/PWA)
 * e cai para a API direta. Retorna false se não foi possível exibir.
 */
export async function showSystemNotification(title: string, body: string, tag: string): Promise<boolean> {
  if (getPermission() !== 'granted') return false;
  const options: NotificationOptions = { body, tag, icon: '/icon-192.png', badge: '/icon-192.png' };
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) {
      await reg.showNotification(title, options);
      return true;
    }
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}
