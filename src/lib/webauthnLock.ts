/**
 * Biometria do aparelho via WebAuthn (autenticador de plataforma, verificação do usuário obrigatória).
 * Guardamos só o identificador da credencial (credentialId). Não há servidor: o navegador exige a
 * biometria/PIN do aparelho antes de devolver a asserção, e isso libera a interface. Como o PIN,
 * é uma trava de interface, não criptografia dos dados.
 */

const RP_NAME = 'MONO // HABITS';
const TIMEOUT_MS = 60_000;

function toBase64Url(buffer: ArrayBuffer): string {
  let binary = '';
  new Uint8Array(buffer).forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const randomBytes = (n: number): Uint8Array => crypto.getRandomValues(new Uint8Array(n));

/** O aparelho tem biometria/tela de bloqueio utilizável pelo WebAuthn? */
export async function isBiometricSupported(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !window.isSecureContext) return false;
    if (typeof PublicKeyCredential === 'undefined' || !navigator.credentials) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/** Cria a credencial local e devolve o credentialId (base64url); null se cancelada ou indisponível */
export async function registerBiometric(): Promise<string | null> {
  try {
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: randomBytes(32) as BufferSource,
        rp: { name: RP_NAME },
        user: { id: randomBytes(16) as BufferSource, name: 'mono-habits-local', displayName: RP_NAME },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 } // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'discouraged'
        },
        attestation: 'none',
        timeout: TIMEOUT_MS
      }
    })) as PublicKeyCredential | null;
    return credential ? toBase64Url(credential.rawId) : null;
  } catch {
    return null; // cancelado, sem biometria cadastrada ou não permitido
  }
}

/** Pede a biometria do aparelho; true só se o usuário foi verificado */
export async function verifyBiometric(credentialId: string): Promise<boolean> {
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32) as BufferSource,
        allowCredentials: [{ type: 'public-key', id: fromBase64Url(credentialId) as BufferSource, transports: ['internal'] }],
        userVerification: 'required',
        timeout: TIMEOUT_MS
      }
    });
    return assertion !== null;
  } catch {
    return false;
  }
}
