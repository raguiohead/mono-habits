import React from 'react';
import { type Habit } from '@/types/habit';

interface DeleteConfirmModalProps {
  habit: Habit | null;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  habit,
  onClose,
  onConfirm
}) => {
  if (!habit) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="w-full max-w-sm rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] text-zinc-950 dark:text-zinc-50 p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold tracking-tight">Excluir Hábito</h3>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Tem certeza de que deseja excluir permanentemente o hábito{' '}
          <strong className="text-zinc-950 dark:text-zinc-50">"{habit.title}"</strong>? Esta ação
          não poderá ser desfeita.
        </p>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-xs font-medium bg-zinc-950 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
          >
            Excluir Definitivamente
          </button>
        </div>
      </div>
    </div>
  );
};
