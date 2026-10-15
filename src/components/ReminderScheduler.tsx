import React from 'react';
import { useEffect } from 'react';
import { useHabits } from '@/context/HabitsContext';
import { useSettings } from '@/context/SettingsContext';
import { getLastReminderKey, setLastReminderKey } from '@/lib/storage';
import { showSystemNotification } from '@/lib/notifications';
import { shouldSendReminder } from '@/lib/settings';
import { getHabitsForDay } from '@/lib/analytics';
import { toDateKey } from '@/lib/dateUtils';
import { registerPushToken, syncReminderPrefs } from '@/lib/messaging';

/**
 * Lembrete diário de hábitos pendentes.
 * O aviso local dispara enquanto o app está aberto; com o app fechado, a Cloud Function
 * `sendDailyReminders` envia o push (mesma tag, então um substitui o outro). Não inclui nomes de hábitos, respeitando o Modo Discreto.
 */
export const ReminderScheduler: React.FC = () => {
  const { activeHabits, logs, initialLoaded, user } = useHabits();
  const { settings } = useSettings();

  // Push em segundo plano: publica a preferência (horário/fuso) para a Cloud Function
  // e mantém o token FCM deste dispositivo atualizado enquanto o lembrete estiver ativo
  useEffect(() => {
    if (!user) return;
    void syncReminderPrefs(user.uid, {
      reminderEnabled: settings.reminderEnabled,
      reminderTime: settings.reminderTime
    });
    if (settings.reminderEnabled) void registerPushToken(user.uid);
  }, [settings.reminderEnabled, settings.reminderTime, user]);

  useEffect(() => {
    if (!settings.reminderEnabled || !initialLoaded) return;

    const check = () => {
      const now = new Date();
      const todayKey = toDateKey(now);
      const scheduled = getHabitsForDay(activeHabits, now.getDay());
      const done = logs[todayKey] || [];
      const pendingCount = scheduled.filter((h) => !done.includes(h.id)).length;

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
      void showSystemNotification(
        'MONO // HABITS',
        pendingCount === 1 ? 'Falta 1 hábito para hoje.' : `Faltam ${pendingCount} hábitos para hoje.`,
        'daily-reminder'
      );
    };

    check();
    const id = window.setInterval(check, 30_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, [settings.reminderEnabled, settings.reminderTime, activeHabits, logs, initialLoaded]);

  return null;
};
