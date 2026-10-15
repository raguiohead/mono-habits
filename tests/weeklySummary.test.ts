import { describe, it, expect } from 'vitest';
import {
  NO_DATA_MESSAGE,
  NO_HABITS_MESSAGE,
  buildWeeklySummary,
  weekRangeLabel
} from '@/lib/weeklySummary';
import { DEFAULT_SETTINGS, sanitizeSettings, shouldSendReminder } from '@/lib/settings';
import { toDateKey } from '@/lib/dateUtils';
import { type Habit, type LogsMap, type SlipsMap } from '@/types/habit';

// Hoje = quarta 18/06/2025. Semanas: 2/6 (anterior à passada) · 9/6 (passada) · 16/6 (atual)
const TODAY = new Date(2025, 5, 18, 12);
const WEEK_PAST = '2025-06-09';
const WEEK_BEFORE = '2025-06-02';
const WEEK_CURRENT = '2025-06-16';

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);

const habit = (id: string, over: Partial<Habit> = {}): Habit => ({
  id,
  title: id.toUpperCase(),
  category: 'Geral',
  icon: 'target',
  frequency: [0, 1, 2, 3, 4, 5, 6],
  createdAt: new Date(2025, 3, 1).getTime(), // 01/04/2025
  ...over
});

/** Marca o hábito nos dias [from, to] em que `pred` for verdadeiro */
function fill(
  logs: LogsMap,
  id: string,
  from: Date,
  to: Date,
  pred: (d: Date) => boolean = () => true
): LogsMap {
  for (let d = new Date(from); d.getTime() <= to.getTime(); d.setDate(d.getDate() + 1)) {
    if (pred(d)) {
      const k = toDateKey(d);
      logs[k] = [...(logs[k] || []), id];
    }
  }
  return logs;
}

const summarize = (habits: Habit[], logs: LogsMap, week: string, slips: SlipsMap = {}, today = TODAY) =>
  buildWeeklySummary(habits, logs, week, { slips, today });

describe('frase 1: taxa da semana vs semana anterior', () => {
  const habits = [habit('a'), habit('b')];

  it('semana encerrada com queda em relação à anterior', () => {
    const logs: LogsMap = {};
    fill(logs, 'a', day(2025, 6, 2), day(2025, 6, 8)); // semana anterior: tudo
    fill(logs, 'b', day(2025, 6, 2), day(2025, 6, 8));
    fill(logs, 'a', day(2025, 6, 9), day(2025, 6, 15)); // passada: a completo, b só seg-qua
    fill(logs, 'b', day(2025, 6, 9), day(2025, 6, 11));
    const s = summarize(habits, logs, WEEK_PAST);
    expect(s.rate).toBe(71); // 10 de 14
    expect(s.previousRate).toBe(100);
    expect(s.sentences[0]).toBe('Nessa semana você concluiu 71% dos hábitos, 29 pontos a menos que na semana anterior.');
    expect(s.isCurrentWeek).toBe(false);
    expect(s.hasData).toBe(true);
  });

  it('melhora e igualdade em relação à semana anterior', () => {
    const better: LogsMap = {};
    fill(better, 'a', day(2025, 6, 2), day(2025, 6, 4)); // anterior: 3 de 7
    fill(better, 'a', day(2025, 6, 9), day(2025, 6, 15)); // passada: 7 de 7
    expect(summarize([habit('a')], better, WEEK_PAST).sentences[0]).toBe(
      'Nessa semana você concluiu 100% dos hábitos, 57 pontos a mais que na semana anterior.'
    );

    const same: LogsMap = {};
    fill(same, 'a', day(2025, 6, 2), day(2025, 6, 8), (d) => d.getDay() !== 0);
    fill(same, 'a', day(2025, 6, 9), day(2025, 6, 15), (d) => d.getDay() !== 0);
    expect(summarize([habit('a')], same, WEEK_PAST).sentences[0]).toBe(
      'Nessa semana você concluiu 86% dos hábitos, o mesmo que na semana anterior.'
    );
  });

  it('sem semana anterior com dados, só informa a taxa', () => {
    const young = [habit('a', { createdAt: new Date(2025, 5, 9).getTime() })]; // criado na segunda 9/6
    const logs = fill({}, 'a', day(2025, 6, 9), day(2025, 6, 15), (d) => d.getDate() <= 12);
    const s = summarize(young, logs, WEEK_PAST);
    expect(s.previousRate).toBeNull();
    expect(s.sentences[0]).toBe('Nessa semana você concluiu 57% dos hábitos.'); // 4 de 7
  });

  it('semana em andamento: só dias encerrados, comparando com o mesmo período da anterior', () => {
    const logs: LogsMap = {};
    fill(logs, 'a', day(2025, 6, 9), day(2025, 6, 15)); // semana anterior (9 a 15/6): tudo
    fill(logs, 'b', day(2025, 6, 9), day(2025, 6, 15));
    fill(logs, 'a', day(2025, 6, 16), day(2025, 6, 17)); // seg e ter
    fill(logs, 'b', day(2025, 6, 16), day(2025, 6, 16)); // só seg
    fill(logs, 'a', day(2025, 6, 18), day(2025, 6, 18)); // hoje (quarta) fica de fora
    const s = summarize(habits, logs, WEEK_CURRENT);
    expect(s.isCurrentWeek).toBe(true);
    expect(s.rate).toBe(75); // 3 de 4
    expect(s.sentences[0]).toBe(
      'Nesta semana, até ontem, você concluiu 75% dos hábitos, 25 pontos a menos que no mesmo período da semana anterior.'
    );
  });
});

describe('frase 2: dia da semana mais consistente', () => {
  const habits = [habit('a'), habit('b')];
  const FROM = day(2025, 4, 21); // 8 semanas até 15/06
  const TO = day(2025, 6, 15);
  const weekIndex = (d: Date) => Math.floor((d.getTime() - FROM.getTime()) / (7 * 86_400_000));

  /** Dias em `always` sempre feitos; nos demais, só em semanas pares (50%) */
  const logsWith = (always: number[]) => {
    const logs: LogsMap = {};
    for (const id of ['a', 'b']) {
      fill(logs, id, FROM, TO, (d) => always.includes(d.getDay()) || weekIndex(d) % 2 === 0);
    }
    return logs;
  };
  const phrase = (s: ReturnType<typeof summarize>) => s.sentences.find((x) => x.includes('mais consistente'));

  it('aponta o dia mais forte do histórico de 8 semanas', () => {
    const s = summarize(habits, logsWith([2]), WEEK_PAST); // terças sempre
    expect(phrase(s)).toBe('Você costuma ser mais consistente às terças (100% nas últimas 8 semanas).');
  });

  it('empate entre dois dias cita os dois (segunda a domingo)', () => {
    const s = summarize(habits, logsWith([4, 2]), WEEK_PAST); // terças e quintas
    expect(phrase(s)).toBe('Você costuma ser mais consistente às terças e quintas (100% nas últimas 8 semanas).');
  });

  it('domingo e sábado usam "aos"; o artigo só se repete quando muda', () => {
    expect(phrase(summarize(habits, logsWith([6]), WEEK_PAST))).toContain('aos sábados');
    expect(phrase(summarize(habits, logsWith([0]), WEEK_PAST))).toContain('aos domingos');
    expect(phrase(summarize(habits, logsWith([5, 6]), WEEK_PAST))).toContain('às sextas e aos sábados');
    expect(phrase(summarize(habits, logsWith([6, 0]), WEEK_PAST))).toContain('aos sábados e domingos');
  });

  it('não destaca quando 3 ou mais dias dividem o topo, nem quando todos empatam', () => {
    expect(phrase(summarize(habits, logsWith([2, 4, 6]), WEEK_PAST))).toBeUndefined();
    expect(phrase(summarize(habits, logsWith([0, 1, 2, 3, 4, 5, 6]), WEEK_PAST))).toBeUndefined();
  });

  it('exige amostra mínima por dia da semana (poucos dados não geram padrão)', () => {
    const fresh = [habit('a', { createdAt: new Date(2025, 5, 1).getTime() })]; // só ~2 semanas
    const logs = fill({}, 'a', day(2025, 6, 1), day(2025, 6, 15), (d) => d.getDay() === 2);
    expect(phrase(summarize(fresh, logs, WEEK_PAST))).toBeUndefined();
  });
});

describe('frase 3: hábito mais fraco', () => {
  const START = day(2025, 5, 5); // segunda; 6 semanas de dados até 15/06
  const END = day(2025, 6, 15);
  const created = new Date(2025, 4, 5).getTime();
  const weak = (over: Partial<Habit> = {}) => [
    habit('ler', { title: 'Ler', createdAt: created }),
    habit('treinar', { title: 'Treinar', createdAt: created, ...over })
  ];
  const logs = () => {
    const l: LogsMap = {};
    fill(l, 'ler', START, END, (d) => d.getDate() % 10 !== 0); // quase sempre
    fill(l, 'treinar', START, END, (d) => d.getDay() === 1); // só às segundas (6 de 42)
    return l;
  };
  const weakest = (s: ReturnType<typeof summarize>) => s.sentences.find((x) => x.includes('mais fraco'));

  it('cita o hábito mais fraco com a taxa', () => {
    expect(weakest(summarize(weak(), logs(), WEEK_PAST))).toBe('Seu hábito mais fraco é Treinar (14%).');
  });

  it('respeita hideTitle usando "um hábito oculto"', () => {
    expect(weakest(summarize(weak({ hideTitle: true }), logs(), WEEK_PAST))).toBe(
      'Seu hábito mais fraco é um hábito oculto (14%).'
    );
  });

  it('empate entre dois hábitos cita os dois; entre três não destaca', () => {
    const habits = [
      habit('a', { title: 'Alpha', createdAt: created }),
      habit('b', { title: 'Beta', createdAt: created }),
      habit('c', { title: 'Gama', createdAt: created })
    ];
    const l: LogsMap = {};
    fill(l, 'a', START, END); // 100%
    fill(l, 'b', START, END, (d) => d.getDay() % 2 === 0);
    fill(l, 'c', START, END, (d) => d.getDay() % 2 === 0);
    expect(weakest(summarize(habits, l, WEEK_PAST))).toMatch(/^Seus hábitos mais fracos são Beta e Gama \(\d+%\)\.$/);
    const hiddenTie = habits.map((h) => (h.id === 'a' ? h : { ...h, hideTitle: true }));
    expect(weakest(summarize(hiddenTie, l, WEEK_PAST))).toMatch(/^Seus hábitos mais fracos são dois hábitos ocultos/);

    const threeWay = [...habits];
    const l3: LogsMap = {};
    for (const id of ['a', 'b', 'c']) fill(l3, id, START, END, (d) => d.getDay() % 2 === 0);
    expect(weakest(summarize(threeWay, l3, WEEK_PAST))).toBeUndefined();
  });

  it('só com 2 ou mais hábitos comparáveis; hábito com menos de 2 semanas de dados não conta', () => {
    expect(weakest(summarize([weak()[1]], logs(), WEEK_PAST))).toBeUndefined(); // um só
    const newcomer = [weak()[0], habit('novo', { title: 'Novo', createdAt: new Date(2025, 5, 12).getTime() })];
    expect(weakest(summarize(newcomer, logs(), WEEK_PAST))).toBeUndefined(); // "Novo" tem só alguns dias
  });

  it('não aponta quando todos os hábitos estão em 100%', () => {
    const l: LogsMap = {};
    fill(l, 'ler', START, END);
    fill(l, 'treinar', START, END);
    expect(weakest(summarize(weak(), l, WEEK_PAST))).toBeUndefined();
  });
});

describe('poucos dados, sem hábitos e semanas sem agenda', () => {
  it('sem hábitos ativos', () => {
    const s = summarize([], {}, WEEK_PAST);
    expect(s.sentences).toEqual([NO_HABITS_MESSAGE]);
    expect(s.hasData).toBe(false);
    expect(summarize([habit('a', { archived: true })], {}, WEEK_PAST).sentences).toEqual([NO_HABITS_MESSAGE]);
  });

  it('semana anterior à criação dos hábitos: mensagem neutra', () => {
    const habits = [habit('a', { createdAt: new Date(2025, 5, 10).getTime() })];
    const s = summarize(habits, {}, WEEK_BEFORE);
    expect(s.sentences).toEqual([NO_DATA_MESSAGE]);
    expect(s.rate).toBeNull();
    expect(s.hasData).toBe(false);
  });

  it('segunda-feira (nenhum dia encerrado na semana) e hábito novo: mensagem neutra', () => {
    const monday = new Date(2025, 5, 16, 9);
    const habits = [habit('a', { createdAt: new Date(2025, 5, 14).getTime() })];
    const s = summarize(habits, {}, WEEK_CURRENT, {}, monday);
    expect(s.sentences).toEqual([NO_DATA_MESSAGE]);
  });

  it('semana futura', () => {
    expect(summarize([habit('a')], {}, '2025-06-23').sentences).toEqual([NO_DATA_MESSAGE]);
  });

  it('hábito arquivado não pesa na taxa', () => {
    const habits = [habit('a'), habit('velho', { archived: true })];
    const logs = fill({}, 'a', day(2025, 6, 9), day(2025, 6, 15));
    expect(summarize(habits, logs, WEEK_PAST).rate).toBe(100);
  });

  it('hábitos criados depois de um dia não são cobrados por ele', () => {
    const habits = [habit('a', { createdAt: new Date(2025, 5, 12).getTime() })]; // quinta
    const logs = fill({}, 'a', day(2025, 6, 12), day(2025, 6, 15));
    expect(summarize(habits, logs, WEEK_PAST).rate).toBe(100); // só quinta a domingo contam
  });
});

describe('semânticas de meta semanal e hábito a evitar', () => {
  it('meta semanal: a semana encerrada é sucesso ou falha', () => {
    const weekly = habit('w', { weeklyTarget: 3, weeklyTargetFrom: '2025-04-07', weeklyTargets: [{ from: '2025-04-07', target: 3 }] });
    const met = fill({}, 'w', day(2025, 6, 9), day(2025, 6, 11)); // 3 dias
    fill(met, 'w', day(2025, 6, 2), day(2025, 6, 4));
    const ok = summarize([weekly], met, WEEK_PAST);
    expect(ok.rate).toBe(100);
    expect(ok.sentences[0]).toBe('Nessa semana você concluiu 100% dos hábitos, o mesmo que na semana anterior.');

    const missed = fill({}, 'w', day(2025, 6, 9), day(2025, 6, 10)); // 2 de 3
    expect(summarize([weekly], missed, WEEK_PAST).rate).toBe(0);
  });

  it('hábito a evitar: dia limpo é sucesso e o escorregão é falha', () => {
    const avoid = habit('x', { kind: 'avoid' });
    const s = summarize([avoid], {}, WEEK_PAST, { [WEEK_PAST.replace('09', '11')]: ['x'] });
    expect(s.rate).toBe(86); // 6 de 7
  });

  it('mistura fixos, semanal e a evitar na mesma taxa', () => {
    const weekly = habit('w', { weeklyTarget: 1, weeklyTargetFrom: '2025-04-07', weeklyTargets: [{ from: '2025-04-07', target: 1 }] });
    const habits = [habit('a'), habit('x', { kind: 'avoid' }), weekly];
    const logs = fill({}, 'a', day(2025, 6, 9), day(2025, 6, 15)); // a: 7/7
    fill(logs, 'w', day(2025, 6, 9), day(2025, 6, 9)); // w: meta 1 cumprida
    expect(summarize(habits, logs, WEEK_PAST).rate).toBe(100); // 7 + 7 + 1 de 15
  });
});

describe('quantidade e ordem das frases', () => {
  it('no máximo 3 frases: taxa, dia consistente, hábito mais fraco', () => {
    const created = new Date(2025, 3, 21).getTime();
    const habits = [
      habit('a', { title: 'Alpha', createdAt: created }),
      habit('b', { title: 'Beta', createdAt: created })
    ];
    const logs: LogsMap = {};
    const FROM = day(2025, 4, 21);
    const TO = day(2025, 6, 15);
    fill(logs, 'a', FROM, TO); // 100%
    fill(logs, 'b', FROM, TO, (d) => d.getDay() === 2 || d.getDate() % 3 === 0);
    const s = summarize(habits, logs, WEEK_PAST);
    expect(s.sentences.length).toBeLessThanOrEqual(3);
    expect(s.sentences[0]).toMatch(/^Nessa semana você concluiu/);
    expect(s.sentences[1]).toMatch(/^Você costuma ser mais consistente/);
    expect(s.sentences[2]).toMatch(/^Seu hábito mais fraco é Beta/);
  });
});

describe('rótulo da semana e lembrete', () => {
  it('formata o intervalo da semana', () => {
    expect(weekRangeLabel('2025-06-09')).toBe('9 Jun – 15 Jun');
    expect(weekRangeLabel('2025-06-30')).toBe('30 Jun – 6 Jul');
  });

  it('configuração do resumo no lembrete: padrão desligado', () => {
    expect(DEFAULT_SETTINGS.weeklySummaryInReminder).toBe(false);
    expect(sanitizeSettings({ weeklySummaryInReminder: true }).weeklySummaryInReminder).toBe(true);
    expect(sanitizeSettings({ weeklySummaryInReminder: 'sim' }).weeklySummaryInReminder).toBe(false);
  });

  it('shouldSendReminder: sem pendentes só envia quando permitido (resumo de domingo)', () => {
    const base = {
      now: new Date(2025, 5, 15, 20, 30),
      time: '20:00',
      lastSentKey: null,
      todayKey: '2025-06-15',
      pendingCount: 0
    };
    expect(shouldSendReminder(base)).toBe(false);
    expect(shouldSendReminder({ ...base, allowEmpty: true })).toBe(true);
    expect(shouldSendReminder({ ...base, allowEmpty: true, lastSentKey: '2025-06-15' })).toBe(false);
  });
});
