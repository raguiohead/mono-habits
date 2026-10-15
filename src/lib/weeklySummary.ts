import { type Habit, type LogsMap, type SlipsMap } from '@/types/habit';
import { addDays, MONTHS_SHORT, parseDateKey, toDateKey } from './dateUtils';
import { isAvoid, isAvoidScheduled, isSlipped } from './avoid';
import { isWeeklyOn, previousWeekKey, weekDayKeys, weekOutcome, weekStartKey } from './weekly';

/**
 * Resumo semanal em texto curto, com regras determinísticas (sem IA externa).
 * Semânticas consideradas, as mesmas do Grafo:
 * - hábitos de dias fixos: concluídos pelos check-ins; dia de graça NÃO conta como concluído;
 * - hábitos com meta semanal: a semana encerrada é um sucesso ou uma falha;
 * - hábitos a evitar: o dia limpo (sem escorregão) é sucesso;
 * - só dias já encerrados entram (hoje fica de fora) e só a partir da criação do hábito.
 */

/** Semanas de histórico usadas nos padrões (a semana escolhida + as 7 anteriores) */
export const HISTORY_WEEKS = 8;
/** Amostra mínima de hábito-dias agendados por dia da semana para apontar o mais consistente */
export const MIN_WEEKDAY_SAMPLE = 4;
/** Semanas de dados que um hábito precisa ter para ser apontado como o mais fraco */
export const MIN_HABIT_WEEKS = 2;
/** Mínimo de hábito-dias agendados para o hábito entrar no "mais fraco" */
export const MIN_HABIT_DAYS = 2;

export interface WeeklySummary {
  weekKey: string;
  isCurrentWeek: boolean;
  /** Taxa da semana (0-100) ou null sem dados */
  rate: number | null;
  /** Taxa da semana anterior (mesmo período, se a semana atual estiver em andamento) */
  previousRate: number | null;
  /** Até 3 frases em pt-BR; uma mensagem neutra quando não há dados */
  sentences: string[];
  hasData: boolean;
}

export interface WeeklySummaryOptions {
  slips?: SlipsMap;
  /** Hoje (padrão: agora). Hoje não entra nas contas: só dias encerrados */
  today?: Date;
}

// Dia da semana no plural, com o artigo: "às terças", "aos sábados"
const WEEKDAY_PLURAL = ['domingos', 'segundas', 'terças', 'quartas', 'quintas', 'sextas', 'sábados'];
const WEEKDAY_ARTICLE = ['aos', 'às', 'às', 'às', 'às', 'às', 'aos'];

/** "às terças e quintas" (artigo repetido só quando muda: "às sextas e aos sábados") */
function weekdayPhrase(days: number[]): string {
  return days
    .map((day, i) =>
      i > 0 && WEEKDAY_ARTICLE[days[i - 1]] === WEEKDAY_ARTICLE[day]
        ? WEEKDAY_PLURAL[day]
        : `${WEEKDAY_ARTICLE[day]} ${WEEKDAY_PLURAL[day]}`
    )
    .join(' e ');
}

export const NO_HABITS_MESSAGE = 'Você ainda não tem hábitos ativos. Crie um hábito para ver o resumo da semana.';
export const NO_DATA_MESSAGE = 'Ainda não há dados suficientes para resumir esta semana. Continue registrando seus hábitos.';

type Outcome = { scheduled: boolean; done: boolean };

/** Resultado de um hábito de dias fixos (ou a evitar) num dia; null se não conta nesse dia */
function fixedDayOutcome(habit: Habit, date: Date, logs: LogsMap, slips: SlipsMap): Outcome | null {
  if (habit.archived) return null;
  const key = toDateKey(date);
  if (isAvoid(habit)) {
    return isAvoidScheduled(habit, date) ? { scheduled: true, done: !isSlipped(slips, key, habit.id) } : null;
  }
  if (isWeeklyOn(habit, date)) return null; // meta semanal: conta por semana
  if (!(habit.frequency || []).includes(date.getDay())) return null;
  if (habit.createdAt && habit.createdAt > 0 && key < toDateKey(new Date(habit.createdAt))) return null;
  return { scheduled: true, done: (logs[key] || []).includes(habit.id) };
}

interface Tally {
  scheduled: number;
  done: number;
}

/** Soma os dias fixos de [from, to] (inclusive) e, se `weekKey` for dado, as semanas semanais encerradas */
function tallyRange(
  habits: Habit[],
  from: Date,
  to: Date,
  logs: LogsMap,
  slips: SlipsMap,
  weekKey: string | null,
  today: Date
): Tally {
  const tally: Tally = { scheduled: 0, done: 0 };
  for (let d = from; d.getTime() <= to.getTime(); d = addDays(d, 1)) {
    for (const h of habits) {
      const o = fixedDayOutcome(h, d, logs, slips);
      if (!o) continue;
      tally.scheduled += 1;
      if (o.done) tally.done += 1;
    }
  }
  if (weekKey) {
    for (const h of habits) {
      const o = weekOutcome(h, weekKey, logs, today);
      if (!o) continue;
      tally.scheduled += 1;
      if (o.met) tally.done += 1;
    }
  }
  return tally;
}

const pct = (t: Tally): number | null => (t.scheduled > 0 ? Math.round((t.done / t.scheduled) * 100) : null);

/** "um hábito oculto" quando o título está oculto (Modo Discreto) */
function habitName(h: Habit): string {
  return h.hideTitle ? 'um hábito oculto' : h.title;
}

function joinNames(habits: Habit[]): string {
  const hidden = habits.filter((h) => h.hideTitle).length;
  if (hidden === habits.length) return hidden === 1 ? 'um hábito oculto' : 'dois hábitos ocultos';
  return habits.map(habitName).join(' e ');
}

/** Frase 1: taxa da semana vs semana anterior */
function rateSentence(rate: number, previous: number | null, isCurrent: boolean): string {
  const lead = isCurrent
    ? `Nesta semana, até ontem, você concluiu ${rate}% dos hábitos`
    : `Nessa semana você concluiu ${rate}% dos hábitos`;
  if (previous === null) return `${lead}.`;
  const compared = isCurrent ? 'no mesmo período da semana anterior' : 'na semana anterior';
  const diff = rate - previous;
  if (diff === 0) return `${lead}, o mesmo que ${compared}.`;
  const points = Math.abs(diff) === 1 ? 'ponto' : 'pontos';
  return `${lead}, ${Math.abs(diff)} ${points} ${diff > 0 ? 'a mais' : 'a menos'} que ${compared}.`;
}

/**
 * Monta o resumo da semana que começa em `weekStart` (segunda-feira; aceita Date ou 'YYYY-MM-DD').
 * Frases (até 3): (1) taxa vs semana anterior; (2) dia da semana mais consistente nas últimas 8 semanas;
 * (3) hábito mais fraco (com >= 2 semanas de dados e >= 2 hábitos comparáveis).
 */
export function buildWeeklySummary(
  habits: Habit[],
  logs: LogsMap,
  weekStart: Date | string,
  options: WeeklySummaryOptions = {}
): WeeklySummary {
  const slips = options.slips ?? {};
  const today = options.today ?? new Date();
  const todayKey = toDateKey(today);
  const monday = parseDateKey(typeof weekStart === 'string' ? weekStart : weekStartKey(weekStart));
  const weekKey = toDateKey(monday);
  const sunday = addDays(monday, 6);
  const isCurrentWeek = weekKey === weekStartKey(today);
  const active = habits.filter((h) => !h.archived);

  const empty = (message: string, rate: number | null = null, previousRate: number | null = null): WeeklySummary => ({
    weekKey,
    isCurrentWeek,
    rate,
    previousRate,
    sentences: [message],
    hasData: false
  });

  if (active.length === 0) return empty(NO_HABITS_MESSAGE);
  if (weekKey > todayKey) return empty(NO_DATA_MESSAGE); // semana futura

  const yesterday = addDays(parseDateKey(todayKey), -1);
  const lastDay = sunday.getTime() < yesterday.getTime() ? sunday : yesterday; // só dias encerrados
  const sentences: string[] = [];

  // ---------- (1) taxa da semana vs semana anterior ----------
  let rate: number | null = null;
  let previousRate: number | null = null;
  if (lastDay.getTime() >= monday.getTime()) {
    const weekEnded = toDateKey(sunday) < todayKey;
    rate = pct(tallyRange(active, monday, lastDay, logs, slips, weekEnded ? weekKey : null, today));

    const prevMonday = addDays(monday, -7);
    const elapsed = Math.round((lastDay.getTime() - monday.getTime()) / 86_400_000); // dias - 1
    const prevLast = addDays(prevMonday, elapsed);
    previousRate = pct(tallyRange(active, prevMonday, prevLast, logs, slips, weekEnded ? previousWeekKey(weekKey) : null, today));
    if (rate !== null) sentences.push(rateSentence(rate, previousRate, isCurrentWeek));
  }

  // ---------- janela de histórico: 8 semanas até o fim da semana (ou até ontem) ----------
  const windowStart = addDays(monday, -7 * (HISTORY_WEEKS - 1));
  const windowDays: Date[] = [];
  for (let d = windowStart; d.getTime() <= lastDay.getTime(); d = addDays(d, 1)) windowDays.push(d);

  // ---------- (2) dia da semana mais consistente ----------
  const byWeekday: Tally[] = Array.from({ length: 7 }, () => ({ scheduled: 0, done: 0 }));
  for (const d of windowDays) {
    for (const h of active) {
      const o = fixedDayOutcome(h, d, logs, slips);
      if (!o) continue;
      byWeekday[d.getDay()].scheduled += 1;
      if (o.done) byWeekday[d.getDay()].done += 1;
    }
  }
  const qualified = byWeekday
    .map((t, day) => ({ day, rate: pct(t), scheduled: t.scheduled }))
    .filter((x): x is { day: number; rate: number; scheduled: number } => x.rate !== null && x.scheduled >= MIN_WEEKDAY_SAMPLE);
  if (qualified.length >= 2) {
    const best = Math.max(...qualified.map((x) => x.rate));
    const worst = Math.min(...qualified.map((x) => x.rate));
    const winners = qualified.filter((x) => x.rate === best);
    // Sem destaque quando todos empatam ou quando 3+ dias dividem o topo
    if (best > worst && winners.length <= 2) {
      // domingo por último, como na semana de segunda a domingo
      const ordered = [...winners].sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7));
      const phrase = weekdayPhrase(ordered.map((w) => w.day));
      sentences.push(`Você costuma ser mais consistente ${phrase} (${best}% nas últimas ${HISTORY_WEEKS} semanas).`);
    }
  }

  // ---------- (3) hábito mais fraco ----------
  const windowWeeks: string[] = [];
  for (let i = 0; i < HISTORY_WEEKS; i++) windowWeeks.push(toDateKey(addDays(windowStart, 7 * i)));
  const stats = active.map((h) => {
    const t: Tally = { scheduled: 0, done: 0 };
    const weeksWithData = new Set<string>();
    for (const d of windowDays) {
      const o = fixedDayOutcome(h, d, logs, slips);
      if (!o) continue;
      t.scheduled += 1;
      if (o.done) t.done += 1;
      weeksWithData.add(weekStartKey(d));
    }
    for (const wk of windowWeeks) {
      const o = weekOutcome(h, wk, logs, today);
      if (!o) continue;
      if (weekDayKeys(wk)[6] > toDateKey(lastDay)) continue; // só semanas encerradas dentro da janela
      t.scheduled += 1;
      if (o.met) t.done += 1;
      weeksWithData.add(wk);
    }
    return { habit: h, rate: pct(t), scheduled: t.scheduled, weeks: weeksWithData.size };
  });
  const candidates = stats.filter(
    (s): s is { habit: Habit; rate: number; scheduled: number; weeks: number } =>
      s.rate !== null && s.weeks >= MIN_HABIT_WEEKS && s.scheduled >= MIN_HABIT_DAYS
  );
  if (candidates.length >= 2) {
    const lowest = Math.min(...candidates.map((c) => c.rate));
    const weakest = candidates.filter((c) => c.rate === lowest);
    if (lowest < 100 && weakest.length <= 2) {
      const names = joinNames(weakest.map((c) => c.habit));
      sentences.push(
        weakest.length === 1
          ? `Seu hábito mais fraco é ${names} (${lowest}%).`
          : `Seus hábitos mais fracos são ${names} (${lowest}%).`
      );
    }
  }

  if (sentences.length === 0) return empty(NO_DATA_MESSAGE, rate, previousRate);
  return { weekKey, isCurrentWeek, rate, previousRate, sentences: sentences.slice(0, 3), hasData: true };
}

/** "12 Out – 18 Out" para o cabeçalho do cartão */
export function weekRangeLabel(weekKey: string): string {
  const monday = parseDateKey(weekKey);
  const sunday = addDays(monday, 6);
  const fmt = (d: Date) => `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  return `${fmt(monday)} – ${fmt(sunday)}`;
}
