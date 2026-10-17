import { describe, it, expect } from 'vitest';
import { FAQ, GLOSSARY, HELP_CATEGORIES, filterFaq, filterGlossary, normalizeText } from '@/lib/help';

describe('conteúdo da ajuda', () => {
  it('ids únicos, categorias válidas e textos preenchidos', () => {
    expect(new Set(FAQ.map((f) => f.id)).size).toBe(FAQ.length);
    const cats = HELP_CATEGORIES.map((c) => c.id);
    for (const f of FAQ) {
      expect(cats).toContain(f.category);
      expect(f.question.length).toBeGreaterThan(5);
      expect(f.answer.length).toBeGreaterThan(20);
    }
    expect(new Set(GLOSSARY.map((g) => g.term)).size).toBe(GLOSSARY.length);
  });
  it('cada categoria tem perguntas', () => {
    for (const c of HELP_CATEGORIES) expect(FAQ.some((f) => f.category === c.id)).toBe(true);
  });
});

describe('busca e filtros', () => {
  it('normalizeText ignora acento e caixa', () => {
    expect(normalizeText('  Ofensiva Ênfase ')).toBe('ofensiva enfase');
  });
  it('sem busca nem categoria devolve tudo; a categoria restringe', () => {
    expect(filterFaq(FAQ, '', null)).toHaveLength(FAQ.length);
    const pomo = filterFaq(FAQ, '', 'pomo');
    expect(pomo.length).toBeGreaterThan(0);
    expect(pomo.every((f) => f.category === 'pomo')).toBe(true);
  });
  it('busca sem acento acha texto acentuado, e exige todas as palavras', () => {
    expect(filterFaq(FAQ, 'graca', null).map((f) => f.id)).toContain('dia-de-graca');
    expect(filterFaq(FAQ, 'ofensiva graca', null).map((f) => f.id)).toContain('dia-de-graca');
    expect(filterFaq(FAQ, 'xyzxyz', null)).toEqual([]);
  });
  it('categoria e busca combinam', () => {
    expect(filterFaq(FAQ, 'lembrete', 'habitos')).toEqual([]);
    expect(filterFaq(FAQ, 'lembrete', 'conta').length).toBeGreaterThan(0);
  });
  it('filtra o glossário', () => {
    expect(filterGlossary(GLOSSARY, 'escorregao').map((g) => g.term)).toContain('Escorregão');
    expect(filterGlossary(GLOSSARY, '')).toHaveLength(GLOSSARY.length);
  });
});
