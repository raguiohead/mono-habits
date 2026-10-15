import React, { useState } from 'react';
import { Plus, Edit3, Archive, RotateCcw, Trash2, Eye, EyeOff } from 'lucide-react';
import { useHabits } from '@/context/HabitsContext';
import { HabitIcon } from './HabitIcon';
import { DAYS_SHORT } from '@/lib/dateUtils';
import { type Habit } from '@/types/habit';
import { MILESTONES, getHabitMilestones } from '@/lib/milestones';
import { hasWeeklyTarget, targetForWeek, weekStartKey } from '@/lib/weekly';

interface ManageHabitsProps {
  onOpenCreateModal: () => void;
  onOpenEditModal: (habit: Habit) => void;
  onConfirmDelete: (habit: Habit) => void;
}

/** Marcos de ofensiva: preenchidos = atingidos, contornados = faltantes */
const MilestoneRow: React.FC<{ habit: Habit }> = ({ habit }) => {
  const { logs, graces, slips } = useHabits();
  const { reached } = getHabitMilestones(habit, logs, new Date(), graces, slips);
  return (
    <div className="flex items-center gap-1 mt-1.5" aria-label={`Marcos atingidos: ${reached.join(', ') || 'nenhum'}`}>
      {MILESTONES.map((m) => (
        <span
          key={m}
          className={`text-[10px] font-mono leading-none px-1.5 py-1 rounded border ${
            reached.includes(m)
              ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
              : 'border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-600'
          }`}
        >
          {m}
        </span>
      ))}
    </div>
  );
};

export const ManageHabits: React.FC<ManageHabitsProps> = ({
  onOpenCreateModal,
  onOpenEditModal,
  onConfirmDelete
}) => {
  const { habits, toggleArchiveHabit, toggleHideTitle } = useHabits();
  const [filter, setFilter] = useState<'active' | 'archived'>('active');

  const filteredHabits = habits.filter((h) =>
    filter === 'active' ? !h.archived : h.archived
  );

  // Meta semanal vigente (ou a mais recente, se a vigente ainda não começou)
  const weeklyLabel = (habit: Habit) => {
    const target = targetForWeek(habit, weekStartKey(new Date())) ?? habit.weeklyTarget ?? 0;
    return `${target}x por semana`;
  };

  const formatFrequency = (freq: number[]) => {
    if (!freq || freq.length === 0) return 'Nenhum dia';
    if (freq.length === 7) return 'Todos os dias';
    if (freq.length === 5 && [1, 2, 3, 4, 5].every((d) => freq.includes(d))) return 'Dias úteis (Seg-Sex)';
    if (freq.length === 2 && [0, 6].every((d) => freq.includes(d))) return 'Fins de semana';
    return freq.map((d) => DAYS_SHORT[d]).join(', ');
  };

  return (
    <div className="space-y-6">
      {/* Controles de Topo & Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-medium">
          <button
            onClick={() => setFilter('active')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filter === 'active'
                ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-xs font-semibold'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            Ativos ({habits.filter((h) => !h.archived).length})
          </button>
          <button
            onClick={() => setFilter('archived')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filter === 'archived'
                ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-xs font-semibold'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            Arquivados ({habits.filter((h) => h.archived).length})
          </button>
        </div>

        <button
          onClick={onOpenCreateModal}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-zinc-950 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Criar Hábito</span>
        </button>
      </div>

      {/* Lista de Hábitos */}
      {filteredHabits.length === 0 ? (
        <div className="p-8 sm:p-12 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-center space-y-2 bg-white dark:bg-zinc-900/40">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {filter === 'active' ? 'Nenhum hábito ativo no momento.' : 'Nenhum hábito arquivado.'}
          </p>
          <p className="text-xs text-zinc-500">
            {filter === 'active'
              ? 'Clique no botão acima para adicionar seu primeiro hábito.'
              : 'Hábitos arquivados deixam de aparecer no foco diário sem perder o histórico.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredHabits.map((habit) => (
            <div
              key={habit.id}
              className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors shadow-xs gap-3"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300">
                  <HabitIcon iconKey={habit.icon} className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium tracking-tight truncate text-zinc-900 dark:text-zinc-100">
                    {habit.hideTitle ? (
                      <span className="font-mono tracking-widest text-xs opacity-60">•••••••••••</span>
                    ) : (
                      habit.title
                    )}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      {habit.category}
                    </span>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-600">•</span>
                    <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 truncate">
                      {habit.kind === 'avoid' ? 'Evitar · ' : ''}
                      {hasWeeklyTarget(habit) ? weeklyLabel(habit) : formatFrequency(habit.frequency)}
                    </span>
                  </div>
                  <MilestoneRow habit={habit} />
                </div>
              </div>

              {/* Ações */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => toggleHideTitle(habit)}
                  className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title={habit.hideTitle ? 'Mostrar nome do hábito' : 'Ocultar nome do hábito'}
                >
                  {habit.hideTitle ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => onOpenEditModal(habit)}
                  className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Editar dados do hábito"
                >
                  <Edit3 className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => toggleArchiveHabit(habit)}
                  className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title={habit.archived ? 'Restaurar hábito' : 'Arquivar hábito'}
                >
                  {habit.archived ? <RotateCcw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => onConfirmDelete(habit)}
                  className="p-2 rounded-xl text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Excluir permanentemente"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
