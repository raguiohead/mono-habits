import React from 'react';
import { Sun, Moon, Cloud, CheckCircle2 } from 'lucide-react';
import { useHabits } from '@/context/HabitsContext';

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

  const getSyncBadge = () => {
    if (syncState === 'synced' && user) {
      return (
        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300">
          <CheckCircle2 className="w-3 h-3 text-zinc-400" />
          <span className="hidden sm:inline">Nuvem Ativa</span>
        </span>
      );
    }
    if (syncState === 'connecting') {
      return (
        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 text-zinc-500">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse" />
          <span className="hidden sm:inline">Conectando...</span>
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 text-zinc-500">
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
        <span className="hidden sm:inline">Modo Local</span>
      </span>
    );
  };

  return (
    <header className="flex flex-col gap-5 pb-6 border-b border-zinc-200 dark:border-zinc-800/80">
      <div className="flex items-center justify-between gap-4">
        {/* Marca Monocromática */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-mono font-bold text-sm tracking-tighter bg-zinc-950 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950 shadow-xs">
            M//H
          </div>
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
            className="flex items-center gap-2 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Conta Google e Nuvem"
            aria-label="Conta Google e Nuvem"
          >
            <Cloud className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
            {getSyncBadge()}
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
      <nav className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800 text-xs font-medium">
        <button
          onClick={() => setActiveTab('today')}
          className={`flex-1 py-2 px-3 rounded-lg transition-all text-center ${
            activeTab === 'today'
              ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-xs font-semibold'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          Foco Diário
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`flex-1 py-2 px-3 rounded-lg transition-all text-center ${
            activeTab === 'stats'
              ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-xs font-semibold'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          Consistência (90d)
        </button>
        <button
          onClick={() => setActiveTab('manage')}
          className={`flex-1 py-2 px-3 rounded-lg transition-all text-center ${
            activeTab === 'manage'
              ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-xs font-semibold'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          Hábitos & Rotinas
        </button>
      </nav>
    </header>
  );
};
