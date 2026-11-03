import { Capacitor, registerPlugin } from '@capacitor/core';
import {
  isNoCredentialsError,
  isNativeSignInCanceled,
  NO_GOOGLE_ACCOUNTS_MESSAGE
} from './firebase';

export { isNoCredentialsError, isNativeSignInCanceled, NO_GOOGLE_ACCOUNTS_MESSAGE };

export interface GoogleTasksAuthPlugin {
  authorize(options?: { interactive?: boolean }): Promise<{ accessToken: string }>;
}

export const GoogleTasksAuth = registerPlugin<GoogleTasksAuthPlugin>('GoogleTasksAuth');

export const GOOGLE_TASKS_API_DISABLED_MESSAGE =
  'A API do Google Tasks está desativada no Google Cloud. Ative-a no console do projeto e tente de novo.';

export const GOOGLE_TASKS_PERMISSION_DENIED_MESSAGE =
  'Permissão para acessar o Google Tasks não concedida. Autorize o acesso para sincronizar suas tarefas.';

export const GOOGLE_TASKS_NETWORK_ERROR_MESSAGE =
  'Sem conexão com a internet. Verifique sua rede e tente de novo.';

export const GOOGLE_TASKS_GENERIC_ERROR_MESSAGE =
  'Não foi possível conectar ao Google Tasks. Tente novamente mais tarde.';

export const GOOGLE_TASKS_CONSENT_REQUIRED_MESSAGE =
  'Autorização necessária para sincronizar com o Google Tasks. Reconecte sua conta.';

export type GoogleTasksErrorKind =
  | 'canceled'
  | 'no_credentials'
  | 'consent_required'
  | 'api_disabled'
  | 'permission_denied'
  | 'network'
  | 'session_expired'
  | 'generic';

function getErrorString(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return `${error.name} ${error.message} ${(error as any).stack ?? ''}`;
  const e = error as Record<string, unknown>;
  return `${e.code ?? ''} ${e.message ?? ''} ${e.errorMessage ?? ''} ${e.error ?? ''} ${JSON.stringify(error)}`;
}

/**
 * Detecta se o erro indica necessidade de consentimento / autorização interativa.
 */
export function isConsentRequiredError(error: unknown): boolean {
  if (!error) return false;
  const code = (error as any)?.code;
  if (typeof code === 'string' && /consent_required/i.test(code)) return true;
  const text = getErrorString(error);
  return /consent_required|consent\s+required/i.test(text);
}

/**
 * Classifica categoricamente a origem do erro do fluxo do Google Tasks.
 */
export function classifyGoogleTasksError(error: unknown): GoogleTasksErrorKind {
  if (isNativeSignInCanceled(error)) return 'canceled';
  if (isNoCredentialsError(error)) return 'no_credentials';
  if (isConsentRequiredError(error)) return 'consent_required';

  const text = getErrorString(error);

  // 403 / API desativada
  if (
    /403/i.test(text) ||
    /service_disabled/i.test(text) ||
    /has not been used in project/i.test(text) ||
    /is disabled/i.test(text) ||
    /api desativada/i.test(text)
  ) {
    return 'api_disabled';
  }

  // Permissão / escopo negado
  if (
    /access_denied|permission_denied|insufficient.*scope|permiss[aã]o negada|n[aã]o autorizado/i.test(
      text
    )
  ) {
    return 'permission_denied';
  }

  // Sem rede / offline
  if (
    (typeof navigator !== 'undefined' && navigator.onLine === false) ||
    /failed to fetch|network\s*error|networkrequestfailed|offline|net::err|sem conex[aã]o|sem internet|econnrefused/i.test(
      text
    )
  ) {
    return 'network';
  }

  // 401 / Sessão expirada
  if (/401|expirad[ao]|invalid_grant/i.test(text)) {
    return 'session_expired';
  }

  return 'generic';
}

/**
 * Retorna mensagem em PT-BR para exibição ao usuário sem JSON cru.
 * Retorna `null` caso o erro seja cancelamento pelo usuário (ação silenciosa).
 */
export function formatGoogleTasksError(error: unknown): string | null {
  const kind = classifyGoogleTasksError(error);
  switch (kind) {
    case 'canceled':
      return null;
    case 'no_credentials':
      return NO_GOOGLE_ACCOUNTS_MESSAGE;
    case 'consent_required':
      return GOOGLE_TASKS_CONSENT_REQUIRED_MESSAGE;
    case 'api_disabled':
      return GOOGLE_TASKS_API_DISABLED_MESSAGE;
    case 'permission_denied':
      return GOOGLE_TASKS_PERMISSION_DENIED_MESSAGE;
    case 'network':
      return GOOGLE_TASKS_NETWORK_ERROR_MESSAGE;
    case 'session_expired':
      return 'Sessão do Google Tasks expirada. Reconecte sua conta.';
    case 'generic':
    default:
      return GOOGLE_TASKS_GENERIC_ERROR_MESSAGE;
  }
}

export const TASKS_SCOPE = 'https://www.googleapis.com/auth/tasks';

export const GOOGLE_WEB_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ||
  '423856759350-pgh3hnujmc75cg6maojd3p3f9oampnvi.apps.googleusercontent.com';

interface TokenCache {
  token: string;
  expiresAt: number; // epoch ms
}

/**
 * TOKEN DE ACESSO EXCLUSIVAMENTE EM MEMÓRIA.
 * Conforme requisito de segurança, nunca é gravado no Firestore ou localStorage.
 */
let inMemoryToken: TokenCache | null = null;

/**
 * Retorna true se houver token válido em memória (com margem de 60 segundos antes de expirar).
 */
/**
 * Sync em background (sem gesto do usuário) só pode pedir token quando isso não abre UI:
 * no Android o plugin nativo obtém o token em silêncio; na web o GIS abriria um popup (bloqueado sem clique).
 */
export function canSyncInBackground(): boolean {
  return Capacitor.isNativePlatform() || hasValidTasksToken();
}

export function hasValidTasksToken(): boolean {
  if (!inMemoryToken) return false;
  return Date.now() < inMemoryToken.expiresAt - 60_000;
}

/**
 * Limpa o token em memória (ao desconectar ou em caso de token inválido/revogado).
 */
export function clearTasksToken(): void {
  inMemoryToken = null;
}

/**
 * Carrega a biblioteca Google Identity Services na Web se ainda não estiver carregada.
 */
function loadGsiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Falha ao carregar Google Identity Services.')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Falha ao carregar script do Google Identity Services.'));
    document.head.appendChild(script);
  });
}

/**
 * Solicita token de acesso na Web via Google Identity Services Token Client.
 */
async function getWebTasksToken(interactive = true): Promise<string> {
  await loadGsiScript();
  const google = (window as any).google;
  if (!google?.accounts?.oauth2) {
    throw new Error('Google Identity Services indisponível.');
  }

  return new Promise((resolve, reject) => {
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_WEB_CLIENT_ID,
        scope: TASKS_SCOPE,
        callback: (resp: { access_token?: string; expires_in?: number; error?: string }) => {
          if (resp.error) {
            reject(new Error(`Erro OAuth Google: ${resp.error}`));
            return;
          }
          if (!resp.access_token) {
            reject(new Error('Token de acesso não retornado pelo Google.'));
            return;
          }
          const expiresInSeconds = Number(resp.expires_in) || 3600;
          inMemoryToken = {
            token: resp.access_token,
            expiresAt: Date.now() + expiresInSeconds * 1000
          };
          resolve(resp.access_token);
        },
        error_callback: (err: unknown) => {
          reject(err instanceof Error ? err : new Error('Falha na autenticação do Google Tasks.'));
        }
      });

      // Se interactive = false, tenta silenciosamente (prompt vazio); se falhar o usuário deve clicar em conectar
      client.requestAccessToken({ prompt: interactive ? '' : 'none' });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Solicita token de acesso no Android via plugin nativo GoogleTasksAuth.
 */
async function getNativeTasksToken(interactive = true): Promise<string> {
  try {
    const result = await GoogleTasksAuth.authorize({ interactive });
    const accessToken = result?.accessToken;
    if (!accessToken) {
      throw new Error(
        'O plugin nativo GoogleTasksAuth não retornou o accessToken com o escopo do Google Tasks.'
      );
    }

    // Token nativo dura em média 3600s
    inMemoryToken = {
      token: accessToken,
      expiresAt: Date.now() + 3500 * 1000
    };

    return accessToken;
  } catch (error: any) {
    console.error('[GoogleTasksAuth Native]', error);
    if (isConsentRequiredError(error)) {
      const consentErr: any = new Error('Consent required');
      consentErr.code = 'consent_required';
      throw consentErr;
    }
    throw error;
  }
}

/**
 * Obtém o token de acesso com escopo do Google Tasks.
 * Se já houver token válido em memória, reutiliza sem chamar a rede.
 */
export async function getTasksToken(opts?: { interactive?: boolean }): Promise<string> {
  if (hasValidTasksToken() && inMemoryToken) {
    return inMemoryToken.token;
  }

  const interactive = opts?.interactive ?? true;

  if (Capacitor.isNativePlatform()) {
    return await getNativeTasksToken(interactive);
  }

  return await getWebTasksToken(interactive);
}
