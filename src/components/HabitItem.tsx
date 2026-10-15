import React from 'react';
import { Check, Flame, Eye, EyeOff, Edit3 } from 'lucide-react';
import { type Habit } from '@/types/habit';
import { HabitIcon } from './HabitIcon';
import { useHabits } from '@/context/HabitsContext';
import { calculateStreak } from '@/lib/analytics';

interface HabitItemProps {
  habit: Habit;
  isCompleted: boolean;
  onToggle: () => void;
  onEdit: () => void;
}

export const HabitItem: React.FC<HabitItemProps> = ({
  habit,
  isCompleted,
  onToggle,
  onEdit
}) => {
  const { logs, toggleHideTitle } = useHabits();
  const streak = calculateStreak(habit, logs);

  return (
    <div
      onClick={onToggle}
      className={`group relative flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer select-none min-h-[58px] ${
        isCompleted
          ? 'bg-zinc-100/90 dark:bg-zinc-900/40 border-zinc-300/80 dark:border-zinc-800/60 opacity-90'
          : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-xs'
      }`}
    >
      {/* Lado Esquerdo: Checkbox + Ícone + Informações */}
      <div className="flex items-center gap-3.5 min-w-0 pr-2">
        {/* Checkbox Circular Monocromático */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className={`w-7 h-7 rounded-xl border flex items-center justify-center shrink-0 transition-all ${
            isCompleted
              ? 'bg-zinc-950 text-zinc-50 border-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 dark:border-zinc-50 shadow-xs'
              : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-500 bg-zinc-50/50 dark:bg-zinc-800/40'
          }`}
          aria-label={isCompleted ? `Desmarcar ${habit.title}` : `Marcar ${habit.title}`}
        >
          {isCompleted && <Check className="w-4 h-4 stroke-[2.5]" />}
        </button>

        {/* Ícone de Categoria */}
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
            isCompleted
              ? 'border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500'
              : 'border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300'
          }`}
        >
          <HabitIcon iconKey={habit.icon} className="w-4 h-4" />
        </div>

        {/* Textos */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p
              className={`text-sm font-medium tracking-tight truncate ${
                isCompleted
                  ? 'line-through text-zinc-400 dark:text-zinc-500'
                  : 'text-zinc-900 dark:text-zinc-100'
              }`}
            >
              {habit.hideTitle ? (
                <span className="font-mono tracking-widest text-xs opacity-60">•••••••••••</span>
              ) : (
                habit.title
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {habit.category}
            </span>
          </div>
        </div>
      </div>

      {/* Lado Direito: Ações Rápidas & Streak */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Toggle Discreto (Olho) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleHideTitle(habit);
          }}
          className="p-1.5 rounded-lg opacity-60 hover:opacity-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors"
          title={habit.hideTitle ? 'Mostrar título do hábito' : 'Ocultar título do hábito'}
        >
          {habit.hideTitle ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>

        {/* Editar */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="p-1.5 rounded-lg opacity-60 hover:opacity-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors"
          title="Editar hábito"
        >
          <Edit3 className="w-3.5 h-3.5" />
        </button>

        {/* Badge de Streak */}
        <div
          className={`flex items-center gap-1 px-2 py-1 rounded-lg border font-mono text-xs ${
            streak > 0
              ? 'border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 font-semibold'
              : 'border-transparent text-zinc-400 dark:text-zinc-600'
          }`}
          title={`${streak} dia(s) de ofensiva`}
        >
          <Flame
            className={`w-3.5 h-3.5 ${
              streak > 0
                ? 'text-zinc-950 dark:text-zinc-100 fill-zinc-950 dark:fill-zinc-100'
                : 'text-zinc-400 dark:text-zinc-600'
            }`}
          />
          <span>{streak}</span>
        </div>
      </div>
    </div>
  );
};
