import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart2, Flame, Target, Award, Calendar } from 'lucide-react';
import { useHabits } from '@/context/HabitsContext';
import {
  generateHeatmapDays,
  calculateRetentionRate,
  getBestStreak,
  getHeatmapCellClass,
  aggregateBuckets,
  getBucketSize,
  countPerfectDays,
  type GraphBucket
} from '@/lib/analytics';
import { formatFriendlyDate, MONTHS_SHORT, parseDateKey } from '@/lib/dateUtils';
import { type HeatmapDay, type GraphRange } from '@/types/habit';

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
  const { activeHabits, logs, darkMode, setSelectedDateKey, setActiveTab } = useHabits();
  const [range, setRange] = useState<GraphRange>(() => loadRange());
  const [selectedCell, setSelectedCell] = useState<HeatmapDay | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const today = useMemo(() => new Date(), []);
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
    () => generateHeatmapDays(activeHabits, logs, today, range),
    [activeHabits, logs, today, range]
  );

  const periodRate = useMemo(() => calculateRetentionRate(days, range), [days, range]);
  const perfectDays = useMemo(() => countPerfectDays(days), [days]);
  const bestStreak = useMemo(
    () => getBestStreak(activeHabits, logs, today),
    [activeHabits, logs, today]
  );

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
          isSelected ? 'ring-2 ring-zinc-500 scale-110 z-10' : ''
        }`}
        title={`${formatFriendlyDate(day.key)}: ${day.completedCount}/${day.scheduledCount} (${Math.round(day.ratio * 100)}%)`}
        aria-label={day.key}
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
          <p className="text-[11px] text-zinc-500 mt-0.5">Ofensiva ativa</p>
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

          {/* Legenda Monocromática */}
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
            <span>Menos</span>
            <span className="w-2.5 h-2.5 rounded-xs border border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900" />
            <span className="w-2.5 h-2.5 rounded-xs border border-zinc-400 dark:border-zinc-700 bg-zinc-300 dark:bg-zinc-700" />
            <span className="w-2.5 h-2.5 rounded-xs border border-zinc-500 dark:border-zinc-500 bg-zinc-500 dark:bg-zinc-500" />
            <span className="w-2.5 h-2.5 rounded-xs border border-zinc-700 dark:border-zinc-300 bg-zinc-700 dark:bg-zinc-300" />
            <span className="w-2.5 h-2.5 rounded-xs border border-zinc-950 dark:border-white bg-zinc-950 dark:bg-white" />
            <span>Mais</span>
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
                ? `${formatFriendlyDate(selectedCell.key)} — ${selectedCell.completedCount} de ${selectedCell.scheduledCount} concluídos (${Math.round(selectedCell.ratio * 100)}%)`
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
    </div>
  );
};
