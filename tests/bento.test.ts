import { describe, it, expect } from 'vitest';
import { canFeature, countFeatured, featuredIds, orderFeaturedFirst, MAX_FEATURED } from '@/lib/bento';
import type { Habit } from '@/types/habit';

const h = (id: string, o: Partial<Habit> = {}): Habit => ({ id, title: id, category: 'c', icon: 'book', frequency: [0], createdAt: 1, ...o }) as Habit;

describe('destaque do bento', () => {
  it('limita a 2 hábitos ativos em destaque', () => {
    const hs = [h('a', { featured: true }), h('b', { featured: true }), h('c')];
    expect(MAX_FEATURED).toBe(2);
    expect(countFeatured(hs)).toBe(2);
    expect(canFeature(hs, 'c')).toBe(false);
    expect(canFeature(hs, 'a')).toBe(true); // editar um já destacado não conta contra si
  });
  it('arquivados não ocupam vaga', () => {
    const hs = [h('a', { featured: true, archived: true }), h('b', { featured: true })];
    expect(countFeatured(hs)).toBe(1);
    expect(canFeature(hs, 'c')).toBe(true);
  });
  it('featuredIds ignora o excedente', () => {
    const hs = [h('a', { featured: true }), h('b', { featured: true }), h('c', { featured: true })];
    expect([...featuredIds(hs)]).toEqual(['a', 'b']);
  });
  it('orderFeaturedFirst fixa os destaques no topo sem reordenar o resto', () => {
    const hs = [h('a'), h('b', { featured: true }), h('c'), h('d', { featured: true })];
    expect(orderFeaturedFirst(hs).map((x) => x.id)).toEqual(['b', 'd', 'a', 'c']);
  });
});
