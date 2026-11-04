import React from 'react';
import { useTasks } from '@/context/TasksContext';
import { ModalShell } from './ModalShell';

/**
 * Aparece quando a lista do Google Tasks salva na conta (definida em outro aparelho) é diferente da usada aqui
 * e adotá-la tiraria tarefas deste aparelho do app. As tarefas nunca são apagadas no Google.
 */
export const ListConflictModal: React.FC = () => {
  const { pendingListConflict, resolveListConflict } = useTasks();
  if (!pendingListConflict) return null;

  const { remote, local, affectedCount } = pendingListConflict;
  const noun = affectedCount === 1 ? 'tarefa' : 'tarefas';

  return (
    <ModalShell labelledBy="list-conflict-title" onClose={() => {}} widthClass="sm:max-w-sm">
      <div className="space-y-4">
        <h3 id="list-conflict-title" className="text-sm font-semibold tracking-tight">
          Qual lista do Google Tasks usar?
        </h3>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Sua conta usa a lista <strong className="text-zinc-950 dark:text-zinc-50">"{remote.listTitle}"</strong>, mas este
          aparelho estava na <strong className="text-zinc-950 dark:text-zinc-50">"{local.listTitle}"</strong>.
        </p>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Usar a "{remote.listTitle}" tira do app {affectedCount} {noun} da "{local.listTitle}". Nada é apagado no
          Google: elas continuam lá e podem ser reimportadas depois.
        </p>

        <div className="flex flex-col gap-2 pt-2">
          <button
            type="button"
            onClick={() => void resolveListConflict('adopt')}
            className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium bg-zinc-950 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
          >
            Usar a "{remote.listTitle}" (lista da conta)
          </button>
          <button
            type="button"
            onClick={() => void resolveListConflict('keep')}
            className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Manter a "{local.listTitle}" e trocar a conta para ela
          </button>
        </div>
      </div>
    </ModalShell>
  );
};
