import React, { useMemo } from 'react';
import { Plus, Sparkles, Calendar } from 'lucide-react';
import { WeeklyStrip } from './WeeklyStrip';
import { HabitItem } from './HabitItem';
import { useHabits } from '@/context/HabitsContext';
import { parseDateKey, formatFriendlyDate } from '@/lib/dateUtils';
import { getHabitsForDay, calculateDailyProgress } from '@/lib/analytics';
import { type Habit } from '@/types/habit';

interface DailyFocusProps {
  onOpenCreateModal: () => void;
  onOpenEditModal: (habit: Habit) => void;
}

export const DailyFocus: React.FC<DailyFocusProps> = ({
  onOpenCreateModal,
  onOpenEditModal
}) => {
  const {
    activeHabits,
    logs,
    selectedDateKey,
    toggleHabitCompletion,
    seedStarterHabits
  } = useHabits();

  const selectedDate = useMemo(() => parseDateKey(selectedDateKey), [selectedDateKey]);
  const dayOfWeek = selectedDate.getDay();

  // Hábitos agendados para este dia da semana
  const scheduledHabits = useMemo(
    () => getHabitsForDay(activeHabits, dayOfWeek),
    [activeHabits, dayOfWeek]
  );

  const completedIds = useMemo(
    () => logs[selectedDateKey] || [],
    [logs, selectedDateKey]
  );

  const progressPercent = useMemo(
    () => calculateDailyProgress(scheduledHabits, completedIds),
    [scheduledHabits, completedIds]
  );

  const completedCount = useMemo(
    () => scheduledHabits.filter((h) => completedIds.includes(h.id)).length,
    [scheduledHabits, completedIds]
  );

  return (
    <div className="space-y-6">
      {/* Fita Semanal */}
      <WeeklyStrip />

      {/* Cabeçalho da Data & Barra de Progresso */}
      <div className="p-4 sm:p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Progresso Diário
            </h2>
            <p className="text-sm font-semibold tracking-tight mt-0.5">
              {formatFriendlyDate(selectedDateKey)}
            </p>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold font-mono">
              {progressPercent}%
            </span>
            <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
              {completedCount} de {scheduledHabits.length} concluídos
            </p>
          </div>
        </div>

        {/* Barra de Progresso Monocromática */}
        <div className="w-full h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden border border-zinc-200/50 dark:border-zinc-800">
          <div
            className="h-full bg-zinc-950 dark:bg-zinc-50 transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Lista de Hábitos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Hábitos do Dia ({scheduledHabits.length})
          </h3>
          <button
            onClick={onOpenCreateModal}
            className="flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-50 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo Hábito</span>
          </button>
        </div>

        {/* Empty States */}
        {activeHabits.length === 0 ? (
          <div className="p-8 sm:p-10 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 text-center space-y-4 bg-zinc-50/50 dark:bg-zinc-900/20">
            <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
              <Sparkles className="w-6 h-6 text-zinc-600 dark:text-zinc-300" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">Nenhum hábito cadastrado</h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
                Comece do zero ou carregue hábitos minimalistas pré-configurados para testar o fluxo.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={seedStarterHabits}
                className="px-4 py-2 rounded-xl text-xs font-medium border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
              >
                Carregar 4 Hábitos Exemplo
              </button>
              <button
                onClick={onOpenCreateModal}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-zinc-950 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
              >
                Criar Meu Primeiro Hábito
              </button>
            </div>
          </div>
        ) : scheduledHabits.length === 0 ? (
          <div className="p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 text-center space-y-2 bg-white dark:bg-zinc-900/40">
            <Calendar className="w-8 h-8 mx-auto text-zinc-400 opacity-60" />
            <h4 className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Nenhum hábito programado para este dia
            </h4>
            <p className="text-[11px] text-zinc-500">
              Aproveite seu descanso ou ajuste a frequência semanal dos seus hábitos na aba "Hábitos & Rotinas".
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {scheduledHabits.map((habit) => (
              <HabitItem
                key={habit.id}
                habit={habit}
                isCompleted={completedIds.includes(habit.id)}
                onToggle={() => toggleHabitCompletion(habit.id, selectedDateKey)}
                onEdit={() => onOpenEditModal(habit)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
