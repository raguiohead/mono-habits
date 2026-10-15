import React from 'react';
import { Check, Flame, Eye, EyeOff, Edit3 } from 'lucide-react';
import { type Habit } from '@/types/habit';
import { HabitIcon } from './HabitIcon';
import { useHabits } from '@/context/HabitsContext';
import { useSettings } from '@/context/SettingsContext';
import { calculateStreak, calculateBestStreak } from '@/lib/analytics';

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
  const { settings } = useSettings();

  const handleToggle = () => {
    if (settings.vibration && typeof navigator !== 'undefined') {
      navigator.vibrate?.(15);
    }
    onToggle();
  };
  const streak = calculateStreak(habit, logs);
  const bestStreak = calculateBestStreak(habit, logs);

  const isRecord = streak > 0 && streak === bestStreak;
  const isBroken = streak === 0 && bestStreak > 0;

  return (
    <div
      onClick={handleToggle}
      className={`group relative flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer select-none min-h-[58px] ${
        isCompleted
          ? 'bg-zinc-100/90 dark:bg-zinc-900/40 border-zinc-300/80 dark:border-zinc-800/60 opacity-90'
          : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-xs'
      }`}
    >
      {/* Lado Esquerdo: Checkbox + Ícone + Informações */}
      <div className="flex items-center gap-3.5 min-w-0 pr-2 flex-1">
        {/* Checkbox Circular Monocromático */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleToggle();
          }}
          className={`relative w-7 h-7 rounded-xl border flex items-center justify-center shrink-0 transition-colors duration-200 before:absolute before:-inset-2 before:content-[''] ${
            isCompleted
              ? 'text-zinc-50 dark:text-zinc-950 border-zinc-950 dark:border-zinc-50 shadow-xs'
              : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-500 bg-zinc-50/50 dark:bg-zinc-800/40'
          }`}
          aria-label={isCompleted ? `Desmarcar ${habit.title}` : `Marcar ${habit.title}`}
        >
          {/* Preenchimento de baixo para cima (some com "reduzir animações" via index.css) */}
          <span aria-hidden="true" className="absolute inset-0 rounded-[11px] overflow-hidden pointer-events-none">
            <span
              className="absolute inset-0 bg-zinc-950 dark:bg-zinc-50 origin-bottom transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{ transform: isCompleted ? 'scaleY(1)' : 'scaleY(0)' }}
            />
          </span>
          <Check
            className={`relative w-4 h-4 stroke-[2.5] transition-opacity duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isCompleted ? 'opacity-100' : 'opacity-0'
            }`}
          />
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
        <div className="min-w-0 flex-1">
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
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 shrink-0">
              {habit.category}
            </span>
            {isBroken && (
              <>
                <span className="text-zinc-300 dark:text-zinc-700 text-[10px] shrink-0">·</span>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-normal truncate">
                  Sua melhor continua em {bestStreak} {bestStreak === 1 ? 'dia' : 'dias'}.
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Lado Direito: Ações Rápidas & Streak */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
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

        {/* Badge de Streak: atual e melhor */}
        <div
          className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg border font-mono text-xs transition-all ${
            isRecord
              ? 'border-zinc-400 dark:border-zinc-600 bg-zinc-200/70 dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 font-bold shadow-xs'
              : streak > 0
              ? 'border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 font-semibold'
              : bestStreak > 0
              ? 'border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/40 text-zinc-600 dark:text-zinc-400 font-normal'
              : 'border-transparent text-zinc-400 dark:text-zinc-600 font-normal'
          }`}
          title={`Atual: ${streak} dia(s) · Melhor: ${bestStreak} dia(s)`}
        >
          <Flame
            className={`w-3.5 h-3.5 shrink-0 ${
              streak > 0
                ? 'text-zinc-950 dark:text-zinc-100 fill-zinc-950 dark:fill-zinc-100'
                : 'text-zinc-400 dark:text-zinc-600'
            }`}
          />
          <span>{streak}</span>
          <span className="opacity-40 font-normal">·</span>
          <span className={`text-[10px] sm:text-xs ${isRecord ? 'font-bold' : 'font-normal opacity-90'}`}>
            melhor {bestStreak}
          </span>
        </div>
      </div>
    </div>
  );
};
