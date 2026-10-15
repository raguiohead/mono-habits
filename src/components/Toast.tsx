import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useHabits } from '@/context/HabitsContext';

export const Toast: React.FC = () => {
  const { toastMessage } = useHabits();

  if (!toastMessage) return null;

  return (
    <aside
      aria-label="Notificações"
      className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl border text-xs font-medium shadow-xl transition-all animate-bounceIn bg-zinc-950 text-zinc-50 border-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:border-zinc-200"
    >
      <CheckCircle2 className="w-4 h-4 shrink-0 text-zinc-400 dark:text-zinc-600" />
      <span>{toastMessage}</span>
    </aside>
  );
};
