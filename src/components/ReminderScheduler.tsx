import React from 'react';
import { useEffect } from 'react';
import { useHabits } from '@/context/HabitsContext';
import { useSettings } from '@/context/SettingsContext';
import { getLastReminderKey, setLastReminderKey } from '@/lib/storage';
import { showSystemNotification } from '@/lib/notifications';
import { shouldSendReminder } from '@/lib/settings';
import { getHabitsForDate } from '@/lib/analytics';
import { isDueOn } from '@/lib/weekly';
import { getGoalLock } from '@/lib/pomoGoals';
import { toDateKey } from '@/lib/dateUtils';

/**
 * Lembrete diário de hábitos pendentes.
 * Sem servidor de push, o aviso é disparado enquanto o app está aberto (inclusive em segundo
 * plano / PWA instalado). Não inclui nomes de hábitos, respeitando o Modo Discreto.
 * O botão "Marcar como feito" é tratado pelo Service Worker (src/sw.ts) e aplicado por CompletionQueueSync.
 */
export const ReminderScheduler: React.FC = () => {
  const { activeHabits, logs, pomoSessions, initialLoaded } = useHabits();
  const { settings } = useSettings();

  useEffect(() => {
    if (!settings.reminderEnabled || !initialLoaded) return;

    const check = () => {
      const now = new Date();
      const todayKey = toDateKey(now);
      // Hábitos semanais só contam como pendentes enquanto a meta da semana não foi cumprida
      const scheduled = getHabitsForDate(activeHabits, now).filter((h) => isDueOn(h, now, logs));
      const done = logs[todayKey] || [];
      const pending = scheduled.filter((h) => !done.includes(h.id));
      const pendingCount = pending.length;

      if (
        !shouldSendReminder({
          now,
          time: settings.reminderTime,
          lastSentKey: getLastReminderKey(),
          todayKey,
          pendingCount
        })
      ) {
        return;
      }
      setLastReminderKey(todayKey);
      // Com exatamente 1 pendente, oferece "Marcar como feito". O texto é sempre genérico (sem título),
      // então nada vaza com o Modo Discreto/hideTitle; com vários pendentes, o toque só abre o app.
      void showSystemNotification(
        'MONO // HABITS',
        pendingCount === 1 ? 'Falta 1 hábito para hoje.' : `Faltam ${pendingCount} hábitos para hoje.`,
        'daily-reminder',
        // Hábito com meta do Pomo ainda não cumprida não pode ser marcado: sem o botão
        pendingCount === 1 && !getGoalLock(pending[0], pomoSessions, todayKey)
          ? {
              actions: [{ action: 'complete', title: 'Marcar como feito' }],
              data: { habitId: pending[0].id, dateKey: todayKey }
            }
          : {}
      );
    };

    check();
    const id = window.setInterval(check, 30_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, [settings.reminderEnabled, settings.reminderTime, activeHabits, logs, pomoSessions, initialLoaded]);

  return null;
};
