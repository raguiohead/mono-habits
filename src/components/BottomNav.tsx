import React from 'react';
import { Calendar, BarChart2, Layers, Plus } from 'lucide-react';
import { useHabits } from '@/context/HabitsContext';

interface BottomNavProps {
  onOpenCreateModal: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ onOpenCreateModal }) => {
  const { activeTab, setActiveTab } = useHabits();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white/90 dark:bg-[#09090b]/90 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 px-4 py-2 flex items-center justify-around pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
      {/* Aba Foco Diário */}
      <button
        type="button"
        onClick={() => setActiveTab('today')}
        className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-colors ${
          activeTab === 'today'
            ? 'text-zinc-950 dark:text-zinc-50'
            : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
        }`}
      >
        <Calendar className="w-5 h-5" />
        <span className="text-[10px] font-mono mt-1 font-medium">Foco</span>
      </button>

      {/* Botão Central Flutuante + (Thumb Zone Action) */}
      <div className="-mt-6">
        <button
          type="button"
          onClick={onOpenCreateModal}
          className="w-12 h-12 rounded-2xl bg-zinc-950 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950 shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all border border-zinc-800 dark:border-zinc-200"
          aria-label="Criar novo hábito"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>
      </div>

      {/* Aba Consistência */}
      <button
        type="button"
        onClick={() => setActiveTab('stats')}
        className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-colors ${
          activeTab === 'stats'
            ? 'text-zinc-950 dark:text-zinc-50'
            : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
        }`}
      >
        <BarChart2 className="w-5 h-5" />
        <span className="text-[10px] font-mono mt-1 font-medium">90 Dias</span>
      </button>

      {/* Aba Hábitos */}
      <button
        type="button"
        onClick={() => setActiveTab('manage')}
        className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-colors ${
          activeTab === 'manage'
            ? 'text-zinc-950 dark:text-zinc-50'
            : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
        }`}
      >
        <Layers className="w-5 h-5" />
        <span className="text-[10px] font-mono mt-1 font-medium">Hábitos</span>
      </button>
    </nav>
  );
};
