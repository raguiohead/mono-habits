import { describe, it, expect } from 'vitest';
import {
  COVER_MAX_BYTES,
  COVER_MAX_DIMENSION,
  COVER_PATTERNS,
  COVER_TONES,
  computeCoverCrop,
  coverStyle,
  dataUrlBytes,
  sanitizeHabitCover,
  withSanitizedCover
} from '@/lib/covers';
import type { Habit } from '@/types/habit';

const b64 = (bytes: number) => 'A'.repeat(Math.ceil(bytes / 3) * 4);
const jpeg = (bytes: number) => `data:image/jpeg;base64,${b64(bytes)}`;

describe('catálogo', () => {
  it('tem ao menos 8 padrões e 3 tons, com ids únicos', () => {
    expect(COVER_PATTERNS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(COVER_PATTERNS.map((p) => p.id)).size).toBe(COVER_PATTERNS.length);
    expect(new Set(COVER_TONES.map((t) => t.id)).size).toBe(3);
  });

  it('todo padrão × tom gera estilo nos dois temas, só com escala zinc', () => {
    const zinc = /#(?:fafafa|f4f4f5|e4e4e7|d4d4d8|a1a1aa|71717a|52525b|3f3f46|27272a|18181b|09090b)/gi;
    for (const p of COVER_PATTERNS) {
      for (const t of COVER_TONES) {
        for (const theme of ['light', 'dark'] as const) {
          const st = coverStyle({ type: 'pattern', pattern: p.id, tone: t.id }, theme)!;
          expect(st.backgroundColor).toMatch(/^#/);
          const css = `${st.backgroundColor} ${st.backgroundImage ?? ''}`;
          const hexes = css.replace(/%23/g, '#').match(/#[0-9a-f]{6}/gi) ?? [];
          expect(hexes.length).toBeGreaterThan(0);
          for (const h of hexes) expect(h.match(zinc)).not.toBeNull();
        }
      }
    }
  });
});

describe('coverStyle', () => {
  it('sólido usa só cor de fundo', () => {
    const st = coverStyle({ type: 'pattern', pattern: 'solid', tone: 'light' }, 'light')!;
    expect(st.backgroundImage).toBeUndefined();
  });

  it('padrão com ladrilho define imagem e tamanho, e a escala o reduz', () => {
    const full = coverStyle({ type: 'pattern', pattern: 'dots', tone: 'mid' }, 'light', 1)!;
    const small = coverStyle({ type: 'pattern', pattern: 'dots', tone: 'mid' }, 'light', 0.5)!;
    expect(full.backgroundImage).toContain('radial-gradient');
    expect(full.backgroundSize).toBe('20px 20px');
    expect(small.backgroundSize).toBe('10px 10px');
  });

  it('claro e escuro diferem; imagem e ausente não geram estilo', () => {
    const c = { type: 'pattern', pattern: 'grid', tone: 'dark' } as const;
    expect(coverStyle(c, 'light')!.backgroundColor).not.toBe(coverStyle(c, 'dark')!.backgroundColor);
    expect(coverStyle({ type: 'image', dataUrl: jpeg(10) }, 'light')).toBeUndefined();
    expect(coverStyle(undefined, 'light')).toBeUndefined();
  });
});

describe('sanitizeHabitCover', () => {
  it('aceita padrão válido', () => {
    expect(sanitizeHabitCover({ type: 'pattern', pattern: 'waves', tone: 'light', x: 1 })).toEqual({
      type: 'pattern',
      pattern: 'waves',
      tone: 'light'
    });
  });

  it('rejeita ids desconhecidos e formatos estranhos', () => {
    expect(sanitizeHabitCover({ type: 'pattern', pattern: 'nope', tone: 'light' })).toBeUndefined();
    expect(sanitizeHabitCover({ type: 'pattern', pattern: 'waves', tone: 'neon' })).toBeUndefined();
    expect(sanitizeHabitCover({ type: 'other' })).toBeUndefined();
    expect(sanitizeHabitCover(null)).toBeUndefined();
    expect(sanitizeHabitCover('x')).toBeUndefined();
  });

  it('aceita data URL válida dentro do teto', () => {
    const dataUrl = jpeg(1000);
    expect(sanitizeHabitCover({ type: 'image', dataUrl })).toEqual({ type: 'image', dataUrl });
    expect(sanitizeHabitCover({ type: 'image', dataUrl: dataUrl.replace('jpeg', 'webp') })).toBeDefined();
  });

  it('rejeita data URL malformada, de outro tipo ou sem base64', () => {
    for (const dataUrl of [
      'data:image/svg+xml;base64,AAAA',
      'data:text/html;base64,AAAA',
      'https://x.com/a.jpg',
      'data:image/jpeg;base64,',
      'data:image/jpeg;base64,AA AA',
      'data:image/jpeg;base64,AAA',
      'data:image/jpeg,AAAA',
      42
    ]) {
      expect(sanitizeHabitCover({ type: 'image', dataUrl })).toBeUndefined();
    }
  });

  it('rejeita acima do teto de bytes', () => {
    expect(sanitizeHabitCover({ type: 'image', dataUrl: jpeg(COVER_MAX_BYTES + 3000) })).toBeUndefined();
    expect(dataUrlBytes(jpeg(COVER_MAX_BYTES - 3))).toBeLessThanOrEqual(COVER_MAX_BYTES);
  });
});

describe('compatibilidade com hábitos antigos', () => {
  const base: Habit = {
    id: 'h',
    title: 'Ler',
    category: 'Geral',
    icon: 'book',
    frequency: [1],
    createdAt: 1
  };

  it('hábito sem cover permanece idêntico', () => {
    expect(withSanitizedCover(base)).toBe(base);
  });

  it('cover inválida é removida sem afetar o resto', () => {
    const bad = { ...base, cover: { type: 'pattern', pattern: 'x', tone: 'y' } };
    const out = withSanitizedCover(bad);
    expect('cover' in out).toBe(false);
    expect(out.title).toBe('Ler');
  });
});

describe('computeCoverCrop', () => {
  it('imagem larga: recorta as laterais e reduz para 640', () => {
    const c = computeCoverCrop(4000, 1500)!;
    expect(c.sh).toBe(1500);
    expect(c.sw).toBe(Math.round(1500 * (16 / 9)));
    expect(c.sx).toBe(Math.floor((4000 - c.sw) / 2));
    expect(c.sy).toBe(0);
    expect(c.dw).toBe(COVER_MAX_DIMENSION);
    expect(c.dh).toBe(360);
  });

  it('imagem alta (retrato): recorta o topo e a base', () => {
    const c = computeCoverCrop(3000, 4000)!;
    expect(c.sw).toBe(3000);
    expect(c.sh).toBe(Math.round(3000 / (16 / 9)));
    expect(c.sy).toBe(Math.floor((4000 - c.sh) / 2));
    expect(c.sx).toBe(0);
  });

  it('não amplia imagens pequenas e respeita a escala', () => {
    expect(computeCoverCrop(320, 180)!.dw).toBe(320);
    expect(computeCoverCrop(4000, 2250, 640, 0.5)!.dw).toBe(320);
  });

  it('dimensões inválidas retornam null', () => {
    expect(computeCoverCrop(0, 100)).toBeNull();
    expect(computeCoverCrop(100, NaN)).toBeNull();
  });
});
