import { COVER_TARGET_BYTES, computeCoverResize, dataUrlBytes } from './covers';
import type { HabitCover } from '@/types/habit';

/** Arquivos de origem acima disso nem são decodificados (protege a memória do aparelho) */
const MAX_SOURCE_BYTES = 30 * 1024 * 1024;
const QUALITIES = [0.82, 0.72, 0.62, 0.52, 0.42, 0.32];
const SCALES = [1, 0.8, 0.6];

export class CoverImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CoverImageError';
  }
}

const readAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

async function decode(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() };
    } catch {
      /* cai para <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url)
    };
  } catch {
    URL.revokeObjectURL(url);
    throw new CoverImageError('Não foi possível ler essa imagem. Tente outro arquivo.');
  }
}

/**
 * Lê uma imagem escolhida pelo usuário, reduz (sem recortar: o enquadramento é feito depois, no modal)
 * e exporta WebP (ou JPEG) com até ~80 KB.
 * Lança CoverImageError (mensagem em pt-BR) quando não for possível.
 */
export async function fileToCover(file: File): Promise<Extract<HabitCover, { type: 'image' }>> {
  if (!file.type.startsWith('image/')) {
    throw new CoverImageError('O arquivo escolhido não é uma imagem.');
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new CoverImageError('A imagem é grande demais (máximo de 30 MB).');
  }

  const decoded = await decode(file);
  try {
    let webpOk = true;
    for (const scale of SCALES) {
      const size = computeCoverResize(decoded.width, decoded.height, scale);
      if (!size) throw new CoverImageError('Não foi possível ler essa imagem. Tente outro arquivo.');
      const canvas = document.createElement('canvas');
      canvas.width = size.dw;
      canvas.height = size.dh;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new CoverImageError('Seu navegador não conseguiu processar a imagem.');
      ctx.fillStyle = '#ffffff'; // transparência vira branco (JPEG não tem alfa)
      ctx.fillRect(0, 0, size.dw, size.dh);
      ctx.drawImage(decoded.source, 0, 0, decoded.width, decoded.height, 0, 0, size.dw, size.dh);

      for (const quality of QUALITIES) {
        let blob = webpOk ? await canvasToBlob(canvas, 'image/webp', quality) : null;
        if (blob && blob.type !== 'image/webp') {
          webpOk = false; // navegador sem encoder WebP
          blob = null;
        }
        if (!blob) blob = await canvasToBlob(canvas, 'image/jpeg', quality);
        if (!blob) throw new CoverImageError('Seu navegador não conseguiu processar a imagem.');
        if (blob.size <= COVER_TARGET_BYTES) {
          const dataUrl = await readAsDataUrl(blob);
          const bytes = dataUrlBytes(dataUrl);
          if (bytes === null) throw new CoverImageError('Não foi possível processar a imagem.');
          return { type: 'image', dataUrl };
        }
      }
    }
  } finally {
    decoded.release();
  }
  throw new CoverImageError('Não foi possível reduzir essa imagem o bastante. Tente outra, mais simples.');
}
