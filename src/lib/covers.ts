import type { CSSProperties } from 'react';
import type { HabitCover } from '@/types/habit';

/** Maior dimensão (largura) da imagem de capa enviada, em pixels */
export const COVER_MAX_DIMENSION = 640;
/** Proporção das capas (largura / altura) */
export const COVER_ASPECT = 16 / 9;
/** Tamanho-alvo da imagem comprimida, em bytes */
export const COVER_TARGET_BYTES = 80 * 1024;
/**
 * Teto aceito ao ler uma capa do storage/nuvem (bytes decodificados). Um pouco acima do alvo
 * para tolerar variações; em base64 (~4/3) fica abaixo de ~125 mil caracteres, bem longe do
 * limite de 1 MiB do documento do Firestore.
 */
export const COVER_MAX_BYTES = 90 * 1024;

export interface CoverTone {
  id: string;
  label: string;
}

export const COVER_TONES: CoverTone[] = [
  { id: 'light', label: 'Claro' },
  { id: 'mid', label: 'Médio' },
  { id: 'dark', label: 'Escuro' }
];

export const DEFAULT_COVER_TONE = 'mid';

export type CoverTheme = 'light' | 'dark';

/** Pares fundo/traço (escala zinc) por tom e por tema do app */
const PALETTE: Record<CoverTheme, Record<string, { bg: string; fg: string }>> = {
  light: {
    light: { bg: '#f4f4f5', fg: '#d4d4d8' }, // zinc-100 / zinc-300
    mid: { bg: '#a1a1aa', fg: '#71717a' }, // zinc-400 / zinc-500
    dark: { bg: '#18181b', fg: '#52525b' } // zinc-900 / zinc-600
  },
  dark: {
    light: { bg: '#d4d4d8', fg: '#a1a1aa' }, // zinc-300 / zinc-400
    mid: { bg: '#52525b', fg: '#3f3f46' }, // zinc-600 / zinc-700
    dark: { bg: '#09090b', fg: '#27272a' } // zinc-950 / zinc-800
  }
};

interface PatternDef {
  id: string;
  label: string;
  /** Lado do ladrilho em px (escala 1) */
  tile: number;
  /** Camadas CSS (background-image) para o par de cores; ausente = só cor de fundo */
  image?: (bg: string, fg: string) => string;
  /** Cobre o contêiner inteiro em vez de repetir o ladrilho */
  cover?: boolean;
}

const svg = (w: number, h: number, body: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`
  )}")`;

export const COVER_PATTERNS: PatternDef[] = [
  { id: 'solid', label: 'Sólido', tile: 1 },
  {
    id: 'gradient',
    label: 'Degradê',
    tile: 1,
    cover: true,
    image: (bg, fg) => `linear-gradient(135deg, ${bg}, ${fg})`
  },
  {
    id: 'stripes',
    label: 'Listras diagonais',
    tile: 24,
    image: (bg, fg) =>
      `linear-gradient(45deg, ${bg} 25%, ${fg} 25%, ${fg} 50%, ${bg} 50%, ${bg} 75%, ${fg} 75%)`
  },
  {
    id: 'dots',
    label: 'Pontos',
    tile: 20,
    image: (_bg, fg) => `radial-gradient(circle at 50% 50%, ${fg} 0 16%, transparent 18%)`
  },
  {
    id: 'grid',
    label: 'Grade',
    tile: 28,
    image: (_bg, fg) =>
      `linear-gradient(to right, ${fg} 0 4%, transparent 4%), linear-gradient(to bottom, ${fg} 0 4%, transparent 4%)`
  },
  {
    id: 'checker',
    label: 'Xadrez',
    tile: 32,
    image: (bg, fg) => `conic-gradient(${fg} 25%, ${bg} 0 50%, ${fg} 0 75%, ${bg} 0)`
  },
  {
    id: 'rings',
    label: 'Círculos concêntricos',
    tile: 72,
    image: (bg, fg) =>
      `radial-gradient(circle closest-side at 50% 50%, ${fg} 0 10%, ${bg} 10% 30%, ${fg} 30% 40%, ${bg} 40% 60%, ${fg} 60% 70%, ${bg} 70% 90%, ${fg} 90% 100%)`
  },
  {
    id: 'waves',
    label: 'Ondas',
    tile: 48,
    image: (_bg, fg) =>
      svg(
        48,
        48,
        `<path d="M0 12 Q12 0 24 12 T48 12 M0 36 Q12 24 24 36 T48 36" fill="none" stroke="${fg}" stroke-width="3"/>`
      )
  },
  {
    id: 'zigzag',
    label: 'Zigue-zague',
    tile: 32,
    image: (_bg, fg) =>
      svg(
        32,
        32,
        `<path d="M0 12 L8 4 L16 12 L24 4 L32 12 M0 28 L8 20 L16 28 L24 20 L32 28" fill="none" stroke="${fg}" stroke-width="3"/>`
      )
  },
  {
    id: 'cross',
    label: 'Cruzes',
    tile: 24,
    image: (_bg, fg) =>
      svg(24, 24, `<path d="M12 7v10M7 12h10" stroke="${fg}" stroke-width="2.5" stroke-linecap="round"/>`)
  }
];

const patternById = new Map(COVER_PATTERNS.map((p) => [p.id, p]));

export const isKnownPattern = (id: unknown): id is string => typeof id === 'string' && patternById.has(id);
export const isKnownTone = (id: unknown): id is string => typeof id === 'string' && id in PALETTE.light;

/** Estilo CSS de um padrão; `scale` reduz/amplia o ladrilho (miniaturas usam < 1). */
export function patternStyle(pattern: string, tone: string, theme: CoverTheme, scale = 1): CSSProperties | undefined {
  const def = patternById.get(pattern);
  const colors = PALETTE[theme]?.[tone];
  if (!def || !colors) return undefined;
  const style: CSSProperties = { backgroundColor: colors.bg };
  if (def.image) {
    style.backgroundImage = def.image(colors.bg, colors.fg);
    const size = Math.max(4, Math.round(def.tile * scale));
    style.backgroundSize = def.cover ? '100% 100%' : `${size}px ${size}px`;
    if (!def.cover) style.backgroundPosition = 'center';
  }
  return style;
}

/** Estilo CSS de uma capa de padrão para o tema pedido (undefined se não for padrão/válida) */
export function coverStyle(cover: HabitCover | undefined, theme: CoverTheme, scale = 1): CSSProperties | undefined {
  if (!cover || cover.type !== 'pattern') return undefined;
  return patternStyle(cover.pattern, cover.tone, theme, scale);
}

export function patternLabel(id: string): string {
  return patternById.get(id)?.label ?? id;
}

// ---------- Validação ----------

const DATA_URL_RE = /^data:image\/(?:jpeg|webp|png);base64,([A-Za-z0-9+/]+={0,2})$/;

/** Bytes decodificados de uma data URL de imagem válida; null se malformada */
export function dataUrlBytes(dataUrl: unknown): number | null {
  if (typeof dataUrl !== 'string') return null;
  // Teto de comprimento barato antes da regex (evita varrer strings gigantes)
  if (dataUrl.length > Math.ceil((COVER_MAX_BYTES * 4) / 3) + 64) return null;
  const m = DATA_URL_RE.exec(dataUrl);
  if (!m) return null;
  const b64 = m[1];
  if (b64.length % 4 !== 0) return null;
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return (b64.length / 4) * 3 - pad;
}

/**
 * Valida/sanitiza uma capa vinda do localStorage ou da nuvem. Qualquer coisa inesperada
 * (ids desconhecidos, data URL malformada ou acima do teto) vira undefined = sem capa.
 */
export function sanitizeHabitCover(value: unknown): HabitCover | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Record<string, unknown>;
  if (v.type === 'pattern') {
    if (!isKnownPattern(v.pattern) || !isKnownTone(v.tone)) return undefined;
    return { type: 'pattern', pattern: v.pattern, tone: v.tone };
  }
  if (v.type === 'image') {
    const bytes = dataUrlBytes(v.dataUrl);
    if (bytes === null || bytes > COVER_MAX_BYTES) return undefined;
    return { type: 'image', dataUrl: v.dataUrl as string };
  }
  return undefined;
}

/** Aplica a sanitização da capa a um hábito vindo de fora, removendo o campo se inválido */
export function withSanitizedCover<T extends { cover?: unknown }>(habit: T): T {
  if (!('cover' in habit)) return habit;
  const { cover, ...rest } = habit;
  const clean = sanitizeHabitCover(cover);
  return (clean ? { ...rest, cover: clean } : rest) as T;
}

// ---------- Recorte e escala (puro) ----------

export interface CoverCrop {
  /** Região de origem (center-crop 16:9) */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** Tamanho final do canvas */
  dw: number;
  dh: number;
}

/**
 * Center-crop para 16:9 e redução para no máximo `maxWidth` de largura (nunca amplia).
 * `scale` (0-1] reduz ainda mais o resultado, usado nas tentativas de caber no teto de bytes.
 */
export function computeCoverCrop(
  srcWidth: number,
  srcHeight: number,
  maxWidth = COVER_MAX_DIMENSION,
  scale = 1
): CoverCrop | null {
  if (!(srcWidth > 0) || !(srcHeight > 0)) return null;
  let sw = srcWidth;
  let sh = Math.round(srcWidth / COVER_ASPECT);
  if (sh > srcHeight) {
    sh = srcHeight;
    sw = Math.round(srcHeight * COVER_ASPECT);
  }
  sw = Math.min(sw, srcWidth);
  const sx = Math.floor((srcWidth - sw) / 2);
  const sy = Math.floor((srcHeight - sh) / 2);
  const dw = Math.max(16, Math.round(Math.min(sw, maxWidth) * scale));
  const dh = Math.max(9, Math.round(dw / COVER_ASPECT));
  return { sx, sy, sw, sh, dw, dh };
}
