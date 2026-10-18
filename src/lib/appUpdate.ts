export interface ReleaseInfo {
  version: string;
  apkUrl: string;
  htmlUrl: string;
}

const GITHUB_LATEST_RELEASE_URL = 'https://api.github.com/repos/raguiohead/mono-habits/releases/latest';
const APK_ASSET_NAME = 'mono-habits.apk';

const LAST_CHECK_KEY = 'mono-habits:update-last-check';
const DISMISSED_VERSION_KEY = 'mono-habits:update-dismissed-version';

/** Intervalo mínimo entre checagens automáticas (6 horas) */
export const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Extrai [major, minor, patch] de uma string semver (aceita prefixo 'v'/'V' e ignora sufixos como -beta.1+build).
 * Retorna null se não for uma versão válida.
 */
export function parseSemver(raw: unknown): [number, number, number] | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().replace(/^[vV]/, '');
  const match = cleaned.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) return null;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (!Number.isSafeInteger(major) || !Number.isSafeInteger(minor) || !Number.isSafeInteger(patch)) {
    return null;
  }
  return [major, minor, patch];
}

/** Remove o 'v' inicial e sufixos apenas para exibição padronizada, ou retorna a string limpa */
export function normalizeVersion(raw: string): string {
  const parsed = parseSemver(raw);
  return parsed ? `${parsed[0]}.${parsed[1]}.${parsed[2]}` : raw.trim().replace(/^[vV]/, '');
}

/**
 * Compara duas versões semver: retorna 1 se a > b, -1 se a < b, 0 se iguais ou se alguma for inválida.
 */
export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

/** Retorna true se `candidate` for estritamente maior que `current` */
export function isNewerVersion(current: string, candidate: string): boolean {
  return compareSemver(candidate, current) === 1;
}

/**
 * Extrai ReleaseInfo do payload JSON da GitHub Releases API.
 * Exige tag_name semver válida e html_url; para apkUrl usa o browser_download_url do asset
 * `mono-habits.apk` (ou cai para html_url se o asset ainda não estiver anexado).
 */
export function parseReleasePayload(data: unknown): ReleaseInfo | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  if (obj.draft === true || obj.prerelease === true) return null;
  const tagName = typeof obj.tag_name === 'string' ? obj.tag_name : '';
  const htmlUrl = typeof obj.html_url === 'string' ? obj.html_url : '';
  if (!parseSemver(tagName) || !htmlUrl.startsWith('https://')) return null;

  let apkUrl = htmlUrl;
  if (Array.isArray(obj.assets)) {
    const apkAsset = obj.assets.find((a) => {
      if (!a || typeof a !== 'object') return false;
      const rec = a as Record<string, unknown>;
      return (
        rec.name === APK_ASSET_NAME &&
        typeof rec.browser_download_url === 'string' &&
        rec.browser_download_url.startsWith('https://')
      );
    }) as Record<string, unknown> | undefined;
    if (apkAsset && typeof apkAsset.browser_download_url === 'string') {
      apkUrl = apkAsset.browser_download_url;
    }
  }

  return {
    version: normalizeVersion(tagName),
    apkUrl,
    htmlUrl
  };
}

/**
 * Consulta a última release pública no GitHub.
 * Falhas de rede, 404, rate limit ou JSON inválido retornam null silenciosamente.
 */
export async function fetchLatestRelease(fetchImpl: typeof fetch = fetch): Promise<ReleaseInfo | null> {
  try {
    const res = await fetchImpl(GITHUB_LATEST_RELEASE_URL, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json'
      }
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return parseReleasePayload(data);
  } catch {
    return null;
  }
}

export function getLastUpdateCheckAt(): number {
  try {
    const raw = localStorage.getItem(LAST_CHECK_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function setLastUpdateCheckAt(ts: number): void {
  try {
    localStorage.setItem(LAST_CHECK_KEY, String(ts));
  } catch {
    /* localStorage indisponível */
  }
}

export function shouldThrottleUpdateCheck(now: number = Date.now()): boolean {
  const last = getLastUpdateCheckAt();
  return last > 0 && now - last < UPDATE_CHECK_INTERVAL_MS;
}

export function getDismissedUpdateVersion(): string | null {
  try {
    return localStorage.getItem(DISMISSED_VERSION_KEY);
  } catch {
    return null;
  }
}

export function setDismissedUpdateVersion(version: string): void {
  try {
    localStorage.setItem(DISMISSED_VERSION_KEY, normalizeVersion(version));
  } catch {
    /* localStorage indisponível */
  }
}

/**
 * Abre uma URL externa no navegador do sistema Android.
 * Na WebView do Capacitor (`Bridge.launchIntent`), qualquer navegação ou clique em `<a target="_blank">`
 * para fora de `https://localhost` é interceptada em `BridgeWebViewClient.shouldOverrideUrlLoading`
 * e aberta no navegador externo via `Intent(Intent.ACTION_VIEW, url)` sem navegar a WebView.
 */
export function openExternalUrl(url: string): void {
  try {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch {
    window.location.assign(url);
  }
}
