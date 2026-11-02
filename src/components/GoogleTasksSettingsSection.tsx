import React, { useState } from 'react';
import { CheckSquare, RefreshCw, LogOut, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useTasks } from '@/context/TasksContext';
import { useSettings } from '@/context/SettingsContext';
import { useHabits } from '@/context/HabitsContext';
import { getTasksToken } from '@/lib/googleTasksAuth';
import { listTaskLists, type GoogleTaskList } from '@/lib/googleTasksApi';
import { SectionTitle, BTN, BTN_PRIMARY } from './settingsControls';
import { ModalShell } from './ModalShell';

export const GoogleTasksSettingsSection: React.FC = () => {
  const { settings } = useSettings();
  const { showToast } = useHabits();
  const {
    isSyncingGoogle,
    googleSyncError,
    syncWithGoogle,
    connectGoogleTasks,
    disconnectGoogleTasks
  } = useTasks();

  const [loadingLists, setLoadingLists] = useState(false);
  const [availableLists, setAvailableLists] = useState<GoogleTaskList[] | null>(null);
  const [selectedListId, setSelectedListId] = useState<string>('');

  const config = settings.googleTasks;

  const handleStartConnect = async () => {
    setLoadingLists(true);
    try {
      const token = await getTasksToken({ interactive: true });
      const lists = await listTaskLists(token);
      if (lists.length === 0) {
        showToast('Nenhuma lista de tarefas encontrada na sua conta Google.');
        setLoadingLists(false);
        return;
      }
      setAvailableLists(lists);
      setSelectedListId(lists[0].id);
    } catch (err: any) {
      console.error('[GoogleTasksConnect]', err);
      showToast(`Falha ao conectar Google Tasks: ${err?.message || 'Tente novamente.'}`);
    } finally {
      setLoadingLists(false);
    }
  };

  const handleConfirmList = async () => {
    if (!availableLists || !selectedListId) return;
    const chosen = availableLists.find((l) => l.id === selectedListId);
    if (!chosen) return;

    await connectGoogleTasks(chosen.id, chosen.title);
    setAvailableLists(null);
    showToast(`Conectado à lista "${chosen.title}". Sincronizando...`);
  };

  const handleSyncNow = async () => {
    const ok = await syncWithGoogle({ interactive: false });
    if (ok) {
      showToast('Sincronização com o Google Tasks concluída!');
    }
  };

  const handleReconnect = async () => {
    const ok = await syncWithGoogle({ interactive: true });
    if (ok) {
      showToast('Reconectado e sincronizado com o Google Tasks!');
    }
  };

  const formatLastSync = (timestamp?: number) => {
    if (!timestamp) return 'Nunca';
    const date = new Date(timestamp);
    const now = Date.now();
    const diffMinutes = Math.floor((now - timestamp) / 60_000);

    if (diffMinutes < 1) return 'Agora mesmo';
    if (diffMinutes < 60) return `Há ${diffMinutes} min`;
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <section className="space-y-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 p-4">
      <SectionTitle icon={<CheckSquare className="w-3.5 h-3.5" />}>Google Tasks</SectionTitle>

      <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
        Sincronize tarefas pontuais com estimativa de pomos nos dois sentidos com uma lista da sua
        conta do Google Tasks.
      </p>

      {config ? (
        <div className="space-y-3">
          <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 font-mono text-xs space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="opacity-60 text-[11px]">LISTA CONECTADA:</span>
              <span className="font-semibold text-zinc-950 dark:text-zinc-50 truncate max-w-[200px]">
                {config.listTitle}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="opacity-60 text-[11px]">ÚLTIMA SINCRONIZAÇÃO:</span>
              <span className="tabular-nums">
                {isSyncingGoogle ? 'Sincronizando...' : formatLastSync(config.lastSyncAt)}
              </span>
            </div>
          </div>

          {googleSyncError && (
            <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <p>{googleSyncError}</p>
                <button
                  type="button"
                  onClick={handleReconnect}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  Reconectar Google Tasks
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleSyncNow}
              disabled={isSyncingGoogle}
              className={`${BTN} w-full justify-center`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingGoogle ? 'animate-spin' : ''}`} />
              {isSyncingGoogle ? 'Sincronizando...' : 'Sincronizar agora'}
            </button>

            <button
              type="button"
              onClick={handleStartConnect}
              disabled={isSyncingGoogle || loadingLists}
              className={`${BTN} w-full justify-center`}
            >
              Trocar lista
            </button>
          </div>

          <button
            type="button"
            onClick={disconnectGoogleTasks}
            disabled={isSyncingGoogle}
            className={`${BTN} w-full justify-center text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20`}
          >
            <LogOut className="w-3.5 h-3.5" />
            Desconectar Google Tasks
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleStartConnect}
            disabled={loadingLists}
            className={`${BTN_PRIMARY} w-full`}
          >
            {loadingLists ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Conectando...
              </>
            ) : (
              <>
                <CheckSquare className="w-4 h-4" />
                Conectar Google Tasks
              </>
            )}
          </button>
        </div>
      )}

      {/* Modal de Escolha da Lista */}
      {availableLists && (
        <ModalShell labelledBy="choose-list-title" onClose={() => setAvailableLists(null)}>
          <div className="space-y-4">
            <h3 id="choose-list-title" className="text-sm font-semibold tracking-tight">
              Escolha uma lista do Google Tasks
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              O app sincronizará tarefas nos dois sentidos com a lista selecionada:
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {availableLists.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setSelectedListId(l.id)}
                  className={`w-full p-3 rounded-xl border text-left text-xs flex items-center justify-between transition-colors ${
                    selectedListId === l.id
                      ? 'border-zinc-950 dark:border-zinc-50 bg-zinc-100 dark:bg-zinc-800 font-medium'
                      : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                  }`}
                >
                  <span className="truncate">{l.title}</span>
                  {selectedListId === l.id && <Check className="w-4 h-4 shrink-0" />}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAvailableLists(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmList}
                disabled={!selectedListId}
                className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium bg-zinc-950 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-40"
              >
                Confirmar Lista
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </section>
  );
};
