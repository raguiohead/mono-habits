import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart2, Flame, Target, Award, Calendar, ChevronLeft, ChevronRight, Share2, Sparkles } from 'lucide-react';
import { useHabits } from '@/context/HabitsContext';
import { useDiscreet } from '@/context/SettingsContext';
import { ShareModal, type ShareCardOption } from './ShareModal';
import { buildWrappedCards, buildWrappedStats, dataSpanDays, isWrappedAvailable, toGridDays, wrappedPeriod } from '@/lib/shareImage';
import {
  generateHeatmapDays,
  calculateRetentionRate,
  getBestStreak,
  getBestCurrentStreak,
  getWeeklyStreakSummary,
  getHeatmapCellClass,
  aggregateBuckets,
  getBucketSize,
  countPerfectDays,
  type GraphBucket
} from '@/lib/analytics';
import { formatFriendlyDate, MONTHS_SHORT, parseDateKey } from '@/lib/dateUtils';
import { type HeatmapDay, type GraphRange } from '@/types/habit';
import { buildWeeklySummary, weekRangeLabel } from '@/lib/weeklySummary';
import { previousWeekKey, weekStart, weekStartKey } from '@/lib/weekly';

const RANGES: { value: GraphRange; label: string; long: string }[] = [
  { value: 7, label: 'Semana', long: 'Última semana' },
  { value: 15, label: '15d', long: 'Últimos 15 dias' },
  { value: 30, label: '30d', long: 'Últimos 30 dias' },
  { value: 90, label: '90d', long: 'Últimos 90 dias' },
  { value: 365, label: '365d', long: 'Último ano' }
];

const RANGE_STORAGE_KEY = 'mono_habits_graph_range_v1';
const WEEKDAY_HEADERS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

function loadRange(): GraphRange {
  try {
    const v = Number(localStorage.getItem(RANGE_STORAGE_KEY));
    return RANGES.some((r) => r.value === v) ? (v as GraphRange) : 30;
  } catch {
    return 30;
  }
}

/** Índice da linha com Segunda = 0 ... Domingo = 6 */
const mondayIndex = (d: Date) => (d.getDay() + 6) % 7;

/** Divide os dias em semanas completas (Seg–Dom), preenchendo com null onde não há dado */
function toWeeks(days: HeatmapDay[]): (HeatmapDay | null)[][] {
  if (days.length === 0) return [];
  const padded: (HeatmapDay | null)[] = [
    ...Array<null>(mondayIndex(days[0].date)).fill(null),
    ...days
  ];
  while (padded.length % 7 !== 0) padded.push(null);
  const weeks: (HeatmapDay | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));
  return weeks;
}

function bucketLabel(bucket: GraphBucket, index: number, total: number, range: GraphRange): string {
  const d = parseDateKey(bucket.startKey);
  if (range <= 15) return String(d.getDate());
  if (range === 30) return (total - 1 - index) % 5 === 0 ? String(d.getDate()) : '';
  if (range === 90) return (total - 1 - index) % 2 === 0 ? `${d.getDate()}/${d.getMonth() + 1}` : '';
  return (total - 1 - index) % 2 === 0 ? MONTHS_SHORT[d.getMonth()] : '';
}

export const ConsistencyView: React.FC = () => {
  const { activeHabits, logs, graces, slips, pomoSessions, darkMode, setSelectedDateKey, setActiveTab } = useHabits();
  const { active: discreet } = useDiscreet();
  const [shareMode, setShareMode] = useState<'grid' | 'wrapped' | null>(null);
  const [range, setRange] = useState<GraphRange>(() => loadRange());
  const [selectedCell, setSelectedCell] = useState<HeatmapDay | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const today = useMemo(() => new Date(), []);

  // Resumo da semana: 0 = semana atual; valores negativos navegam para semanas anteriores
  const [summaryOffset, setSummaryOffset] = useState(0);
  const currentWeekKey = useMemo(() => weekStartKey(today), [today]);
  const summaryWeekKey = useMemo(() => {
    let key = currentWeekKey;
    for (let i = 0; i < -summaryOffset; i++) key = previousWeekKey(key);
    return key;
  }, [currentWeekKey, summaryOffset]);
  // Não há o que mostrar antes da semana do primeiro hábito
  const firstWeekKey = useMemo(() => {
    const created = activeHabits.map((h) => (h.createdAt > 0 ? weekStartKey(new Date(h.createdAt)) : currentWeekKey));
    return created.length > 0 ? created.reduce((a, b) => (a < b ? a : b)) : currentWeekKey;
  }, [activeHabits, currentWeekKey]);
  const summary = useMemo(
    () => buildWeeklySummary(activeHabits, logs, weekStart(parseDateKey(summaryWeekKey)), { slips, today, discreet }),
    [activeHabits, logs, slips, summaryWeekKey, today, discreet]
  );
  const rangeInfo = RANGES.find((r) => r.value === range)!;

  const changeRange = (value: GraphRange) => {
    setRange(value);
    setSelectedCell(null);
    try {
      localStorage.setItem(RANGE_STORAGE_KEY, String(value));
    } catch {
      /* armazenamento indisponível */
    }
  };

  const days = useMemo(
    () => generateHeatmapDays(activeHabits, logs, today, range, graces, slips),
    [activeHabits, logs, today, range, graces, slips]
  );

  const periodRate = useMemo(() => calculateRetentionRate(days, range), [days, range]);
  const perfectDays = useMemo(() => countPerfectDays(days), [days]);
  const bestStreak = useMemo(
    () => getBestStreak(activeHabits, logs, today, graces, slips),
    [activeHabits, logs, today, graces, slips]
  );
  const weeklySummary = useMemo(
    () => getWeeklyStreakSummary(activeHabits, logs, today, graces),
    [activeHabits, logs, today, graces]
  );
  const currentBestStreak = useMemo(
    () => getBestCurrentStreak(activeHabits, logs, today, graces, slips),
    [activeHabits, logs, today, graces, slips]
  );

  // Compartilhar: cartão da grade do período escolhido (sem nomes de hábitos)
  const theme = darkMode ? 'dark' : 'light';
  const gridOptions = useMemo<ShareCardOption[]>(
    () => [
      {
        label: rangeInfo.long,
        filename: `mono-habits-${range}d.png`,
        build: (habitCount) => ({
          kind: 'grid',
          theme,
          title: rangeInfo.long,
          days: toGridDays(days),
          rate: periodRate,
          bestStreak,
          ...(habitCount !== undefined ? { habitCount } : {})
        })
      }
    ],
    [rangeInfo.long, range, theme, days, periodRate, bestStreak]
  );

  // Wrapped: em dezembro ou com 60+ dias de dados
  const wrappedAvailable = useMemo(
    () => isWrappedAvailable(today, dataSpanDays(activeHabits, logs, today)),
    [activeHabits, logs, today]
  );
  const wrappedOptions = useMemo<ShareCardOption[]>(() => {
    if (shareMode !== 'wrapped') return [];
    const period = wrappedPeriod(today);
    // Só os dias com dados: antes do primeiro hábito não há o que contar
    const spanDays = Math.min(period.days, dataSpanDays(activeHabits, logs, today) + 1);
    const yearDays = generateHeatmapDays(activeHabits, logs, today, spanDays, graces, slips);
    const stats = buildWrappedStats(yearDays, pomoSessions, bestStreak);
    const rate = calculateRetentionRate(yearDays, spanDays);
    // Fora de dezembro o rótulo diz quantos dias de dados de fato entraram
    const periodLabel = today.getMonth() === 11 || spanDays >= 365 ? period.label : `Últimos ${spanDays} dias`;
    const labels = ['Ano', 'Números', 'Dia forte'];
    return labels.map((label, i) => ({
      label,
      filename: `mono-habits-wrapped-${i + 1}.png`,
      build: (habitCount: number | undefined) => buildWrappedCards(theme, periodLabel, yearDays, rate, stats, habitCount)[i]
    }));
  }, [shareMode, today, activeHabits, logs, graces, slips, pomoSessions, bestStreak, theme]);

  const buckets = useMemo(() => aggregateBuckets(days, getBucketSize(range)), [days, range]);
  const weeks = useMemo(() => toWeeks(days), [days]);

  // Calendário (linhas = semanas) para períodos curtos; estilo "GitHub" (colunas = semanas) para longos
  const isCalendar = range <= 30;
  const cellSize = range === 365 ? 'w-2.5 h-2.5' : 'w-4 h-4';

  // Períodos longos abrem rolados até os dias mais recentes
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [range, isCalendar]);

  const openDay = (day: HeatmapDay) => {
    setSelectedDateKey(day.key);
    setActiveTab('today');
  };

  const renderCell = (day: HeatmapDay | null, key: string) => {
    if (!day) return <span key={key} className={isCalendar ? 'w-full aspect-square' : cellSize} />;
    const isSelected = selectedCell?.key === day.key;
    const cellDescription = `${formatFriendlyDate(day.key)}: ${day.completedCount}/${day.scheduledCount} (${Math.round(day.ratio * 100)}%)${day.gracedCount ? ` · ${day.gracedCount} dia(s) de graça` : ''}`;
    return (
      <button
        type="button"
        key={key}
        onClick={() => setSelectedCell(day)}
        onDoubleClick={() => openDay(day)}
        className={`${
          isCalendar
            ? 'w-full aspect-square text-[10px] font-mono flex items-center justify-center rounded-md'
            : `${cellSize} rounded-xs`
        } border transition-all ${getHeatmapCellClass(day.ratio, darkMode)} ${
          // Dia de graça: borda tracejada (não é um dia concluído)
          day.gracedCount ? `${range > 90 ? 'border' : 'border-2'} !border-dashed !border-zinc-500` : ''
        } ${isSelected ? 'ring-2 ring-zinc-500 scale-110 z-10' : ''}`}
        title={cellDescription}
        aria-label={cellDescription}
      >
        {isCalendar && (
          <span className={day.ratio >= 0.7 ? (darkMode ? 'text-zinc-900' : 'text-zinc-100') : 'text-zinc-500'}>
            {day.date.getDate()}
          </span>
        )}
      </button>
    );
  };

  // Rótulos de mês no modo colunas
  const monthLabels = useMemo(() => {
    if (isCalendar) return [];
    let last = -1;
    return weeks.map((week) => {
      const first = week.find(Boolean);
      const month = first ? first.date.getMonth() : last;
      const label = month !== last ? MONTHS_SHORT[month] : '';
      last = month;
      return label;
    });
  }, [weeks, isCalendar]);

  return (
    <div className="space-y-6">
      {/* Resumo da semana: texto curto com regras determinísticas */}
      <section
        aria-label="Resumo da semana"
        className="p-4 sm:p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-xs space-y-3"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Resumo da semana</h3>
            <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
              {weekRangeLabel(summaryWeekKey)}
              {summaryWeekKey === currentWeekKey ? ' · esta semana' : ''}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSummaryOffset((o) => o - 1)}
              disabled={summaryWeekKey <= firstWeekKey}
              aria-label="Semana anterior"
              className="w-11 h-11 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setSummaryOffset((o) => Math.min(0, o + 1))}
              disabled={summaryOffset >= 0}
              aria-label="Próxima semana"
              className="w-11 h-11 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="space-y-2" aria-live="polite">
          {summary.sentences.map((sentence, i) => (
            <p
              key={i}
              className={`text-xs leading-relaxed ${
                summary.hasData ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-500 dark:text-zinc-400'
              }`}
            >
              {sentence}
            </p>
          ))}
        </div>
      </section>

      {/* Seletor de Período */}
      <div
        className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800 text-xs font-medium"
        role="tablist"
        aria-label="Período do gráfico"
      >
        {RANGES.map((r) => (
          <button
            key={r.value}
            type="button"
            role="tab"
            aria-selected={range === r.value}
            onClick={() => changeRange(r.value)}
            className={`flex-1 py-2 px-2 rounded-lg transition-all text-center ${
              range === r.value
                ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-xs font-semibold'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-xs">
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
            <Target className="w-4 h-4" />
            <span className="text-[11px] font-mono uppercase tracking-wider">No período</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-mono mt-2">{periodRate}%</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Taxa de conclusão</p>
        </div>

        <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-xs">
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
            <BarChart2 className="w-4 h-4" />
            <span className="text-[11px] font-mono uppercase tracking-wider">Dias perfeitos</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-mono mt-2">{perfectDays}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">de {range} dias</p>
        </div>

        <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-xs">
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
            <Flame className="w-4 h-4" />
            <span className="text-[11px] font-mono uppercase tracking-wider">Maior Streak</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-mono mt-2">{bestStreak} dias</p>
          <p className="text-[11px] text-zinc-500 mt-0.5 font-mono">atual: {currentBestStreak}</p>
          {weeklySummary.count > 0 && (
            <p className="text-[11px] text-zinc-500 mt-0.5 font-mono">
              semanal: {weeklySummary.best} {weeklySummary.best === 1 ? 'semana' : 'semanas'}
            </p>
          )}
          {currentBestStreak === 0 && bestStreak > 0 && (
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 leading-snug">
              Sua melhor continua em {bestStreak} {bestStreak === 1 ? 'dia' : 'dias'}.
            </p>
          )}
        </div>

        <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-xs">
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
            <Award className="w-4 h-4" />
            <span className="text-[11px] font-mono uppercase tracking-wider">Hábitos</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-mono mt-2">{activeHabits.length}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Rotinas ativas</p>
        </div>
      </div>

      {/* Gráfico de Barras */}
      <div className="p-4 sm:p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Evolução · {rangeInfo.long}</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {getBucketSize(range) === 1
              ? 'Taxa de conclusão por dia.'
              : getBucketSize(range) === 7
              ? 'Taxa de conclusão média por semana.'
              : 'Taxa de conclusão média por bloco de 30 dias.'}
          </p>
        </div>

        <div className="flex items-end gap-1 h-32" role="img" aria-label={`Gráfico de ${rangeInfo.long}`}>
          {buckets.map((b) => (
            <div
              key={b.key}
              className="flex-1 min-w-0 h-full flex items-end"
              title={`${formatFriendlyDate(b.startKey)}${b.startKey !== b.endKey ? ` → ${formatFriendlyDate(b.endKey)}` : ''}: ${b.completedCount}/${b.scheduledCount} (${Math.round(b.ratio * 100)}%)`}
            >
              <div
                className="w-full rounded-t-sm bg-zinc-950 dark:bg-zinc-50 transition-all"
                style={{ height: `${Math.max(b.ratio * 100, b.scheduledCount > 0 ? 3 : 1)}%`, opacity: b.scheduledCount > 0 ? 1 : 0.15 }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-1 -mt-2 text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
          {buckets.map((b, i) => (
            <span key={b.key} className="flex-1 min-w-0 text-center truncate overflow-visible">
              {bucketLabel(b, i, buckets.length, range)}
            </span>
          ))}
        </div>
      </div>

      {/* Mapa de Calor */}
      <div className="p-4 sm:p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Grade de Consistência</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              A intensidade monocromática reflete sua taxa de conclusão diária.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShareMode('grid')}
            className="min-h-[44px] px-3 flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-50"
          >
            <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
            Compartilhar
          </button>

          {/* Legenda Monocromática */}
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
            <span>Menos</span>
            <span className="w-2.5 h-2.5 rounded-xs border border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900" />
            <span className="w-2.5 h-2.5 rounded-xs border border-zinc-400 dark:border-zinc-700 bg-zinc-300 dark:bg-zinc-700" />
            <span className="w-2.5 h-2.5 rounded-xs border border-zinc-500 dark:border-zinc-500 bg-zinc-500 dark:bg-zinc-500" />
            <span className="w-2.5 h-2.5 rounded-xs border border-zinc-700 dark:border-zinc-300 bg-zinc-700 dark:bg-zinc-300" />
            <span className="w-2.5 h-2.5 rounded-xs border border-zinc-950 dark:border-white bg-zinc-950 dark:bg-white" />
            <span>Mais</span>
            <span className="ml-2 w-2.5 h-2.5 rounded-xs border border-dashed border-zinc-500" aria-hidden="true" />
            <span>Graça</span>
          </div>
        </div>

        {isCalendar ? (
          <div className="space-y-1.5">
            <div className="grid grid-cols-7 gap-1.5 text-[10px] font-mono text-zinc-500 text-center">
              {WEEKDAY_HEADERS.map((h, i) => (
                <span key={i}>{h}</span>
              ))}
            </div>
            {weeks.map((week, wIdx) => (
              <div key={wIdx} className="grid grid-cols-7 gap-1.5">
                {week.map((day, dIdx) => renderCell(day, `${wIdx}-${dIdx}`))}
              </div>
            ))}
          </div>
        ) : (
          <div ref={scrollRef} className="overflow-x-auto pb-2 -mx-2 px-2">
            <div className="inline-flex flex-col gap-1.5 min-w-full">
              <div className={`flex ${range === 365 ? 'gap-1' : 'gap-1.5'} text-[9px] font-mono text-zinc-500 h-3`}>
                {monthLabels.map((label, i) => (
                  <span key={i} className={`${cellSize.split(' ')[0]} overflow-visible whitespace-nowrap`}>
                    {label}
                  </span>
                ))}
              </div>
              <div className={`flex ${range === 365 ? 'gap-1' : 'gap-1.5'} justify-between`}>
                {weeks.map((week, wIdx) => (
                  <div key={wIdx} className={`flex flex-col ${range === 365 ? 'gap-1' : 'gap-1.5'}`}>
                    {week.map((day, dIdx) => renderCell(day, `${wIdx}-${dIdx}`))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Detalhes da Célula Selecionada */}
        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-3 text-xs font-mono text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-2 min-w-0">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>
              {selectedCell
                ? `${formatFriendlyDate(selectedCell.key)} — ${selectedCell.completedCount} de ${selectedCell.scheduledCount} concluídos (${Math.round(selectedCell.ratio * 100)}%)${selectedCell.gracedCount ? ` · ${selectedCell.gracedCount} de graça` : ''}`
                : 'Toque em uma célula para inspecionar'}
            </span>
          </div>
          {selectedCell && (
            <button
              onClick={() => openDay(selectedCell)}
              className="underline shrink-0 hover:text-zinc-950 dark:hover:text-zinc-100"
            >
              Abrir dia
            </button>
          )}
        </div>
      </div>

      {wrappedAvailable && (
        <section
          aria-label="Seu ano"
          className="p-4 sm:p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-xs flex items-center justify-between gap-3"
        >
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Seu ano em hábitos</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              3 cartões para compartilhar: grade, números e seu dia mais forte.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShareMode('wrapped')}
            className="min-h-[44px] px-3 shrink-0 flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-50"
          >
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            Ver
          </button>
        </section>
      )}

      {shareMode === 'grid' && (
        <ShareModal title="Compartilhar grade" options={gridOptions} habitCount={activeHabits.length} onClose={() => setShareMode(null)} />
      )}
      {shareMode === 'wrapped' && wrappedOptions.length > 0 && (
        <ShareModal title="Seu ano em hábitos" options={wrappedOptions} habitCount={activeHabits.length} onClose={() => setShareMode(null)} />
      )}
    </div>
  );
};
