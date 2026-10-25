import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { loadSettings, saveSettings } from '@/lib/storage';
import { TEXT_SIZE_PX, type AppSettings } from '@/lib/settings';
import { displayTitle, isDiscreetNow, isHabitHidden } from '@/lib/discreet';
import type { Habit } from '@/types/habit';
import { logUsage, setUsageEnabled } from '@/lib/usageClient';

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  /** Modo discreto global ativo agora (configuração, janela automática ou alternância rápida) */
  discreet: boolean;
  /** Alterna o modo discreto até recarregar o app ou mudar a configuração */
  toggleDiscreet: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());

  // Reavalia a janela automática a cada 30 s e ao voltar o foco para o app
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, 30_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Alternância rápida (botão de olho / ?discreet=1): vale até recarregar ou mudar a configuração
  const [override, setOverride] = useState<boolean | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('discreet') === '1' ? true : null;
    } catch {
      return null;
    }
  });
  useEffect(() => {
    // Tira ?discreet=1 da URL para o parâmetro não ficar salvo em favoritos/histórico
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('discreet')) {
        url.searchParams.delete('discreet');
        window.history.replaceState(null, '', url.pathname + url.search + url.hash);
      }
    } catch {
      /* sem history */
    }
  }, []);

  const configured = useMemo(() => isDiscreetNow(settings, now), [settings, now]);
  const discreet = override ?? configured;
  const toggleDiscreet = useCallback(() => {
    const next = !(override ?? configured);
    setOverride(next);
    logUsage('discreet_toggle', { enabled: next });
  }, [override, configured]);

  // Estatísticas de uso: só carregam e enviam com o consentimento ligado
  useEffect(() => {
    void setUsageEnabled(settings.analyticsEnabled);
  }, [settings.analyticsEnabled]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    if ('discreetMode' in patch || 'discreetFrom' in patch || 'discreetTo' in patch) setOverride(null);
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  // Aplica acessibilidade no <html>: o Tailwind usa rem, então a fonte-base escala toda a interface
  useEffect(() => {
    const root = document.documentElement;
    root.style.fontSize = `${TEXT_SIZE_PX[settings.textSize]}px`;
    root.classList.toggle('high-contrast', settings.highContrast);
    root.classList.toggle('reduce-motion', settings.motion === 'reduce');
    root.classList.toggle('full-motion', settings.motion === 'full');
  }, [settings.textSize, settings.highContrast, settings.motion]);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, discreet, toggleDiscreet }}>{children}</SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings deve ser utilizado dentro de um SettingsProvider');
  }
  return context;
};

/** Modo discreto global: use `titleOf(habit)` e `isHidden(habit)` em vez de habit.title / habit.hideTitle */
export const useDiscreet = () => {
  const { discreet, toggleDiscreet } = useSettings();
  return {
    active: discreet,
    toggle: toggleDiscreet,
    isHidden: (habit: Pick<Habit, 'hideTitle'>) => isHabitHidden(habit, discreet),
    titleOf: (habit: Pick<Habit, 'title' | 'hideTitle'>, hidden?: string) => displayTitle(habit, discreet, hidden)
  };
};
