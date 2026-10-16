import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Move, RotateCcw } from 'lucide-react';
import { HabitCover } from './HabitCover';
import { COVER_ASPECT, COVER_ZOOM_MAX, COVER_ZOOM_MIN, coverView, panCover, panRange } from '@/lib/covers';
import type { HabitCover as HabitCoverData } from '@/types/habit';

type ImageCover = Extract<HabitCoverData, { type: 'image' }>;

interface CoverFramerProps {
  cover: ImageCover;
  onChange: (cover: ImageCover) => void;
  busy?: boolean;
}

const KEY_STEP = 0.05;

/**
 * Editor de enquadramento da capa de imagem: arraste (ou use as setas) para reposicionar e o controle
 * deslizante para o zoom. A janela é 16:9, a mesma proporção do cartão do layout Capas.
 */
export const CoverFramer: React.FC<CoverFramerProps> = ({ cover, onChange, busy }) => {
  const view = coverView(cover);
  const windowRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ px: number; py: number; start: typeof view } | null>(null);
  const [aspect, setAspect] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  // Proporção da imagem guardada, para saber quanto ela sobra da janela em cada eixo
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled && img.naturalHeight > 0) setAspect(img.naturalWidth / img.naturalHeight);
    };
    img.src = cover.dataUrl;
    return () => {
      cancelled = true;
    };
  }, [cover.dataUrl]);

  const range = panRange(aspect ?? COVER_ASPECT, COVER_ASPECT, view.zoom);
  const canMove = range.rx > 0.001 || range.ry > 0.001;

  const update = (next: { x: number; y: number; zoom: number }) =>
    onChange({ type: 'image', dataUrl: cover.dataUrl, x: next.x, y: next.y, zoom: next.zoom });

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (busy || !canMove) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, start: view };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = windowRef.current;
    if (!d || !el) return;
    const rect = el.getBoundingClientRect();
    update(panCover(d.start, e.clientX - d.px, e.clientY - d.py, rect.width, rect.height, range));
  };

  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowLeft: [-KEY_STEP, 0], ArrowRight: [KEY_STEP, 0], ArrowUp: [0, -KEY_STEP], ArrowDown: [0, KEY_STEP] }[
      e.key
    ];
    if (!step || busy) return;
    e.preventDefault();
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    update({
      ...view,
      x: range.rx > 0.001 ? clamp(view.x + step[0]) : view.x,
      y: range.ry > 0.001 ? clamp(view.y + step[1]) : view.y
    });
  };

  const isDefault = view.x === 0.5 && view.y === 0.5 && view.zoom === 1;

  return (
    <div className="space-y-2">
      <div className="relative rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-zinc-100 dark:bg-zinc-900">
        <div
          ref={windowRef}
          role="group"
          tabIndex={0}
          aria-label="Enquadramento da capa. Arraste a imagem ou use as setas do teclado para reposicionar."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onKeyDown}
          style={{ touchAction: 'none' }}
          className={`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-50 ${
            canMove ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : ''
          }`}
        >
          <HabitCover cover={cover} className="w-full" />
        </div>
        {canMove && !busy && (
          <span className="pointer-events-none absolute left-2 bottom-2 flex items-center gap-1 rounded-md bg-zinc-950/75 text-zinc-50 px-1.5 py-1 text-[10px] font-mono">
            <Move className="w-3 h-3" aria-hidden="true" />
            Arraste para reposicionar
          </span>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-zinc-950/60 text-zinc-50 text-[11px] font-mono">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            Processando imagem...
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <label className="flex-1 flex items-center gap-2 min-h-[44px] text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
          Zoom
          <input
            type="range"
            min={COVER_ZOOM_MIN}
            max={COVER_ZOOM_MAX}
            step={0.05}
            value={view.zoom}
            disabled={busy}
            onChange={(e) => update({ ...view, zoom: Number(e.target.value) })}
            aria-valuetext={`${view.zoom.toFixed(1)}x`}
            className="flex-1 min-h-[44px] accent-zinc-950 dark:accent-zinc-50"
          />
          <span className="w-8 text-right tabular-nums">{view.zoom.toFixed(1)}x</span>
        </label>
        <button
          type="button"
          disabled={busy || isDefault}
          onClick={() => update({ x: 0.5, y: 0.5, zoom: 1 })}
          className="min-h-[44px] flex items-center justify-center gap-1.5 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-50"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          Centralizar
        </button>
      </div>
    </div>
  );
};
