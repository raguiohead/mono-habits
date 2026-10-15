import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useHabits } from '@/context/HabitsContext';

export const Toast: React.FC = () => {
  const { toastMessage, toastAction } = useHabits();

  if (!toastMessage) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      aria-label="Notificações"
      className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl border text-xs font-medium shadow-xl transition-all animate-bounceIn bg-zinc-950 text-zinc-50 border-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:border-zinc-200"
    >
      <CheckCircle2 className="w-4 h-4 shrink-0 text-zinc-400 dark:text-zinc-600" />
      <span>{toastMessage}</span>
      {toastAction && (
        <button
          type="button"
          onClick={() => {
            toastAction.onClick();
          }}
          className="relative ml-1 shrink-0 font-mono underline underline-offset-2 hover:opacity-80 before:absolute before:-inset-x-2 before:-inset-y-3 before:content-['']"
        >
          {toastAction.label}
        </button>
      )}
    </aside>
  );
};
