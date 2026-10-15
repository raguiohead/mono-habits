import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { loadLockConfig, saveLockConfig, clearLocalUserData } from '@/lib/storage';
import {
  createPinRecord,
  isLockExpired,
  registerFailure,
  registerSuccess,
  remainingLockMs,
  verifyPin,
  type LockConfig,
  type LockTimeout
} from '@/lib/lock';
import { isBiometricSupported, registerBiometric, verifyBiometric } from '@/lib/webauthnLock';
import { LockScreen } from '@/components/LockScreen';

/** Resultado de conferir o PIN (desbloquear, trocar ou desativar) */
export type PinCheck =
  | { ok: true }
  | { ok: false; reason: 'wrong' | 'locked' | 'invalid'; remainingMs: number };

interface LockContextType {
  enabled: boolean;
  timeoutMinutes: LockTimeout;
  biometricEnabled: boolean;
  /** null enquanto a detecção não terminou */
  biometricSupported: boolean | null;
  /** Define o PIN e liga o bloqueio (não bloqueia a sessão atual) */
  setupPin: (pin: string) => Promise<boolean>;
  changePin: (current: string, next: string) => Promise<PinCheck>;
  /** Desliga o bloqueio, apagando o PIN e a biometria, depois de conferir o PIN */
  disableLock: (pin: string) => Promise<PinCheck>;
  setTimeoutMinutes: (minutes: LockTimeout) => void;
  enableBiometric: () => Promise<boolean>;
  disableBiometric: () => void;
  lockNow: () => void;
}

const LockContext = createContext<LockContextType | undefined>(undefined);

/**
 * Bloqueio do app. Fica ACIMA dos provedores de dados: enquanto bloqueado, a árvore sensível
 * (hábitos, registros, notas, Firestore) nem é montada, então nada do conteúdo existe no DOM.
 * É uma trava de interface: os dados no localStorage não são criptografados.
 */
export const LockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<LockConfig>(() => loadLockConfig());
  const configRef = useRef(config);
  configRef.current = config;

  // Ao abrir o app, ele começa bloqueado se o bloqueio estiver ativo
  const [locked, setLocked] = useState<boolean>(() => loadLockConfig().enabled);
  const [biometricSupported, setBiometricSupported] = useState<boolean | null>(null);

  const persist = useCallback((next: LockConfig) => {
    configRef.current = next;
    setConfig(next);
    saveLockConfig(next);
  }, []);

  useEffect(() => {
    let alive = true;
    void isBiometricSupported().then((ok) => alive && setBiometricSupported(ok));
    return () => {
      alive = false;
    };
  }, []);

  // Ao voltar do segundo plano, bloqueia se passou o tempo configurado (0 = imediato)
  useEffect(() => {
    if (!config.enabled) return;
    let hiddenAt: number | null = null;
    const onChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
      } else if (isLockExpired(hiddenAt, Date.now(), configRef.current.timeoutMinutes)) {
        setLocked(true);
        hiddenAt = null;
      } else {
        hiddenAt = null;
      }
    };
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, [config.enabled]);

  /** Confere o PIN respeitando (e persistindo) o atraso entre tentativas erradas */
  const checkPin = useCallback(
    async (pin: string): Promise<PinCheck> => {
      const current = configRef.current;
      if (!current.pin) return { ok: false, reason: 'invalid', remainingMs: 0 };
      const wait = remainingLockMs(current, Date.now());
      if (wait > 0) return { ok: false, reason: 'locked', remainingMs: wait };
      if (await verifyPin(pin, current.pin)) {
        persist(registerSuccess(configRef.current));
        return { ok: true };
      }
      const next = registerFailure(configRef.current, Date.now());
      persist(next);
      return { ok: false, reason: 'wrong', remainingMs: remainingLockMs(next, Date.now()) };
    },
    [persist]
  );

  const unlockWithPin = useCallback(
    async (pin: string): Promise<PinCheck> => {
      const result = await checkPin(pin);
      if (result.ok) setLocked(false);
      return result;
    },
    [checkPin]
  );

  const unlockWithBiometric = useCallback(async (): Promise<boolean> => {
    const id = configRef.current.biometricCredentialId;
    if (!id) return false;
    const ok = await verifyBiometric(id);
    if (ok) {
      persist(registerSuccess(configRef.current));
      setLocked(false);
    }
    return ok;
  }, [persist]);

  /** "Esqueci o PIN": apaga os dados deste dispositivo (inclui o bloqueio) e recarrega */
  const eraseDeviceData = useCallback(() => {
    clearLocalUserData();
    window.location.reload();
  }, []);

  const setupPin = useCallback(
    async (pin: string): Promise<boolean> => {
      try {
        const record = await createPinRecord(pin);
        persist({ ...configRef.current, enabled: true, pin: record, failedAttempts: 0, lockedUntil: 0 });
        return true;
      } catch {
        return false;
      }
    },
    [persist]
  );

  const changePin = useCallback(
    async (current: string, next: string): Promise<PinCheck> => {
      const result = await checkPin(current);
      if (!result.ok) return result;
      try {
        const record = await createPinRecord(next);
        persist({ ...configRef.current, pin: record });
        return { ok: true };
      } catch {
        return { ok: false, reason: 'invalid', remainingMs: 0 };
      }
    },
    [checkPin, persist]
  );

  const disableLock = useCallback(
    async (pin: string): Promise<PinCheck> => {
      const result = await checkPin(pin);
      if (!result.ok) return result;
      const { pin: _pin, biometricCredentialId: _bio, ...rest } = configRef.current;
      void _pin;
      void _bio;
      persist({ ...rest, enabled: false, failedAttempts: 0, lockedUntil: 0 });
      return { ok: true };
    },
    [checkPin, persist]
  );

  const setTimeoutMinutes = useCallback(
    (minutes: LockTimeout) => persist({ ...configRef.current, timeoutMinutes: minutes }),
    [persist]
  );

  const enableBiometric = useCallback(async (): Promise<boolean> => {
    const id = await registerBiometric();
    if (!id) return false;
    persist({ ...configRef.current, biometricCredentialId: id });
    return true;
  }, [persist]);

  const disableBiometric = useCallback(() => {
    const { biometricCredentialId: _bio, ...rest } = configRef.current;
    void _bio;
    persist(rest);
  }, [persist]);

  const lockNow = useCallback(() => {
    if (configRef.current.enabled) setLocked(true);
  }, []);

  if (config.enabled && locked && config.pin) {
    return (
      <LockScreen
        pinLength={config.pin.length}
        biometricEnabled={Boolean(config.biometricCredentialId)}
        onSubmitPin={unlockWithPin}
        onBiometric={unlockWithBiometric}
        onErase={eraseDeviceData}
        initialRemainingMs={remainingLockMs(config, Date.now())}
      />
    );
  }

  return (
    <LockContext.Provider
      value={{
        enabled: config.enabled,
        timeoutMinutes: config.timeoutMinutes,
        biometricEnabled: Boolean(config.biometricCredentialId),
        biometricSupported,
        setupPin,
        changePin,
        disableLock,
        setTimeoutMinutes,
        enableBiometric,
        disableBiometric,
        lockNow
      }}
    >
      {children}
    </LockContext.Provider>
  );
};

export const useAppLock = (): LockContextType => {
  const context = useContext(LockContext);
  if (!context) {
    throw new Error('useAppLock deve ser utilizado dentro de um LockProvider');
  }
  return context;
};
