import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loadSettings, saveSettings } from '@/lib/storage';
import { TEXT_SIZE_PX, type AppSettings } from '@/lib/settings';

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
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
    <SettingsContext.Provider value={{ settings, updateSettings }}>{children}</SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings deve ser utilizado dentro de um SettingsProvider');
  }
  return context;
};
