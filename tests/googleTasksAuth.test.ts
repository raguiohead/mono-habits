import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuthorize = vi.fn();

vi.mock('@capacitor/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@capacitor/core')>();
  return {
    ...actual,
    registerPlugin: (name: string, opts?: any) => {
      if (name === 'GoogleTasksAuth') {
        return {
          authorize: (...args: any[]) => mockAuthorize(...args)
        };
      }
      return actual.registerPlugin(name, opts);
    }
  };
});

import { Capacitor } from '@capacitor/core';
import {
  getTasksToken,
  hasValidTasksToken,
  clearTasksToken,
  classifyGoogleTasksError,
  canSyncInBackground
} from '@/lib/googleTasksAuth';

describe('googleTasksAuth token flow', () => {
  beforeEach(() => {
    clearTasksToken();
    vi.restoreAllMocks();
    mockAuthorize.mockReset();
    (globalThis as any).window = globalThis;
  });

  describe('no ambiente nativo (Android)', () => {
    beforeEach(() => {
      vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    });

    it('getTasksToken({ interactive: false }) solicita token silenciosamente ao plugin', async () => {
      mockAuthorize.mockResolvedValue({
        accessToken: 'silent-native-token-123'
      });

      const token = await getTasksToken({ interactive: false });

      expect(mockAuthorize).toHaveBeenCalledWith({ interactive: false });
      expect(token).toBe('silent-native-token-123');
      expect(hasValidTasksToken()).toBe(true);

      // Segunda chamada reutiliza cache em memória sem invocar o plugin novamente
      const cached = await getTasksToken({ interactive: false });
      expect(cached).toBe('silent-native-token-123');
      expect(mockAuthorize).toHaveBeenCalledTimes(1);
    });

    it('getTasksToken({ interactive: true }) passa interactive: true ao plugin nativo', async () => {
      mockAuthorize.mockResolvedValue({
        accessToken: 'interactive-native-token-456'
      });

      const token = await getTasksToken({ interactive: true });

      expect(mockAuthorize).toHaveBeenCalledWith({ interactive: true });
      expect(token).toBe('interactive-native-token-456');
    });

    it('quando o plugin nativo rejeita com consent_required, lança erro classificado', async () => {
      const pluginError: any = new Error('Consent required');
      pluginError.code = 'consent_required';

      mockAuthorize.mockRejectedValue(pluginError);

      await expect(getTasksToken({ interactive: false })).rejects.toThrow('Consent required');

      try {
        await getTasksToken({ interactive: false });
      } catch (err) {
        expect(classifyGoogleTasksError(err)).toBe('consent_required');
      }
    });

    it('quando o plugin nativo retorna accessToken vazio, lança erro', async () => {
      mockAuthorize.mockResolvedValue({
        accessToken: ''
      });

      await expect(getTasksToken({ interactive: false })).rejects.toThrow(
        /não retornou o accessToken/i
      );
    });

    it('clearTasksToken limpa o token em memória', async () => {
      mockAuthorize.mockResolvedValue({
        accessToken: 'temp-token'
      });

      await getTasksToken({ interactive: false });
      expect(hasValidTasksToken()).toBe(true);

      clearTasksToken();
      expect(hasValidTasksToken()).toBe(false);
    });
  });

  describe('no ambiente Web', () => {
    beforeEach(() => {
      vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
    });

    it('utiliza Google Identity Services com prompt "none" no modo silencioso', async () => {
      let requestedPrompt = '';
      const mockInitTokenClient = vi.fn().mockImplementation((config) => {
        return {
          requestAccessToken: ({ prompt }: { prompt: string }) => {
            requestedPrompt = prompt;
            config.callback({ access_token: 'web-silent-token-789', expires_in: 3600 });
          }
        };
      });

      (globalThis as any).google = {
        accounts: {
          oauth2: {
            initTokenClient: mockInitTokenClient
          }
        }
      };

      const token = await getTasksToken({ interactive: false });
      expect(token).toBe('web-silent-token-789');
      expect(requestedPrompt).toBe('none');
    });

    it('utiliza Google Identity Services com prompt vazio "" no modo interativo', async () => {
      let requestedPrompt = 'unset';
      const mockInitTokenClient = vi.fn().mockImplementation((config) => {
        return {
          requestAccessToken: ({ prompt }: { prompt: string }) => {
            requestedPrompt = prompt;
            config.callback({ access_token: 'web-interactive-token-321', expires_in: 3600 });
          }
        };
      });

      (globalThis as any).google = {
        accounts: {
          oauth2: {
            initTokenClient: mockInitTokenClient
          }
        }
      };

      const token = await getTasksToken({ interactive: true });
      expect(token).toBe('web-interactive-token-321');
      expect(requestedPrompt).toBe('');
    });
  });
});

describe('canSyncInBackground', () => {
  beforeEach(() => {
    clearTasksToken();
    vi.restoreAllMocks();
  });

  it('permite sync em background no Android mesmo sem token em memória (token silencioso)', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    expect(canSyncInBackground()).toBe(true);
  });

  it('na web sem token válido não tenta (o GIS abriria popup sem gesto do usuário)', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
    expect(hasValidTasksToken()).toBe(false);
    expect(canSyncInBackground()).toBe(false);
  });
});
