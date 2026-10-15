/**
 * Bloqueio do app por PIN (e biometria opcional). Tudo local, sem servidor.
 *
 * ATENÇÃO: é uma trava de INTERFACE. Os dados do app continuam em texto puro no
 * armazenamento do navegador (localStorage), sem criptografia: o bloqueio impede que outra
 * pessoa use o app aberto neste aparelho, não protege contra quem tem acesso ao navegador.
 */

export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 6;
/** PBKDF2: pelo menos 150 mil iterações (OWASP recomenda 600 mil para SHA-256; 210 mil mantém o desbloqueio ágil no celular) */
export const PBKDF2_ITERATIONS = 210_000;
export const SALT_BYTES = 16;
const HASH_BITS = 256;

/** Atraso máximo entre tentativas erradas: 5 minutos */
export const MAX_LOCKOUT_MS = 5 * 60 * 1000;

export type LockTimeout = 0 | 1 | 5 | 15; // minutos em segundo plano; 0 = imediato
export const LOCK_TIMEOUT_OPTIONS: LockTimeout[] = [0, 1, 5, 15];

export interface PinRecord {
  salt: string; // base64
  hash: string; // base64
  iterations: number;
  length: number; // dígitos do PIN (só para o desbloqueio automático; não revela o PIN)
}

export interface LockConfig {
  enabled: boolean;
  pin?: PinRecord;
  /** Identificador (base64url) da credencial WebAuthn da biometria; nunca a chave nem dados biométricos */
  biometricCredentialId?: string;
  timeoutMinutes: LockTimeout;
  /** Tentativas erradas seguidas e até quando o desbloqueio fica suspenso (persistidos) */
  failedAttempts: number;
  lockedUntil: number;
}

export const DEFAULT_LOCK_CONFIG: LockConfig = {
  enabled: false,
  timeoutMinutes: 1,
  failedAttempts: 0,
  lockedUntil: 0
};

// ---------- PIN ----------

export const isValidPin = (pin: unknown): pin is string =>
  typeof pin === 'string' && new RegExp(`^\\d{${PIN_MIN_LENGTH},${PIN_MAX_LENGTH}}$`).test(pin);

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_BYTES));
}

/** Deriva o hash do PIN com PBKDF2-SHA-256 (Web Crypto) */
export async function derivePinHash(pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    HASH_BITS
  );
  return new Uint8Array(bits);
}

/** Comparação em tempo constante (não sai no primeiro byte diferente) */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/** Cria o registro a guardar: sal aleatório + hash. O PIN em si nunca é guardado */
export async function createPinRecord(pin: string, iterations = PBKDF2_ITERATIONS): Promise<PinRecord> {
  if (!isValidPin(pin)) throw new Error('PIN inválido');
  const salt = generateSalt();
  const hash = await derivePinHash(pin, salt, iterations);
  return { salt: bytesToBase64(salt), hash: bytesToBase64(hash), iterations, length: pin.length };
}

export async function verifyPin(pin: string, record: PinRecord): Promise<boolean> {
  if (typeof pin !== 'string' || pin.length === 0) return false;
  try {
    const derived = await derivePinHash(pin, base64ToBytes(record.salt), record.iterations);
    return constantTimeEqual(derived, base64ToBytes(record.hash));
  } catch {
    return false;
  }
}

// ---------- Atraso exponencial entre tentativas erradas ----------

/** Atraso após N tentativas erradas seguidas: 1s, 2s, 4s, 8s... até 5 minutos */
export function lockoutDelayMs(failedAttempts: number): number {
  if (failedAttempts <= 0) return 0;
  return Math.min(MAX_LOCKOUT_MS, 1000 * 2 ** (failedAttempts - 1));
}

/** Registra uma tentativa errada e calcula até quando o desbloqueio fica suspenso */
export function registerFailure(config: LockConfig, now: number): LockConfig {
  const failedAttempts = config.failedAttempts + 1;
  return { ...config, failedAttempts, lockedUntil: now + lockoutDelayMs(failedAttempts) };
}

export const registerSuccess = (config: LockConfig): LockConfig => ({ ...config, failedAttempts: 0, lockedUntil: 0 });

/** Quanto falta (ms) para poder tentar de novo */
export const remainingLockMs = (config: LockConfig, now: number): number => Math.max(0, config.lockedUntil - now);

// ---------- Inatividade ----------

/**
 * O app deve bloquear ao voltar? `hiddenAt` é quando ele foi para segundo plano.
 * Com 0 ("imediato"), qualquer ida ao segundo plano bloqueia; senão, só depois de N minutos.
 */
export function isLockExpired(hiddenAt: number | null, now: number, timeoutMinutes: LockTimeout): boolean {
  if (hiddenAt === null) return false;
  return now - hiddenAt >= timeoutMinutes * 60_000;
}

// ---------- Armazenamento ----------

const asTimeout = (v: unknown): LockTimeout => (v === 0 || v === 5 || v === 15 ? v : 1);

/** Valida dados do localStorage. Um bloqueio "ativo" sem PIN válido é desativado (evita trancar o usuário) */
export function sanitizeLockConfig(raw: unknown): LockConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_LOCK_CONFIG };
  const p = raw as Record<string, unknown>;
  const pinRaw = p.pin as Record<string, unknown> | undefined;
  const pin: PinRecord | undefined =
    pinRaw &&
    typeof pinRaw.salt === 'string' &&
    typeof pinRaw.hash === 'string' &&
    typeof pinRaw.iterations === 'number' &&
    pinRaw.iterations >= 1 &&
    typeof pinRaw.length === 'number' &&
    pinRaw.length >= PIN_MIN_LENGTH &&
    pinRaw.length <= PIN_MAX_LENGTH
      ? { salt: pinRaw.salt, hash: pinRaw.hash, iterations: pinRaw.iterations, length: pinRaw.length }
      : undefined;

  const failed = typeof p.failedAttempts === 'number' && p.failedAttempts > 0 ? Math.floor(p.failedAttempts) : 0;
  return {
    enabled: p.enabled === true && Boolean(pin),
    ...(pin ? { pin } : {}),
    ...(typeof p.biometricCredentialId === 'string' && p.biometricCredentialId
      ? { biometricCredentialId: p.biometricCredentialId }
      : {}),
    timeoutMinutes: asTimeout(p.timeoutMinutes),
    failedAttempts: failed,
    lockedUntil: typeof p.lockedUntil === 'number' && p.lockedUntil > 0 ? p.lockedUntil : 0
  };
}
