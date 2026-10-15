import React, { useEffect, useRef } from 'react';

interface ModalShellProps {
  labelledBy: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Classes de largura máxima do painel (padrão: max-w-md) */
  widthClass?: string;
}

/**
 * Casca de modal acessível: role="dialog", fecha com Esc ou clique no fundo,
 * prende o foco dentro do painel e o devolve ao elemento anterior ao fechar.
 * Bottom sheet em telas < 640px.
 */
export const ModalShell: React.FC<ModalShellProps> = ({
  labelledBy,
  onClose,
  children,
  widthClass = 'sm:max-w-md'
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusables = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      );
    focusables()[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${widthClass} rounded-t-3xl sm:rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] text-zinc-950 dark:text-zinc-50 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] shadow-2xl max-h-[92vh] overflow-y-auto`}
      >
        {children}
      </div>
    </div>
  );
};
