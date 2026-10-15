import React, { useMemo, useState } from 'react';
import { BarChart2, Flame, Target, Award, Calendar } from 'lucide-react';
import { useHabits } from '@/context/HabitsContext';
import {
  generateHeatmapDays,
  calculateRetentionRate,
  getBestStreak,
  getHeatmapCellClass
} from '@/lib/analytics';
import { formatFriendlyDate } from '@/lib/dateUtils';
import { type HeatmapDay } from '@/types/habit';

export const ConsistencyView: React.FC = () => {
  const { activeHabits, logs, darkMode, setSelectedDateKey, setActiveTab } = useHabits();
  const [selectedCell, setSelectedCell] = useState<HeatmapDay | null>(null);

  const today = useMemo(() => new Date(), []);

  // 91 dias (13 semanas)
  const heatmapDays = useMemo(
    () => generateHeatmapDays(activeHabits, logs, today, 91),
    [activeHabits, logs, today]
  );

  const consistency30 = useMemo(
    () => calculateRetentionRate(heatmapDays, 30),
    [heatmapDays]
  );

  const consistency14 = useMemo(
    () => calculateRetentionRate(heatmapDays, 14),
    [heatmapDays]
  );

  const bestStreak = useMemo(
    () => getBestStreak(activeHabits, logs, today),
    [activeHabits, logs, today]
  );

  // Organizar os 91 dias em colunas de 7 dias (Semanas)
  const weeks = useMemo(() => {
    const result: HeatmapDay[][] = [];
    for (let i = 0; i < heatmapDays.length; i += 7) {
      result.push(heatmapDays.slice(i, i + 7));
    }
    return result;
  }, [heatmapDays]);

  return (
    <div className="space-y-6">
      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-xs">
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
            <Target className="w-4 h-4" />
            <span className="text-[11px] font-mono uppercase tracking-wider">Últimos 30d</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-mono mt-2">{consistency30}%</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Taxa de conclusão</p>
        </div>

        <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-xs">
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
            <BarChart2 className="w-4 h-4" />
            <span className="text-[11px] font-mono uppercase tracking-wider">Últimos 14d</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-mono mt-2">{consistency14}%</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Janela recente</p>
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

      {/* Heatmap de 90 Dias */}
      <div className="p-4 sm:p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Grade de Consistência (90 Dias)</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              13 semanas de histórico diário. A intensidade monocromática reflete sua taxa de conclusão.
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

        {/* Grade de Semanas com Rolagem Horizontal Suave */}
        <div className="overflow-x-auto pb-2 -mx-2 px-2">
          <div className="inline-flex gap-1.5 min-w-full justify-between">
            {weeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-1.5">
                {week.map((day) => {
                  const cellClass = getHeatmapCellClass(day.ratio, darkMode);
                  const isHovered = selectedCell?.key === day.key;

                  return (
                    <button
                      type="button"
                      key={day.key}
                      onClick={() => {
                        setSelectedCell(day);
                        setSelectedDateKey(day.key);
                        setActiveTab('today');
                      }}
                      onMouseEnter={() => setSelectedCell(day)}
                      className={`w-4 h-4 sm:w-4.5 sm:h-4.5 rounded-xs border transition-all ${cellClass} ${
                        isHovered ? 'ring-2 ring-zinc-500 scale-110 z-10' : ''
                      }`}
                      title={`${formatFriendlyDate(day.key)}: ${day.completedCount}/${day.scheduledCount} (${Math.round(day.ratio * 100)}%)`}
                      aria-label={day.key}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Detalhes da Célula Selecionada */}
        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs font-mono text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5" />
            <span>
              {selectedCell
                ? `${formatFriendlyDate(selectedCell.key)} — ${selectedCell.completedCount} de ${selectedCell.scheduledCount} concluídos (${Math.round(selectedCell.ratio * 100)}%)`
                : 'Passe o mouse ou toque em uma célula para inspecionar'}
            </span>
          </div>
          {selectedCell && (
            <button
              onClick={() => {
                setSelectedDateKey(selectedCell.key);
                setActiveTab('today');
              }}
              className="underline hover:text-zinc-950 dark:hover:text-zinc-100"
            >
              Abrir dia
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
