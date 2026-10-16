import { describe, it, expect } from 'vitest';
import { categoryKey, getCategoryCounts } from '@/lib/categories';

const h = (category: string) => ({ category });

describe('categories', () => {
  it('retorna lista vazia sem hábitos', () => {
    expect(getCategoryCounts([])).toEqual([]);
  });

  it('agrupa variações de caixa e espaços preservando um rótulo', () => {
    const r = getCategoryCounts([h('saúde'), h('Saúde '), h('  SAÚDE')]);
    expect(r).toEqual([{ key: 'saúde', label: 'saúde', count: 3 }]);
  });

  it('colapsa espaços internos', () => {
    expect(categoryKey('Vida   Social')).toBe(categoryKey('vida social'));
  });

  it('trata vazio/indefinido como Geral', () => {
    const r = getCategoryCounts([h(''), h('   '), { category: undefined as unknown as string }, h('geral')]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ key: 'geral', label: 'Geral', count: 4 });
  });

  it('ordena por contagem desc. e depois alfabeticamente (pt-BR)', () => {
    const r = getCategoryCounts([
      h('Zen'), h('Árvores'), h('Estudo'), h('Estudo'), h('Saúde'), h('Saúde'), h('Saúde'),
    ]);
    expect(r.map((c) => [c.label, c.count])).toEqual([
      ['Saúde', 3], ['Estudo', 2], ['Árvores', 1], ['Zen', 1],
    ]);
  });
});
