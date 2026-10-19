import { describe, it, expect, vi } from 'vitest';
import {
  compareSemver,
  fetchLatestRelease,
  isNewerVersion,
  normalizeVersion,
  parseReleasePayload,
  parseSemver
} from '@/lib/appUpdate';

describe('parseSemver & compareSemver', () => {
  it('aceita prefixo v/V e ignora sufixos de pré-release ou build', () => {
    expect(parseSemver('1.1.0')).toEqual([1, 1, 0]);
    expect(parseSemver('v1.2.3')).toEqual([1, 2, 3]);
    expect(parseSemver('V2.0.10-beta.1+sha.123')).toEqual([2, 0, 10]);
    expect(normalizeVersion('v1.4.0-rc1')).toBe('1.4.0');
  });

  it('rejeita entradas inválidas com segurança', () => {
    expect(parseSemver('')).toBeNull();
    expect(parseSemver('1.2')).toBeNull();
    expect(parseSemver('abc')).toBeNull();
    expect(parseSemver(null)).toBeNull();
    expect(compareSemver('1.0.0', 'invalida')).toBe(0);
  });

  it('compara major, minor e patch corretamente', () => {
    expect(compareSemver('v1.1.0', '1.0.9')).toBe(1);
    expect(compareSemver('1.1.0', 'v1.1.0')).toBe(0);
    expect(compareSemver('1.1.0', '1.2.0')).toBe(-1);
    expect(isNewerVersion('1.1.0', 'v1.1.1')).toBe(true);
    expect(isNewerVersion('1.1.0', 'v1.1.0')).toBe(false);
    expect(isNewerVersion('1.2.0', 'v1.1.9')).toBe(false);
  });
});

describe('parseReleasePayload & fetchLatestRelease', () => {
  const sampleRelease = {
    tag_name: 'v1.2.0',
    html_url: 'https://github.com/raguiohead/mono-habits/releases/tag/v1.2.0',
    draft: false,
    prerelease: false,
    assets: [
      {
        name: 'checksums.txt',
        browser_download_url: 'https://github.com/raguiohead/mono-habits/releases/download/v1.2.0/checksums.txt'
      },
      {
        name: 'mono-habits.apk',
        browser_download_url: 'https://github.com/raguiohead/mono-habits/releases/download/v1.2.0/mono-habits.apk'
      }
    ]
  };

  it('extrai versão, apkUrl de mono-habits.apk e htmlUrl', () => {
    expect(parseReleasePayload(sampleRelease)).toEqual({
      version: '1.2.0',
      apkUrl: 'https://github.com/raguiohead/mono-habits/releases/download/v1.2.0/mono-habits.apk',
      htmlUrl: 'https://github.com/raguiohead/mono-habits/releases/tag/v1.2.0'
    });
  });

  it('cai para html_url quando o asset mono-habits.apk não está presente, e ignora drafts/prereleases', () => {
    expect(
      parseReleasePayload({
        tag_name: 'v1.3.0',
        html_url: 'https://github.com/raguiohead/mono-habits/releases/tag/v1.3.0',
        assets: []
      })
    ).toEqual({
      version: '1.3.0',
      apkUrl: 'https://github.com/raguiohead/mono-habits/releases/tag/v1.3.0',
      htmlUrl: 'https://github.com/raguiohead/mono-habits/releases/tag/v1.3.0'
    });
    expect(parseReleasePayload({ ...sampleRelease, draft: true })).toBeNull();
    expect(parseReleasePayload({ ...sampleRelease, prerelease: true })).toBeNull();
    expect(parseReleasePayload({ tag_name: 'invalida', html_url: 'https://github.com/x' })).toBeNull();
  });

  it('fetchLatestRelease retorna ReleaseInfo em 200 e null silencioso em erro/404/rate-limit', async () => {
    const okFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => sampleRelease
    });
    const res = await fetchLatestRelease(okFetch as unknown as typeof fetch);
    expect(res?.version).toBe('1.2.0');
    expect(okFetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/raguiohead/mono-habits/releases/latest',
      expect.objectContaining({
        headers: { Accept: 'application/vnd.github+json' }
      })
    );

    const notFoundFetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    expect(await fetchLatestRelease(notFoundFetch as unknown as typeof fetch)).toBeNull();

    const failFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    expect(await fetchLatestRelease(failFetch as unknown as typeof fetch)).toBeNull();
  });
});
