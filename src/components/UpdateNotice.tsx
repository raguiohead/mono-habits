import React, { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  fetchLatestRelease,
  getDismissedUpdateVersion,
  isNewerVersion,
  openExternalUrl,
  setDismissedUpdateVersion,
  setLastUpdateCheckAt,
  shouldThrottleUpdateCheck,
  type ReleaseInfo
} from '@/lib/appUpdate';
import { ModalShell } from './ModalShell';

/** Evento customizado disparado pelas Configurações quando o usuário clica em "Verificar atualizações" */
export const SHOW_UPDATE_NOTICE_EVENT = 'mono-habits:show-update-notice';

export function dispatchShowUpdateNotice(release: ReleaseInfo): void {
  window.dispatchEvent(new CustomEvent<ReleaseInfo>(SHOW_UPDATE_NOTICE_EVENT, { detail: release }));
}

/**
 * Aviso discreto de nova versão (exclusivo do app nativo Android).
 * Checa ao abrir e ao voltar ao primeiro plano (visibilitychange), no máximo 1x a cada 6h.
 * Também escuta o evento manual disparado pelo botão "Verificar atualizações" nas Configurações.
 */
export const UpdateNotice: React.FC = () => {
  const [release, setRelease] = useState<ReleaseInfo | null>(null);

  const checkAuto = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    const now = Date.now();
    if (shouldThrottleUpdateCheck(now)) return;
    setLastUpdateCheckAt(now);

    const latest = await fetchLatestRelease();
    if (!latest) return;
    if (!isNewerVersion(__APP_VERSION__, latest.version)) return;

    const dismissed = getDismissedUpdateVersion();
    if (dismissed && !isNewerVersion(dismissed, latest.version)) return;

    setRelease(latest);
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    void checkAuto();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void checkAuto();
      }
    };
    const onManualShow = (e: Event) => {
      const custom = e as CustomEvent<ReleaseInfo>;
      if (custom.detail) setRelease(custom.detail);
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener(SHOW_UPDATE_NOTICE_EVENT, onManualShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener(SHOW_UPDATE_NOTICE_EVENT, onManualShow);
    };
  }, [checkAuto]);

  if (!Capacitor.isNativePlatform() || !release) return null;

  const handleLater = () => {
    setDismissedUpdateVersion(release.version);
    setRelease(null);
  };

  const handleDownload = () => {
    openExternalUrl(release.apkUrl);
    setRelease(null);
  };

  return (
    <ModalShell labelledBy="update-notice-title" onClose={handleLater} widthClass="sm:max-w-sm">
      <div className="space-y-4">
        <div className="space-y-1">
          <h3 id="update-notice-title" className="text-sm font-semibold tracking-tight">
            Nova versão {release.version} disponível
          </h3>
          <p className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
            Instalada: {__APP_VERSION__}
          </p>
        </div>

        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
          O download do APK será aberto no navegador do sistema. Após concluir, abra o arquivo baixado e toque em{' '}
          <strong className="text-zinc-950 dark:text-zinc-50">Instalar</strong>. Seus hábitos e dados permanecem salvos.
        </p>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={handleLater}
            className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Depois
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium bg-zinc-950 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
          >
            Baixar
          </button>
        </div>
      </div>
    </ModalShell>
  );
};
