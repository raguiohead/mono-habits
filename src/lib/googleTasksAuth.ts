import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

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
 * Solicita token de acesso no Android via Capacitor FirebaseAuthentication.
 */
async function getNativeTasksToken(): Promise<string> {
  try {
    const result = await FirebaseAuthentication.signInWithGoogle({
      scopes: [TASKS_SCOPE]
    });

    const accessToken = result.credential?.accessToken;
    if (!accessToken) {
      throw new Error(
        'O plugin nativo do Firebase não retornou o accessToken com o escopo do Google Tasks.'
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
    return await getNativeTasksToken();
  }

  return await getWebTasksToken(interactive);
}
