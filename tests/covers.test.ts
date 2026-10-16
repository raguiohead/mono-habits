import { describe, it, expect } from 'vitest';
import {
  COVER_MAX_BYTES,
  COVER_PATTERNS,
  COVER_TONES,
  COVER_MAX_SOURCE_SIDE,
  computeCoverResize,
  coverImageStyle,
  coverView,
  panCover,
  panRange,
  coverOrFallback,
  fallbackCover,
  hashString,
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

describe('computeCoverResize', () => {
  it('reduz sem recortar: cobre a janela 640x360 e mantém a proporção', () => {
    const r = computeCoverResize(4000, 3000)!; // 4:3 -> largura 640 já cobre a altura 360
    expect(r.dw).toBe(640);
    expect(r.dh).toBe(480);
  });

  it('retrato: sobra altura para reposicionar', () => {
    const r = computeCoverResize(3000, 4000)!;
    expect(r.dw).toBe(640);
    expect(r.dh).toBe(853);
  });

  it('panorama extremo é limitado pelo maior lado', () => {
    const r = computeCoverResize(8000, 1000)!;
    expect(Math.max(r.dw, r.dh)).toBeLessThanOrEqual(COVER_MAX_SOURCE_SIDE);
  });

  it('não amplia imagens pequenas e respeita a escala', () => {
    expect(computeCoverResize(320, 180)).toEqual({ dw: 320, dh: 180 });
    expect(computeCoverResize(4000, 2250, 0.5)!.dw).toBe(320);
  });

  it('dimensões inválidas retornam null', () => {
    expect(computeCoverResize(0, 100)).toBeNull();
    expect(computeCoverResize(100, NaN)).toBeNull();
  });
});

describe('enquadramento da capa', () => {
  it('coverView usa padrões e limita os valores', () => {
    expect(coverView(undefined)).toEqual({ x: 0.5, y: 0.5, zoom: 1 });
    expect(coverView({ x: -1, y: 9, zoom: 99 })).toEqual({ x: 0, y: 1, zoom: 3 });
    expect(coverView({ x: 'a', zoom: NaN })).toEqual({ x: 0.5, y: 0.5, zoom: 1 });
  });

  it('panRange: só há o que mover no eixo em que a imagem sobra, e o zoom aumenta a sobra', () => {
    const wide = panRange(21 / 9, 16 / 9, 1);
    expect(wide.rx).toBeCloseTo(21 / 9 / (16 / 9) - 1);
    expect(wide.ry).toBe(0);
    const tall = panRange(3 / 4, 16 / 9, 1);
    expect(tall.rx).toBe(0);
    expect(tall.ry).toBeGreaterThan(1);
    expect(panRange(16 / 9, 16 / 9, 2)).toEqual({ rx: 1, ry: 1 });
    expect(panRange(0, 1, 1)).toEqual({ rx: 0, ry: 0 });
  });

  it('panCover: arrastar para a direita revela o início e fica limitado a 0-1', () => {
    const range = { rx: 1, ry: 0 };
    const start = { x: 0.5, y: 0.5, zoom: 2 };
    const r = panCover(start, 50, 30, 200, 100, range);
    expect(r.x).toBeCloseTo(0.25);
    expect(r.y).toBe(0.5); // sem sobra vertical
    expect(panCover(start, 9999, 0, 200, 100, range).x).toBe(0);
    expect(panCover(start, -9999, 0, 200, 100, range).x).toBe(1);
  });

  it('coverImageStyle: sem enquadramento preenche a janela; com zoom desloca a partir do ponto', () => {
    const base = coverImageStyle({});
    expect(base.width).toBe('100%');
    expect(base.left).toBe('0%');
    expect(base.objectPosition).toBe('50% 50%');
    const z = coverImageStyle({ x: 0, y: 1, zoom: 2 });
    expect(z.width).toBe('200%');
    expect(z.left).toBe('0%');
    expect(z.top).toBe('-100%');
  });

  it('sanitizeHabitCover mantém e limita o enquadramento; ignora lixo', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
    expect(sanitizeHabitCover({ type: 'image', dataUrl, x: 2, y: 0.3, zoom: 0.2 })).toEqual({
      type: 'image', dataUrl, x: 1, y: 0.3, zoom: 1
    });
    expect(sanitizeHabitCover({ type: 'image', dataUrl, x: 'a', zoom: NaN })).toEqual({ type: 'image', dataUrl });
  });
});

describe('capa de reserva', () => {
  it('é determinística por id e sempre um padrão válido, nunca liso', () => {
    expect(hashString('abc')).toBe(hashString('abc'));
    const ids = Array.from({ length: 200 }, (_, i) => `habit-${i}`);
    const seen = new Set<string>();
    for (const id of ids) {
      const a = fallbackCover(id);
      expect(fallbackCover(id)).toEqual(a);
      expect(sanitizeHabitCover(a)).toEqual(a);
      expect(a.type === 'pattern' && a.pattern).not.toBe('solid');
      if (a.type === 'pattern') seen.add(a.pattern);
    }
    expect(seen.size).toBeGreaterThan(3);
  });

  it('usa a capa do hábito quando existe', () => {
    const own = { type: 'pattern' as const, pattern: 'dots', tone: 'dark' };
    expect(coverOrFallback({ id: 'x', cover: own })).toBe(own);
    expect(coverOrFallback({ id: 'x' })).toEqual(fallbackCover('x'));
  });
});
