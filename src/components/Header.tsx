import React from 'react';
import { Sun, Moon, Settings, Eye, EyeOff } from 'lucide-react';
import { Avatar } from './Avatar';
import { LogoMark } from './LogoMark';
import { type TabType } from '@/types/habit';
import { useHabits } from '@/context/HabitsContext';
import { useDiscreet } from '@/context/SettingsContext';

const TABS: { id: TabType; label: string }[] = [
  { id: 'today', label: 'Foco Diário' },
  { id: 'stats', label: 'Grafo' },
  { id: 'pomo', label: 'Pomo' },
  { id: 'manage', label: 'Hábitos & Rotinas' }
];

interface HeaderProps {
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings }) => {
  const {
    darkMode,
    toggleDarkMode,
    syncState,
    user,
    activeTab,
    setActiveTab
  } = useHabits();

  const { active: discreet, toggle: toggleDiscreet } = useDiscreet();

  const syncDot =
    syncState === 'synced' && user
      ? 'bg-zinc-950 dark:bg-zinc-50'
      : syncState === 'connecting'
      ? 'bg-zinc-400 animate-pulse'
      : 'bg-transparent border border-zinc-400';
  const syncLabel =
    syncState === 'synced' && user ? 'Nuvem ativa' : syncState === 'connecting' ? 'Conectando' : 'Modo local';

  return (
    <header className="flex flex-col gap-5 pb-6 border-b border-zinc-200 dark:border-zinc-800/80">
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        {/* Marca Monocromática */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <LogoMark className="w-8 h-8 sm:w-9 sm:h-9 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-[15px] sm:text-base font-semibold tracking-tight leading-none whitespace-nowrap">
              MONO // HABITS
            </h1>
            <p className="hidden sm:block text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mt-1">
              Consistência Diária Sem Distrações
            </p>
          </div>
        </div>

        {/* Ações Topo: Status Nuvem + Tema */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={toggleDiscreet}
            aria-pressed={discreet}
            className="w-11 h-11 flex items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title={discreet ? 'Modo discreto ligado: mostrar títulos' : 'Modo discreto desligado: ocultar títulos'}
            aria-label={discreet ? 'Desativar modo discreto' : 'Ativar modo discreto'}
          >
            {discreet ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button
            onClick={onOpenSettings}
            className="relative w-11 h-11 flex items-center justify-center rounded-full hover:opacity-80 transition-opacity"
            title={`Conta e configurações · ${syncLabel}`}
            aria-label={`Abrir conta e configurações · ${syncLabel}`}
          >
            <Avatar
              photoURL={user?.photoURL}
              name={user?.displayName || user?.email}
              className="w-9 h-9"
            />
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-[#FAFAFA] dark:ring-[#09090B] ${syncDot}`}
            />
          </button>

          <button
            onClick={onOpenSettings}
            className="w-11 h-11 flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Configurações"
            aria-label="Configurações"
          >
            <Settings className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
          </button>

          <button
            onClick={toggleDarkMode}
            className="w-11 h-11 flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title={darkMode ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
            aria-label="Alternar tema"
            aria-pressed={darkMode}
          >
            {darkMode ? (
              <Sun className="w-4 h-4 text-zinc-300" />
            ) : (
              <Moon className="w-4 h-4 text-zinc-700" />
            )}
          </button>
        </div>
      </div>

      {/* Navegação por Abas (Desktop & Tablets) */}
      <nav className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800 text-xs font-medium">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 px-2 sm:px-3 rounded-lg transition-all text-center ${
              activeTab === tab.id
                ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-xs font-semibold'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  );
};
