import React from 'react';
import { Calendar, BarChart2, Layers, Plus } from 'lucide-react';
import { TomatoIcon } from './TomatoIcon';
import { useHabits } from '@/context/HabitsContext';
import { usePomo } from '@/context/PomoContext';
import { type TabType } from '@/types/habit';

interface BottomNavProps {
  onOpenCreateModal: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ onOpenCreateModal }) => {
  const { activeTab, setActiveTab } = useHabits();
  const { status } = usePomo();

  const renderTab = (id: TabType, label: string, icon: React.ReactNode) => {
    const isActive = activeTab === id;
    return (
      <button
        type="button"
        onClick={() => setActiveTab(id)}
        aria-current={isActive ? 'page' : undefined}
        className={`relative flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-colors ${
          isActive
            ? 'text-zinc-950 dark:text-zinc-50'
            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
        }`}
      >
        {icon}
        <span className="text-[10px] font-mono mt-1 font-medium">{label}</span>
      </button>
    );
  };

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white/90 dark:bg-[#09090b]/90 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 px-2 py-2 flex items-center pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
      {renderTab('today', 'Foco', <Calendar className="w-5 h-5" />)}
      {renderTab('stats', 'Grafo', <BarChart2 className="w-5 h-5" />)}

      {/* Botão Central Flutuante + (Thumb Zone Action) */}
      <div className="flex-1 flex justify-center -mt-6">
        <button
          type="button"
          onClick={onOpenCreateModal}
          className="w-12 h-12 rounded-2xl bg-zinc-950 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950 shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all border border-zinc-800 dark:border-zinc-200"
          aria-label="Criar novo hábito"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>
      </div>

      {renderTab(
        'pomo',
        'Pomo',
        <span className="relative">
          <TomatoIcon className="w-5 h-5" />
          {status === 'running' && (
            <span className="absolute -top-0.5 -right-1 w-1.5 h-1.5 rounded-full bg-zinc-950 dark:bg-zinc-50 animate-pulse" />
          )}
        </span>
      )}
      {renderTab('manage', 'Hábitos', <Layers className="w-5 h-5" />)}
    </nav>
  );
};
