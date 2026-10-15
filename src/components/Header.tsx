import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { Avatar } from './Avatar';
import { LogoMark } from './LogoMark';
import { type TabType } from '@/types/habit';
import { useHabits } from '@/context/HabitsContext';

const TABS: { id: TabType; label: string }[] = [
  { id: 'today', label: 'Foco Diário' },
  { id: 'stats', label: 'Grafo' },
  { id: 'pomo', label: 'Pomo' },
  { id: 'manage', label: 'Hábitos & Rotinas' }
];

interface HeaderProps {
  onOpenAccountModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenAccountModal }) => {
  const {
    darkMode,
    toggleDarkMode,
    syncState,
    user,
    activeTab,
    setActiveTab
  } = useHabits();

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
      <div className="flex items-center justify-between gap-4">
        {/* Marca Monocromática */}
        <div className="flex items-center gap-3">
          <LogoMark className="w-9 h-9" />
          <div>
            <h1 className="text-base font-semibold tracking-tight leading-none">
              MONO // HABITS
            </h1>
            <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mt-1">
              Consistência Diária Sem Distrações
            </p>
          </div>
        </div>

        {/* Ações Topo: Status Nuvem + Tema */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAccountModal}
            className="relative rounded-full hover:opacity-80 transition-opacity"
            title={`Conta Google e Nuvem · ${syncLabel}`}
            aria-label={`Conta Google e Nuvem · ${syncLabel}`}
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
            onClick={toggleDarkMode}
            className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title={darkMode ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
            aria-label="Alternar tema"
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
