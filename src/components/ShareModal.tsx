import React, { useEffect, useRef, useState } from 'react';
import { Download, Share2, X } from 'lucide-react';
import { ModalShell } from './ModalShell';
import { useHabits } from '@/context/HabitsContext';
import { canvasToPngBlob, renderShareCard, shareOrDownload } from '@/lib/shareCanvas';
import { CARD_H, CARD_W, type ShareCardSpec } from '@/lib/shareImage';

export interface ShareCardOption {
  label: string;
  /** Recebe o total de hábitos só quando o usuário escolher incluí-lo */
  build: (habitCount: number | undefined) => ShareCardSpec;
  filename: string;
}

interface ShareModalProps {
  title: string;
  options: ShareCardOption[];
  habitCount: number;
  onClose: () => void;
}

/** Preview do cartão em PNG (monocromático, sem títulos de hábitos) e botões de compartilhar/baixar */
export const ShareModal: React.FC<ShareModalProps> = ({ title, options, habitCount, onClose }) => {
  const { showToast } = useHabits();
  const [index, setIndex] = useState(0);
  const [includeCount, setIncludeCount] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const option = options[index];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    setError('');
    renderShareCard(canvas, option.build(includeCount ? habitCount : undefined)).catch(() => {
      if (!cancelled) setError('Não foi possível gerar a imagem neste navegador.');
    });
    return () => {
      cancelled = true;
    };
  }, [option, includeCount, habitCount]);

  const exportCard = async (mode: 'share' | 'download') => {
    const canvas = canvasRef.current;
    if (!canvas || busy) return;
    setBusy(true);
    try {
      const blob = await canvasToPngBlob(canvas);
      if (!blob) {
        setError('Não foi possível gerar a imagem neste navegador.');
        return;
      }
      if (mode === 'download') {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = option.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast('Imagem salva.');
      } else {
        const outcome = await shareOrDownload(blob, option.filename);
        if (outcome === 'downloaded') showToast('Imagem salva.');
      }
    } finally {
      setBusy(false);
    }
  };

  const btn =
    'min-h-[44px] flex-1 flex items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-50';

  return (
    <ModalShell labelledBy="share-title" onClose={onClose} widthClass="sm:max-w-md">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 id="share-title" className="text-sm font-semibold tracking-tight">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Fechar" className="w-11 h-11 -mr-2 flex items-center justify-center rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {options.length > 1 && (
          <div role="tablist" aria-label="Cartões" className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            {options.map((o, i) => (
              <button
                key={o.label}
                type="button"
                role="tab"
                aria-selected={i === index}
                onClick={() => setIndex(i)}
                className={`min-h-[44px] rounded-lg text-xs font-medium transition-all ${
                  i === index ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-xs font-semibold' : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-zinc-100 dark:bg-zinc-900">
          <canvas
            ref={canvasRef}
            width={CARD_W}
            height={CARD_H}
            role="img"
            aria-label={`Prévia da imagem: ${option.label}`}
            className="w-full h-auto block"
            style={{ aspectRatio: `${CARD_W} / ${CARD_H}` }}
          />
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={includeCount}
          onClick={() => setIncludeCount((v) => !v)}
          className="w-full min-h-[44px] flex items-center justify-between gap-3 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 text-left"
        >
          <span>
            <span className="block text-xs font-medium">Incluir total de hábitos</span>
            <span className="block text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              A imagem nunca mostra nomes de hábitos, notas, e-mail ou nome.
            </span>
          </span>
          <span aria-hidden="true" className={`w-9 h-5 rounded-full p-0.5 transition-colors shrink-0 ${includeCount ? 'bg-zinc-950 dark:bg-zinc-50' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
            <span className={`block w-4 h-4 rounded-full transition-transform ${includeCount ? 'translate-x-4 bg-white dark:bg-zinc-950' : 'translate-x-0 bg-white'}`} />
          </span>
        </button>

        <p role="alert" className="text-[11px] font-medium text-zinc-900 dark:text-zinc-100 empty:hidden">{error}</p>

        <div className="flex gap-2">
          <button type="button" disabled={busy || Boolean(error)} onClick={() => exportCard('share')} className={`${btn} bg-zinc-950 text-zinc-50 border-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 dark:border-zinc-50`}>
            <Share2 className="w-4 h-4" aria-hidden="true" />
            Compartilhar
          </button>
          <button type="button" disabled={busy || Boolean(error)} onClick={() => exportCard('download')} className={`${btn} border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800`}>
            <Download className="w-4 h-4" aria-hidden="true" />
            Baixar PNG
          </button>
        </div>
      </div>
    </ModalShell>
  );
};
