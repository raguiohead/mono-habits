import React from 'react';

export const BTN =
  'min-h-[44px] px-4 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2';
export const BTN_PRIMARY =
  'min-h-[44px] px-4 rounded-xl text-xs font-medium bg-zinc-950 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2';

export const SectionTitle: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <h4 className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
    {icon}
    {children}
  </h4>
);

export const Switch: React.FC<{
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}> = ({ label, description, checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className="w-full min-h-[44px] flex items-center justify-between gap-4 py-2 text-left"
  >
    <span>
      <span className="block text-xs font-medium">{label}</span>
      {description && (
        <span className="block text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{description}</span>
      )}
    </span>
    <span
      aria-hidden="true"
      className={`relative shrink-0 w-10 h-6 rounded-full border transition-colors ${
        checked
          ? 'bg-zinc-950 border-zinc-950 dark:bg-zinc-50 dark:border-zinc-50'
          : 'bg-zinc-200 border-zinc-300 dark:bg-zinc-800 dark:border-zinc-700'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform ${
          checked
            ? 'translate-x-4 bg-zinc-50 dark:bg-zinc-950'
            : 'translate-x-0 bg-white dark:bg-zinc-400'
        }`}
      />
    </span>
  </button>
);
