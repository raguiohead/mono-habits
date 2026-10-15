import React, { useEffect, useRef } from 'react';
import { useHabits } from '@/context/HabitsContext';
import { QUEUE_MESSAGE_TYPE, drainCompletions } from '@/lib/completionQueue';

/**
 * Aplica as conclusões feitas pelo botão "Marcar como feito" da notificação.
 * O Service Worker grava a fila em IndexedDB; aqui ela é lida (e esvaziada) quando o app carrega,
 * quando o SW avisa que chegou item novo e quando o app volta ao primeiro plano.
 */
export const CompletionQueueSync: React.FC = () => {
  const { initialLoaded, habits, completeHabit, showToast } = useHabits();

  // Refs para os ouvintes sempre usarem os dados mais recentes sem reassinar a cada mudança
  const habitsRef = useRef(habits);
  habitsRef.current = habits;
  const completeRef = useRef(completeHabit);
  completeRef.current = completeHabit;
  const toastRef = useRef(showToast);
  toastRef.current = showToast;
  const busyRef = useRef(false);

  useEffect(() => {
    if (!initialLoaded || typeof indexedDB === 'undefined') return;

    const apply = async () => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        const items = await drainCompletions();
        let applied = 0;
        for (const item of items) {
          // Ignora hábitos que foram excluídos desde que a notificação foi exibida
          if (!habitsRef.current.some((h) => h.id === item.habitId)) continue;
          if (await completeRef.current(item.habitId, item.dateKey)) applied++;
        }
        if (applied > 0) {
          toastRef.current(applied === 1 ? 'Hábito marcado como feito pela notificação.' : `${applied} hábitos marcados como feitos pela notificação.`);
        }
      } catch (err) {
        console.warn('[Notificação] Falha ao aplicar a fila de conclusões:', err);
      } finally {
        busyRef.current = false;
      }
    };

    void apply();

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === QUEUE_MESSAGE_TYPE) void apply();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void apply();
    };
    navigator.serviceWorker?.addEventListener('message', onMessage);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', onMessage);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [initialLoaded]);

  return null;
};
