import { useEffect } from 'react';
import { useHabits } from '@/context/HabitsContext';
import { useSettings } from '@/context/SettingsContext';
import { isPushBlocked, isPushConfigured, onForegroundPush } from '@/lib/pushClient';
import { pushToastText } from '@/lib/push';

/** Com os avisos por push ligados, mostra em um toast as mensagens recebidas com o app aberto */
export const PushListener: React.FC = () => {
  const { showToast } = useHabits();
  const { settings, updateSettings } = useSettings();

  useEffect(() => {
    if (!settings.pushEnabled || !isPushConfigured()) return;
    let off: () => void = () => undefined;
    let cancelled = false;
    // Permissão revogada no sistema ou no navegador: desliga a opção para não prometer o que não funciona
    void isPushBlocked().then((blocked) => {
      if (blocked && !cancelled) updateSettings({ pushEnabled: false });
    });
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
