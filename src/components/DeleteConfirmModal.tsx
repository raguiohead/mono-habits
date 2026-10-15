import React from 'react';
import { type Habit } from '@/types/habit';
import { ModalShell } from './ModalShell';

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
    <ModalShell labelledBy="delete-title" onClose={onClose} widthClass="sm:max-w-sm">
      <div className="space-y-4">
        <h3 id="delete-title" className="text-sm font-semibold tracking-tight">Excluir Hábito</h3>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Tem certeza de que deseja excluir permanentemente o hábito{' '}
          <strong className="text-zinc-950 dark:text-zinc-50">"{habit.title}"</strong>? Esta ação
          não poderá ser desfeita.
        </p>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium bg-zinc-950 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
          >
            Excluir Definitivamente
          </button>
        </div>
      </div>
    </ModalShell>
  );
};
