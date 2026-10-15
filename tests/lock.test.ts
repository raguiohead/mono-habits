import { describe, it, expect } from 'vitest';
import { pbkdf2Sync } from 'node:crypto';
import {
  DEFAULT_LOCK_CONFIG,
  MAX_LOCKOUT_MS,
  PBKDF2_ITERATIONS,
  base64ToBytes,
  bytesToBase64,
  constantTimeEqual,
  createPinRecord,
  derivePinHash,
  isLockExpired,
  isValidPin,
  lockoutDelayMs,
  registerFailure,
  registerSuccess,
  remainingLockMs,
  sanitizeLockConfig,
  verifyPin
} from '@/lib/lock';

describe('PIN', () => {
  it('aceita só 4 a 6 dígitos', () => {
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('123456')).toBe(true);
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('1234567')).toBe(false);
    expect(isValidPin('12a4')).toBe(false);
    expect(isValidPin(1234)).toBe(false);
    expect(isValidPin('')).toBe(false);
  });

  it('o hash bate com o PBKDF2-SHA-256 do Node (independente da Web Crypto)', async () => {
    const salt = new Uint8Array(16).map((_, i) => i + 1);
    const ours = await derivePinHash('4821', salt, 150_000);
    const reference = pbkdf2Sync('4821', Buffer.from(salt), 150_000, 32, 'sha256');
    expect(Buffer.from(ours).equals(reference)).toBe(true);
  });

  it('usa pelo menos 150 mil iterações e sal aleatório', async () => {
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(150_000);
    const a = await createPinRecord('1234');
    const b = await createPinRecord('1234');
    expect(a.iterations).toBeGreaterThanOrEqual(150_000);
    expect(base64ToBytes(a.salt)).toHaveLength(16);
    expect(a.salt).not.toBe(b.salt); // sal diferente a cada registro
    expect(a.hash).not.toBe(b.hash); // mesmo PIN, hashes diferentes
  });

  it('nunca guarda o PIN no registro', async () => {
    const record = await createPinRecord('735192');
    const serialized = JSON.stringify(record);
    expect(serialized).not.toContain('735192');
    expect(record.length).toBe(6);
    expect(Object.keys(record).sort()).toEqual(['hash', 'iterations', 'length', 'salt']);
  });

  it('verifica o PIN correto e rejeita o errado', async () => {
    const record = await createPinRecord('2468');
    expect(await verifyPin('2468', record)).toBe(true);
    expect(await verifyPin('2469', record)).toBe(false);
    expect(await verifyPin('246', record)).toBe(false);
    expect(await verifyPin('', record)).toBe(false);
  });

  it('um registro adulterado não verifica nem lança erro', async () => {
    const record = await createPinRecord('2468');
    expect(await verifyPin('2468', { ...record, hash: bytesToBase64(new Uint8Array(32)) })).toBe(false);
    expect(await verifyPin('2468', { ...record, salt: '%%%' })).toBe(false);
  });

  it('createPinRecord rejeita PIN inválido', async () => {
    await expect(createPinRecord('12')).rejects.toThrow();
  });

  it('comparação em tempo constante', () => {
    expect(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
    expect(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
    expect(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2]))).toBe(false); // tamanhos diferentes
    expect(constantTimeEqual(new Uint8Array([]), new Uint8Array([]))).toBe(true);
  });

  it('base64 faz o caminho de ida e volta', () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255]);
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes));
  });
});

describe('atraso exponencial', () => {
  it('1s, 2s, 4s, 8s... com teto de 5 minutos', () => {
    expect([1, 2, 3, 4, 5].map(lockoutDelayMs)).toEqual([1000, 2000, 4000, 8000, 16000]);
    expect(lockoutDelayMs(9)).toBe(256_000);
    expect(lockoutDelayMs(10)).toBe(MAX_LOCKOUT_MS); // 512s -> limitado a 300s
    expect(lockoutDelayMs(40)).toBe(MAX_LOCKOUT_MS);
    expect(MAX_LOCKOUT_MS).toBe(300_000);
  });

  it('sem erros não há atraso', () => {
    expect(lockoutDelayMs(0)).toBe(0);
    expect(lockoutDelayMs(-3)).toBe(0);
  });

  it('registra falhas em sequência e persiste até quando fica suspenso', () => {
    const NOW = 1_800_000_000_000;
    let c = { ...DEFAULT_LOCK_CONFIG };
    c = registerFailure(c, NOW);
    expect(c).toMatchObject({ failedAttempts: 1, lockedUntil: NOW + 1000 });
    c = registerFailure(c, NOW + 5000);
    expect(c).toMatchObject({ failedAttempts: 2, lockedUntil: NOW + 5000 + 2000 });
    c = registerFailure(c, NOW + 20_000);
    expect(c.lockedUntil).toBe(NOW + 20_000 + 4000);
  });

  it('calcula o tempo restante e zera com o acerto', () => {
    const NOW = 1_800_000_000_000;
    const failed = registerFailure({ ...DEFAULT_LOCK_CONFIG }, NOW);
    expect(remainingLockMs(failed, NOW)).toBe(1000);
    expect(remainingLockMs(failed, NOW + 400)).toBe(600);
    expect(remainingLockMs(failed, NOW + 1000)).toBe(0);
    expect(remainingLockMs(failed, NOW + 99_999)).toBe(0);
    expect(registerSuccess(failed)).toMatchObject({ failedAttempts: 0, lockedUntil: 0 });
  });

  it('o atraso sobrevive à recarga (sanitize preserva as tentativas)', () => {
    const persisted = JSON.parse(JSON.stringify(registerFailure(registerFailure({ ...DEFAULT_LOCK_CONFIG }, 1000), 3000)));
    const loaded = sanitizeLockConfig(persisted);
    expect(loaded.failedAttempts).toBe(2);
    expect(loaded.lockedUntil).toBe(3000 + 2000);
  });
});

describe('expiração por inatividade', () => {
  const NOW = 1_800_000_000_000;
  const MIN = 60_000;

  it('imediato (0): qualquer ida ao segundo plano bloqueia ao voltar', () => {
    expect(isLockExpired(NOW, NOW, 0)).toBe(true);
    expect(isLockExpired(NOW - 50, NOW, 0)).toBe(true);
  });

  it('1, 5 e 15 minutos: só bloqueia depois do tempo configurado', () => {
    expect(isLockExpired(NOW - 59_999, NOW, 1)).toBe(false);
    expect(isLockExpired(NOW - MIN, NOW, 1)).toBe(true);
    expect(isLockExpired(NOW - 4 * MIN, NOW, 5)).toBe(false);
    expect(isLockExpired(NOW - 5 * MIN, NOW, 5)).toBe(true);
    expect(isLockExpired(NOW - 14 * MIN, NOW, 15)).toBe(false);
    expect(isLockExpired(NOW - 15 * MIN, NOW, 15)).toBe(true);
  });

  it('sem ida ao segundo plano não há o que expirar', () => {
    expect(isLockExpired(null, NOW, 0)).toBe(false);
    expect(isLockExpired(null, NOW, 15)).toBe(false);
  });
});

describe('armazenamento', () => {
  const pin = { salt: 'AAAA', hash: 'BBBB', iterations: 210000, length: 4 };

  it('dados ausentes ou inválidos viram o padrão (bloqueio desligado)', () => {
    expect(sanitizeLockConfig(null)).toEqual(DEFAULT_LOCK_CONFIG);
    expect(sanitizeLockConfig('lixo')).toEqual(DEFAULT_LOCK_CONFIG);
  });

  it('"ativo" sem PIN válido é desativado, para não trancar o usuário', () => {
    expect(sanitizeLockConfig({ enabled: true }).enabled).toBe(false);
    expect(sanitizeLockConfig({ enabled: true, pin: { salt: 1 } }).enabled).toBe(false);
    expect(sanitizeLockConfig({ enabled: true, pin: { ...pin, length: 9 } }).enabled).toBe(false);
    expect(sanitizeLockConfig({ enabled: true, pin }).enabled).toBe(true);
  });

  it('preserva campos válidos e corrige os inválidos', () => {
    const c = sanitizeLockConfig({
      enabled: true,
      pin,
      biometricCredentialId: 'abc',
      timeoutMinutes: 15,
      failedAttempts: 3.9,
      lockedUntil: 12345
    });
    expect(c).toMatchObject({ timeoutMinutes: 15, biometricCredentialId: 'abc', failedAttempts: 3, lockedUntil: 12345 });
    expect(sanitizeLockConfig({ timeoutMinutes: 7 }).timeoutMinutes).toBe(1);
    expect(sanitizeLockConfig({ failedAttempts: -2, lockedUntil: -1 })).toMatchObject({ failedAttempts: 0, lockedUntil: 0 });
  });
});
