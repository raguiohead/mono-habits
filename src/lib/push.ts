/** Partes puras do push (Firebase Cloud Messaging): formatação e checagens, sem acesso ao navegador */

/** Canal Android dos avisos; precisa bater com default_notification_channel_id no AndroidManifest.xml */
export const PUSH_CHANNEL_ID = 'avisos';

export interface PushPayloadLike {
  notification?: { title?: unknown; body?: unknown } | null;
  data?: Record<string, unknown> | null;
}

/** O plugin nativo entrega título e corpo na raiz; normaliza para o formato do SDK web */
export function nativePushPayload(notification: { title?: unknown; body?: unknown; data?: unknown }): PushPayloadLike {
  const { title, body, data } = notification;
  return {
    notification: { title, body },
    data: data && typeof data === 'object' ? (data as Record<string, unknown>) : null
  };
}

/** Texto curto para o aviso (toast) quando o app está aberto; vazio se não houver o que mostrar */
export function pushToastText(payload: PushPayloadLike | null | undefined): string {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const title = str(payload?.notification?.title) || str(payload?.data?.title);
  const body = str(payload?.notification?.body) || str(payload?.data?.body);
  const text = title && body ? `${title}: ${body}` : title || body;
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

/** A chave VAPID é pública (base64url, ~87 caracteres); aceita só o formato plausível */
export function isValidVapidKey(key: unknown): key is string {
  return typeof key === 'string' && /^[A-Za-z0-9_-]{60,120}$/.test(key);
}

export type PushFailure = 'unsupported' | 'no-key' | 'denied' | 'error';

export const PUSH_FAILURE_MESSAGE: Record<PushFailure, string> = {
  unsupported: 'Este aparelho ou navegador não suporta avisos por push.',
  'no-key': 'Os avisos por push ainda não foram configurados neste site.',
  denied: 'As notificações estão bloqueadas. Libere nas configurações do aparelho ou do site e tente de novo.',
  error: 'Não foi possível ativar os avisos agora. Tente de novo mais tarde.'
};
