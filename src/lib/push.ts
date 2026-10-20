/** Partes puras do push (Firebase Cloud Messaging): formatação e checagens, sem acesso ao navegador */

export interface PushPayloadLike {
  notification?: { title?: unknown; body?: unknown } | null;
  data?: Record<string, unknown> | null;
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
  unsupported: 'Este navegador não suporta avisos por push.',
  'no-key': 'Os avisos por push ainda não foram configurados neste site.',
  denied: 'As notificações estão bloqueadas no navegador. Libere nas configurações do site e tente de novo.',
  error: 'Não foi possível ativar os avisos agora. Tente de novo mais tarde.'
};
