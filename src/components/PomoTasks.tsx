import React, { useState, useEffect } from 'react';
import {
  Plus,
  Minus,
  Check,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  RefreshCw
} from 'lucide-react';
import { useTasks } from '@/context/TasksContext';
import { useHabits } from '@/context/HabitsContext';
import { useSettings, useDiscreet } from '@/context/SettingsContext';
import { taskProgress, MIN_TASK_POMOS, MAX_TASK_POMOS, DEFAULT_TASK_POMOS } from '@/lib/tasks';
import { ModalShell } from './ModalShell';
import { type PomoTask } from '@/types/habit';

export const PomoTasks: React.FC = () => {
  const {
    activeTasks,
    completedTasks,
    createTask,
    updateTask,
    deleteTask,
    toggleTaskDone,
    reorderTasks,
    isSyncingGoogle,
    syncWithGoogle
  } = useTasks();
  const { pomoSessions } = useHabits();
  const { settings } = useSettings();
  const { active: isDiscreet } = useDiscreet();

  // Ao abrir o componente (aba Pomo), tenta sincronizar em background se houver lista conectada (sem UI)
  useEffect(() => {
    if (settings.googleTasks?.listId) {
      void syncWithGoogle({ interactive: false });
    }
  }, [settings.googleTasks?.listId, syncWithGoogle]);

  // Criação rápida
  const [newTitle, setNewTitle] = useState('');
  const [newPomos, setNewPomos] = useState(DEFAULT_TASK_POMOS);

  // Expansão de concluídas
  const [showCompleted, setShowCompleted] = useState(false);

  // Modais de edição e exclusão
  const [editingTask, setEditingTask] = useState<PomoTask | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPomos, setEditPomos] = useState(DEFAULT_TASK_POMOS);
  const [editNotes, setEditNotes] = useState('');

  const [taskToDelete, setTaskToDelete] = useState<PomoTask | null>(null);

  const displayTaskTitle = (task: PomoTask) =>
    isDiscreet ? '••••• (Tarefa)' : task.title;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    await createTask(trimmed, newPomos);
    setNewTitle('');
    setNewPomos(DEFAULT_TASK_POMOS);
  };

  const handleOpenEdit = (task: PomoTask) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditPomos(task.estimatedPomos);
    setEditNotes(task.notes || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editTitle.trim()) return;
    await updateTask(editingTask.id, {
      title: editTitle.trim(),
      estimatedPomos: editPomos,
      notes: editNotes.trim()
    });
    setEditingTask(null);
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activeTasks.length) return;

    const copy = [...activeTasks];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIndex, 0, moved);

    await reorderTasks(copy.map((t) => t.id));
  };

  const handleConfirmDelete = async () => {
    if (!taskToDelete) return;
    await deleteTask(taskToDelete.id);
    setTaskToDelete(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
          Tarefas ({activeTasks.length})
        </h3>

        {settings.googleTasks && (
          <button
            type="button"
            onClick={() => syncWithGoogle({ interactive: false })}
            disabled={isSyncingGoogle}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-50 border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 transition-colors"
            title={`Sincronizar com lista ${settings.googleTasks.listTitle}`}
          >
            <RefreshCw className={`w-3 h-3 ${isSyncingGoogle ? 'animate-spin text-zinc-950 dark:text-zinc-50' : ''}`} />
            <span>{isSyncingGoogle ? 'Sincronizando...' : 'Google Tasks'}</span>
          </button>
        )}
      </div>

      {/* Formulário de Adicionar Rápida */}
      <form
        onSubmit={handleCreate}
        className="p-3 sm:p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-xs space-y-3"
      >
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            type="text"
            placeholder="Nova tarefa com foco..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            maxLength={200}
            className="flex-1 min-h-[44px] px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm focus:outline-none focus:border-zinc-950 dark:focus:border-zinc-50 transition-colors"
          />

          <div className="flex items-center justify-between sm:justify-end gap-2">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
              <button
                type="button"
                onClick={() => setNewPomos((p) => Math.max(MIN_TASK_POMOS, p - 1))}
                disabled={newPomos <= MIN_TASK_POMOS}
                aria-label="Diminuir estimativa em 1 pomo"
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-xs font-semibold tabular-nums px-1" title="Estimativa de pomos">
                {newPomos} {newPomos === 1 ? 'pomo' : 'pomos'}
              </span>
              <button
                type="button"
                onClick={() => setNewPomos((p) => Math.min(MAX_TASK_POMOS, p + 1))}
                disabled={newPomos >= MAX_TASK_POMOS}
                aria-label="Aumentar estimativa em 1 pomo"
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="submit"
              disabled={!newTitle.trim()}
              className="min-h-[44px] px-4 rounded-xl bg-zinc-950 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950 text-xs font-medium flex items-center justify-center gap-1.5 hover:opacity-90 disabled:opacity-40 transition-opacity whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar</span>
            </button>
          </div>
        </div>
      </form>

      {/* Lista de Tarefas Ativas */}
      {activeTasks.length === 0 ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 py-6 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
          Nenhuma tarefa pendente. Crie uma tarefa com estimativa de pomos para acompanhar o progresso.
        </p>
      ) : (
        <ul className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 divide-y divide-zinc-100 dark:divide-zinc-800/80 overflow-hidden">
          {activeTasks.map((task, idx) => {
            const prog = taskProgress(task, pomoSessions);
            const isFirst = idx === 0;
            const isLast = idx === activeTasks.length - 1;

            return (
              <li
                key={task.id}
                className="p-3.5 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20"
              >
                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => toggleTaskDone(task.id)}
                    role="checkbox"
                    aria-checked={task.done}
                    aria-label={`Marcar "${displayTaskTitle(task)}" como concluída`}
                    className="w-5 h-5 rounded-md border border-zinc-300 dark:border-zinc-700 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 hover:border-zinc-950 dark:hover:border-zinc-50 transition-colors"
                  >
                    {task.done && <Check className="w-3.5 h-3.5 text-zinc-950 dark:text-zinc-50" />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm font-medium text-zinc-950 dark:text-zinc-50 truncate"
                      title={displayTaskTitle(task)}
                    >
                      {displayTaskTitle(task)}
                    </p>
                    {task.notes && !isDiscreet && (
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
                        {task.notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-8 sm:pl-0">
                  {/* Progresso visual (bolinhas) e contador */}
                  <div className="flex items-center gap-2">
                    <div
                      className="flex items-center gap-1"
                      aria-label={`Progresso: ${prog.done} de ${prog.target} pomos`}
                      title={`Progresso: ${prog.done} de ${prog.target} pomos`}
                    >
                      {Array.from({ length: Math.min(prog.target, 8) }).map((_, i) => (
                        <span
                          key={i}
                          className={`w-2 h-2 rounded-full ${
                            i < prog.done
                              ? 'bg-zinc-950 dark:bg-zinc-50'
                              : 'border border-zinc-300 dark:border-zinc-700'
                          }`}
                        />
                      ))}
                    </div>
                    <span
                      className={`font-mono text-[11px] tabular-nums ${
                        prog.met
                          ? 'font-bold text-zinc-950 dark:text-zinc-50'
                          : 'text-zinc-500 dark:text-zinc-400'
                      }`}
                    >
                      {prog.done}/{prog.target}
                    </span>
                  </div>

                  {/* Ações: Reordenar, Editar, Excluir */}
                  <div className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
                    <button
                      type="button"
                      onClick={() => handleMove(idx, 'up')}
                      disabled={isFirst}
                      aria-label="Mover tarefa para cima"
                      className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-20 transition-colors"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(idx, 'down')}
                      disabled={isLast}
                      aria-label="Mover tarefa para baixo"
                      className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-20 transition-colors"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(task)}
                      aria-label="Editar tarefa"
                      className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaskToDelete(task)}
                      aria-label="Excluir tarefa"
                      className="w-7 h-7 rounded-lg flex items-center justify-center hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Tarefas Concluídas */}
      {completedTasks.length > 0 && (
        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={() => setShowCompleted((prev) => !prev)}
            className="flex items-center gap-1.5 text-xs font-mono text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-50 transition-colors"
          >
            {showCompleted ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>Concluídas ({completedTasks.length})</span>
          </button>

          {showCompleted && (
            <ul className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 divide-y divide-zinc-100 dark:divide-zinc-800/60 overflow-hidden">
              {completedTasks.map((task) => {
                const prog = taskProgress(task, pomoSessions);
                return (
                  <li
                    key={task.id}
                    className="p-3 sm:px-4 flex items-center justify-between gap-3 text-xs opacity-75 hover:opacity-100 transition-opacity"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => toggleTaskDone(task.id)}
                        role="checkbox"
                        aria-checked={true}
                        aria-label={`Reabrir tarefa "${displayTaskTitle(task)}"`}
                        className="w-5 h-5 rounded-md bg-zinc-950 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950 flex items-center justify-center shrink-0"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-sm line-through text-zinc-500 dark:text-zinc-400 truncate">
                        {displayTaskTitle(task)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                        {prog.done}/{prog.target} pomos
                      </span>
                      <button
                        type="button"
                        onClick={() => setTaskToDelete(task)}
                        aria-label="Excluir tarefa concluída"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Modal de Edição de Tarefa */}
      {editingTask && (
        <ModalShell labelledBy="edit-task-title" onClose={() => setEditingTask(null)}>
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <h3 id="edit-task-title" className="text-sm font-semibold tracking-tight">
              Editar Tarefa
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1">
                  Título
                </label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm focus:outline-none focus:border-zinc-950 dark:focus:border-zinc-50"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1">
                  Estimativa de foco
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                    <button
                      type="button"
                      onClick={() => setEditPomos((p) => Math.max(MIN_TASK_POMOS, p - 1))}
                      disabled={editPomos <= MIN_TASK_POMOS}
                      className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-30"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="font-mono text-sm font-semibold tabular-nums px-2">
                      {editPomos} {editPomos === 1 ? 'pomo' : 'pomos'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditPomos((p) => Math.min(MAX_TASK_POMOS, p + 1))}
                      disabled={editPomos >= MAX_TASK_POMOS}
                      className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-30"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1">
                  Anotações (opcional)
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder="Detalhes ou passos desta tarefa..."
                  className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm focus:outline-none focus:border-zinc-950 dark:focus:border-zinc-50 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingTask(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!editTitle.trim()}
                className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium bg-zinc-950 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-40"
              >
                Salvar Alterações
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* Modal de Exclusão */}
      {taskToDelete && (
        <ModalShell labelledBy="delete-task-title" onClose={() => setTaskToDelete(null)} widthClass="sm:max-w-sm">
          <div className="space-y-4">
            <h3 id="delete-task-title" className="text-sm font-semibold tracking-tight">
              Excluir Tarefa
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Tem certeza de que deseja excluir a tarefa{' '}
              <strong className="text-zinc-950 dark:text-zinc-50">
                "{displayTaskTitle(taskToDelete)}"
              </strong>
              ? O histórico de sessões focado nela continuará registrado.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTaskToDelete(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium bg-zinc-950 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
};
