import { CARD_H, CARD_W, PALETTES, formatInt, formatPercent, layoutGrid, type ShareCardSpec } from './shareImage';

const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const PAD = 90;

/** Desenha um cartão 1080x1350 monocromático. Nunca recebe nem desenha títulos, notas ou dados de conta. */
export async function renderShareCard(canvas: HTMLCanvasElement, spec: ShareCardSpec): Promise<void> {
  try {
    await document.fonts?.ready; // evita desenhar com a fonte de reserva
  } catch {
    /* sem suporte */
  }
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas indisponível');
  const p = PALETTES[spec.theme];

  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.textBaseline = 'alphabetic';

  const text = (value: string, x: number, y: number, size: number, weight: number, color: string, align: CanvasTextAlign = 'left') => {
    ctx.font = `${weight} ${size}px ${MONO}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(value, x, y);
  };

  // Marca e título do período
  text('MONO // HABITS', PAD, 130, 44, 700, p.fg);
  text(spec.title.toUpperCase(), PAD, 190, 34, 400, p.muted);
  ctx.fillStyle = p.muted;
  ctx.globalAlpha = 0.4;
  ctx.fillRect(PAD, 225, CARD_W - PAD * 2, 2);
  ctx.globalAlpha = 1;

  if (spec.kind === 'grid') {
    text(formatPercent(spec.rate), PAD, 470, 260, 700, p.fg);
    text('taxa de conclusão', PAD, 530, 38, 400, p.muted);

    const layout = layoutGrid(spec.days, { x: PAD, y: 590, w: CARD_W - PAD * 2, h: 560 }, { maxCell: 110 });
    for (const c of layout.cells) {
      ctx.fillStyle = p.levels[c.level];
      const r = Math.max(2, c.size * 0.18);
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') ctx.roundRect(c.x, c.y, c.size, c.size, r);
      else ctx.rect(c.x, c.y, c.size, c.size);
      ctx.fill();
    }

    text(`melhor ofensiva: ${formatInt(spec.bestStreak)} ${spec.bestStreak === 1 ? 'dia' : 'dias'}`, PAD, 1230, 38, 700, p.fg);
    if (spec.habitCount !== undefined) {
      text(`${formatInt(spec.habitCount)} ${spec.habitCount === 1 ? 'hábito' : 'hábitos'}`, PAD, 1285, 34, 400, p.muted);
    }
  }

  if (spec.kind === 'numbers') {
    let y = 400;
    for (const it of spec.items) {
      text(it.value, PAD, y, 120, 700, p.fg);
      text(it.label, PAD, y + 55, 40, 400, p.muted);
      y += 230;
    }
    if (spec.habitCount !== undefined) {
      text(`${formatInt(spec.habitCount)} ${spec.habitCount === 1 ? 'hábito' : 'hábitos'}`, PAD, 1285, 34, 400, p.muted);
    }
  }

  if (spec.kind === 'weekday') {
    text('seu dia mais forte', PAD, 420, 44, 400, p.muted);
    if (spec.weekday) {
      // Quebra no hífen para caber ("segunda-" / "feira") sem estourar a largura
      const parts = spec.weekday.split('-');
      let y = 640;
      for (const part of parts.length > 1 ? [`${parts[0]}-`, parts[1]] : parts) {
        text(part, PAD, y, 150, 700, p.fg);
        y += 170;
      }
      text(`${formatPercent(spec.rate)} de conclusão`, PAD, y + 40, 48, 400, p.muted);
    } else {
      text('ainda sem dados suficientes', PAD, 600, 52, 700, p.fg);
    }
    if (spec.habitCount !== undefined) {
      text(`${formatInt(spec.habitCount)} ${spec.habitCount === 1 ? 'hábito' : 'hábitos'}`, PAD, 1285, 34, 400, p.muted);
    }
  }
}

export const canvasToPngBlob = (canvas: HTMLCanvasElement): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

/** Compartilha o PNG pelo sistema quando possível; senão baixa. Cancelar não é erro. */
export async function shareOrDownload(blob: Blob, filename: string): Promise<ShareOutcome> {
  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'MONO // HABITS' });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      /* outro erro: cai para o download */
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
