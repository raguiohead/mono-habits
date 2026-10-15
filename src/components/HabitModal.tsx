import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import { HABIT_ICONS } from './HabitIcon';
import { DAYS_SHORT } from '@/lib/dateUtils';
import { type Habit } from '@/types/habit';

interface HabitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (habitData: Omit<Habit, 'id' | 'createdAt'> & { id?: string; createdAt?: number }) => void;
  initialHabit?: Habit | null;
}

const COMMON_CATEGORIES = ['Saúde', 'Intelecto', 'Trabalho', 'Rotina', 'Mente', 'Finanças', 'Geral'];

export const HabitModal: React.FC<HabitModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialHabit
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [icon, setIcon] = useState('target');
  const [hideTitle, setHideTitle] = useState(false);
  const [frequency, setFrequency] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  useEffect(() => {
    if (initialHabit) {
      setTitle(initialHabit.title);
      setCategory(initialHabit.category || '');
      setIcon(initialHabit.icon || 'target');
      setHideTitle(Boolean(initialHabit.hideTitle));
      setFrequency(initialHabit.frequency || [0, 1, 2, 3, 4, 5, 6]);
    } else {
      setTitle('');
      setCategory('Saúde');
      setIcon('target');
      setHideTitle(false);
      setFrequency([0, 1, 2, 3, 4, 5, 6]);
    }
  }, [initialHabit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (frequency.length === 0) return;

    onSave({
      id: initialHabit ? initialHabit.id : undefined,
      title: title.trim(),
      category: category.trim() || 'Geral',
      icon: icon || 'target',
      hideTitle,
      frequency: [...frequency].sort(),
      archived: initialHabit ? initialHabit.archived : false,
      createdAt: initialHabit ? initialHabit.createdAt : Date.now()
    });

    onClose();
  };

  const toggleDay = (dayIndex: number) => {
    setFrequency((prev) =>
      prev.includes(dayIndex) ? prev.filter((d) => d !== dayIndex) : [...prev, dayIndex]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] text-zinc-950 dark:text-zinc-50 p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Topo do Modal */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-200/80 dark:border-zinc-800">
          <div>
            <h3 className="text-base font-semibold tracking-tight">
              {initialHabit ? 'Editar Hábito' : 'Novo Hábito'}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Configure sua rotina com estética minimalista
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl opacity-60 hover:opacity-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Nome */}
          <div>
            <label className="block font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">
              Nome do Hábito *
            </label>
            <input
              type="text"
              required
              maxLength={80}
              placeholder="Ex: Meditação matinal (15 min)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:focus:ring-zinc-50 text-xs"
            />
          </div>

          {/* Categoria */}
          <div>
            <label className="block font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">
              Categoria
            </label>
            <input
              type="text"
              placeholder="Ex: Saúde, Foco, Trabalho..."
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:focus:ring-zinc-50 text-xs mb-2"
            />
            {/* Sugestões de Categoria */}
            <div className="flex flex-wrap gap-1.5">
              {COMMON_CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-2 py-1 rounded-lg border text-[11px] font-mono transition-colors ${
                    category === cat
                      ? 'bg-zinc-950 text-zinc-50 border-zinc-950 dark:bg-zinc-50 dark:text-zinc-950'
                      : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Seletor de Ícones (16 ícones minimalistas) */}
          <div>
            <label className="block font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">
              Ícone Representativo
            </label>
            <div className="grid grid-cols-8 gap-1.5">
              {HABIT_ICONS.map((item) => {
                const IconComponent = item.Icon;
                const isSelected = icon === item.key;
                return (
                  <button
                    type="button"
                    key={item.key}
                    onClick={() => setIcon(item.key)}
                    className={`p-2.5 rounded-xl border flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-zinc-950 text-zinc-50 border-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 dark:border-zinc-50 scale-105'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400'
                    }`}
                    title={item.label}
                  >
                    <IconComponent className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Modo Discreto (Ocultar Nome do Hábito) */}
          <div
            onClick={() => setHideTitle(!hideTitle)}
            className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-colors ${
              hideTitle
                ? 'bg-zinc-100 dark:bg-zinc-900 border-zinc-400 dark:border-zinc-700'
                : 'bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {hideTitle ? (
                <EyeOff className="w-4 h-4 shrink-0 text-zinc-900 dark:text-zinc-100" />
              ) : (
                <Eye className="w-4 h-4 shrink-0 opacity-60" />
              )}
              <div>
                <p className="font-medium text-xs">Modo Discreto (Ocultar Nome)</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Exibe apenas o ícone e a tag na fita diária para privacidade visual
                </p>
              </div>
            </div>
            <div
              className={`w-9 h-5 rounded-full p-0.5 transition-colors shrink-0 ${
                hideTitle ? 'bg-zinc-950 dark:bg-zinc-50' : 'bg-zinc-300 dark:bg-zinc-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full transition-transform ${
                  hideTitle
                    ? 'translate-x-4 bg-white dark:bg-zinc-950'
                    : 'translate-x-0 bg-white'
                }`}
              />
            </div>
          </div>

          {/* Frequência Semanal */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-medium text-zinc-700 dark:text-zinc-300">
                Frequência Semanal
              </label>
              <button
                type="button"
                onClick={() => setFrequency([0, 1, 2, 3, 4, 5, 6])}
                className="text-[11px] font-mono underline opacity-75 hover:opacity-100"
              >
                Marcar todos
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {DAYS_SHORT.map((dayLabel, idx) => {
                const selected = frequency.includes(idx);
                return (
                  <button
                    type="button"
                    key={dayLabel}
                    onClick={() => toggleDay(idx)}
                    className={`py-2 rounded-xl text-xs font-mono border transition-all ${
                      selected
                        ? 'bg-zinc-950 text-zinc-50 border-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 dark:border-zinc-50 font-semibold'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400'
                    }`}
                  >
                    {dayLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ações Inferiores */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-200/80 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl font-medium border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl font-medium bg-zinc-950 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow-xs"
            >
              {initialHabit ? 'Salvar Alterações' : 'Criar Hábito'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
