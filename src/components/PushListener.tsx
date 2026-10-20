import { useEffect } from 'react';
import { useHabits } from '@/context/HabitsContext';
import { useSettings } from '@/context/SettingsContext';
import { isPushConfigured, onForegroundPush } from '@/lib/pushClient';
import { pushToastText } from '@/lib/push';

/** Com os avisos por push ligados, mostra em um toast as mensagens recebidas com o app aberto */
export const PushListener: React.FC = () => {
  const { showToast } = useHabits();
  const { settings, updateSettings } = useSettings();

  useEffect(() => {
    if (!settings.pushEnabled || !isPushConfigured()) return;
    // Permissão revogada no navegador: desliga a opção para não prometer o que não funciona
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      updateSettings({ pushEnabled: false });
      return;
    }
    let off: () => void = () => undefined;
    let cancelled = false;
    void onForegroundPush((payload) => {
      const text = pushToastText(payload);
      if (text) showToast(text);
    }).then((unsubscribe) => {
      if (cancelled) unsubscribe();
      else off = unsubscribe;
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [settings.pushEnabled, showToast, updateSettings]);

  return null;
};
