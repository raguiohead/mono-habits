import React, { useId, useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { FAQ, GLOSSARY, HELP_CATEGORIES, filterFaq, filterGlossary, type HelpCategory } from '@/lib/help';

/** Ajuda dentro das Configurações: perguntas e respostas (acordeão, busca e filtros) e glossário */
export const HelpView: React.FC = () => {
  const baseId = useId();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<HelpCategory | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const faq = useMemo(() => filterFaq(FAQ, query, category), [query, category]);
  // O glossário acompanha a busca, mas some quando uma categoria de perguntas está filtrada
  const glossary = useMemo(() => (category ? [] : filterGlossary(GLOSSARY, query)), [query, category]);

  const chip = (selected: boolean) =>
    `min-h-[44px] px-3.5 rounded-xl border text-xs font-mono transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-50 ${
      selected
        ? 'bg-zinc-950 text-zinc-50 border-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 dark:border-zinc-50 font-semibold'
        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
    }`;

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar na ajuda"
          aria-label="Buscar na ajuda"
          className="w-full min-h-[44px] pl-10 pr-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-50"
        />
      </div>

      <div role="group" aria-label="Filtrar por assunto" className="flex flex-wrap gap-1.5">
        <button type="button" aria-pressed={category === null} onClick={() => setCategory(null)} className={chip(category === null)}>
          Tudo
        </button>
        {HELP_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={category === c.id}
            onClick={() => setCategory(category === c.id ? null : c.id)}
            className={chip(category === c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <section aria-label="Perguntas e respostas" className="space-y-2">
        <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Perguntas e respostas</h4>
        {faq.length === 0 ? (
          <p role="status" className="text-xs text-zinc-500 dark:text-zinc-400 py-3">
            Nada encontrado para essa busca. Tente outra palavra.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {faq.map((item) => {
              const open = openId === item.id;
              const panelId = `${baseId}-${item.id}`;
              return (
                <li key={item.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => setOpenId(open ? null : item.id)}
                    className="w-full min-h-[44px] px-3.5 py-2.5 flex items-center justify-between gap-3 text-left text-sm font-medium rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-50"
                  >
                    <span>{item.question}</span>
                    <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>
                  {open && (
                    <p id={panelId} className="px-3.5 pb-3.5 -mt-0.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                      {item.answer}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {glossary.length > 0 && (
        <section aria-label="Glossário" className="space-y-2">
          <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Glossário rápido</h4>
          <dl className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-200 dark:divide-zinc-800">
            {glossary.map((g) => (
              <div key={g.term} className="px-3.5 py-2.5">
                <dt className="text-xs font-semibold">{g.term}</dt>
                <dd className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 leading-relaxed">{g.definition}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
};
