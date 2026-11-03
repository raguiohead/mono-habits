import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  isNoCredentialsError,
  isNativeSignInCanceled,
  NO_GOOGLE_ACCOUNTS_MESSAGE
} from '@/lib/firebase';
import {
  classifyGoogleTasksError,
  formatGoogleTasksError,
  GOOGLE_TASKS_API_DISABLED_MESSAGE,
  GOOGLE_TASKS_PERMISSION_DENIED_MESSAGE,
  GOOGLE_TASKS_NETWORK_ERROR_MESSAGE,
  GOOGLE_TASKS_GENERIC_ERROR_MESSAGE
} from '@/lib/googleTasksAuth';

describe('isNoCredentialsError', () => {
  it('detecta erro do Credential Manager 28433 em strings', () => {
    expect(isNoCredentialsError('No credentials available')).toBe(true);
    expect(isNoCredentialsError('[28433] No credentials available')).toBe(true);
    expect(isNoCredentialsError('androidx.credentials.exceptions.GetCredentialException: [28433] No credentials available')).toBe(true);
    expect(isNoCredentialsError('GetCredentialNoCredentialsException')).toBe(true);
    expect(isNoCredentialsError('No credential available')).toBe(true);
  });

  it('detecta em instâncias de Error', () => {
    expect(isNoCredentialsError(new Error('No credentials available'))).toBe(true);
    expect(isNoCredentialsError(new Error('Credential Manager error 28433'))).toBe(true);
  });

  it('detecta em objetos com code ou message', () => {
    expect(isNoCredentialsError({ code: '28433', message: 'No credentials available' })).toBe(true);
    expect(isNoCredentialsError({ code: 28433 })).toBe(true);
    expect(isNoCredentialsError({ errorMessage: 'no credentials available' })).toBe(true);
  });

  it('retorna false para outros erros e nulos', () => {
    expect(isNoCredentialsError(null)).toBe(false);
    expect(isNoCredentialsError(undefined)).toBe(false);
    expect(isNoCredentialsError(new Error('User canceled'))).toBe(false);
    expect(isNoCredentialsError(new Error('Network error'))).toBe(false);
    expect(isNoCredentialsError('Erro 403')).toBe(false);
  });
});

describe('isNativeSignInCanceled', () => {
  it('detecta cancelamento explícito pelo usuário', () => {
    expect(isNativeSignInCanceled('User canceled')).toBe(true);
    expect(isNativeSignInCanceled('user_cancelled')).toBe(true);
    expect(isNativeSignInCanceled(new Error('The user canceled the sign in request'))).toBe(true);
    expect(isNativeSignInCanceled({ code: 'auth/popup-closed-by-user' })).toBe(true);
    expect(isNativeSignInCanceled({ errorMessage: 'popup_closed' })).toBe(true);
  });

  it('não confunde erro de falta de credenciais (28433) com cancelamento', () => {
    expect(isNativeSignInCanceled('No credentials available')).toBe(false);
    expect(isNativeSignInCanceled(new Error('[28433] No credentials available'))).toBe(false);
    expect(isNativeSignInCanceled({ code: '28433', message: 'No credentials available' })).toBe(false);
  });

  it('retorna false para erros gerais ou valores nulos', () => {
    expect(isNativeSignInCanceled(null)).toBe(false);
    expect(isNativeSignInCanceled(undefined)).toBe(false);
    expect(isNativeSignInCanceled(new Error('Failed to fetch'))).toBe(false);
    expect(isNativeSignInCanceled({ code: 403 })).toBe(false);
  });
});

describe('classifyGoogleTasksError e formatGoogleTasksError', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retorna null para cancelamento silencioso', () => {
    const err = new Error('User canceled');
    expect(classifyGoogleTasksError(err)).toBe('canceled');
    expect(formatGoogleTasksError(err)).toBeNull();
  });

  it('retorna mensagem de aparelho sem conta Google', () => {
    const err = new Error('No credentials available (Credential Manager 28433)');
    expect(classifyGoogleTasksError(err)).toBe('no_credentials');
    expect(formatGoogleTasksError(err)).toBe(NO_GOOGLE_ACCOUNTS_MESSAGE);
  });

  it('retorna mensagem limpa para erro 403 / API desativada sem exibir JSON cru', () => {
    const rawErrorPayload = `Erro na API do Google Tasks (403): {
  "error": {
    "code": 403,
    "message": "Google Tasks API has not been used in project 423856759350 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/tasks.googleapis.com/overview?project=423856759350 then retry.",
    "status": "PERMISSION_DENIED",
    "details": [
      {
        "@type": "type.googleapis.com/google.rpc.ErrorInfo",
        "reason": "SERVICE_DISABLED",
        "domain": "googleapis.com"
      }
    ]
  }
}`;
    const err = new Error(rawErrorPayload);
    expect(classifyGoogleTasksError(err)).toBe('api_disabled');

    const formatted = formatGoogleTasksError(err);
    expect(formatted).toBe(GOOGLE_TASKS_API_DISABLED_MESSAGE);
    expect(formatted).not.toContain('{');
    expect(formatted).not.toContain('}');
    expect(formatted).not.toContain('423856759350');
  });

  it('retorna mensagem de permissão negada', () => {
    const err = new Error('OAuth error: access_denied - User refused permission');
    expect(classifyGoogleTasksError(err)).toBe('permission_denied');
    expect(formatGoogleTasksError(err)).toBe(GOOGLE_TASKS_PERMISSION_DENIED_MESSAGE);
  });

  it('retorna mensagem de falta de internet / rede', () => {
    const fetchErr = new TypeError('Failed to fetch');
    expect(classifyGoogleTasksError(fetchErr)).toBe('network');
    expect(formatGoogleTasksError(fetchErr)).toBe(GOOGLE_TASKS_NETWORK_ERROR_MESSAGE);

    const netErr = new Error('net::ERR_INTERNET_DISCONNECTED');
    expect(classifyGoogleTasksError(netErr)).toBe('network');
    expect(formatGoogleTasksError(netErr)).toBe(GOOGLE_TASKS_NETWORK_ERROR_MESSAGE);
  });

  it('retorna mensagem de sessão expirada para erro 401', () => {
    const err = new Error('Erro na API do Google Tasks (401): Sessão expirada.');
    expect(classifyGoogleTasksError(err)).toBe('session_expired');
    expect(formatGoogleTasksError(err)).toBe('Sessão do Google Tasks expirada. Reconecte sua conta.');
  });

  it('retorna mensagem genérica para erros inesperados sem vazar JSON cru', () => {
    const err = new Error('Erro na API do Google Tasks (500): {"internalError": true, "trace": "..."}');
    expect(classifyGoogleTasksError(err)).toBe('generic');

    const formatted = formatGoogleTasksError(err);
    expect(formatted).toBe(GOOGLE_TASKS_GENERIC_ERROR_MESSAGE);
    expect(formatted).not.toContain('{');
    expect(formatted).not.toContain('trace');
  });
});
