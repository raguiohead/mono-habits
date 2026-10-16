import React from 'react';
import { useSettings } from '@/context/SettingsContext';

export const SkeletonLoader: React.FC = () => {
  const { settings } = useSettings();
  const gallery = settings.focusLayout === 'gallery';
  return (
    <div className="space-y-6 animate-pulse">
      {/* Skeleton Header */}
      <div className="h-10 w-48 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />

      {/* Skeleton Week Strip */}
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-zinc-200 dark:bg-zinc-800/60" />
        ))}
      </div>

      {/* Skeleton Card */}
      <div className="h-24 rounded-2xl bg-zinc-200 dark:bg-zinc-800/60" />

      {/* Skeleton Items */}
      {gallery ? (
        // Mesma proporção dos cartões da galeria (capa 16:9 + corpo), sem salto de layout
        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl overflow-hidden bg-zinc-200 dark:bg-zinc-800/40">
              <div className="w-full bg-zinc-300/60 dark:bg-zinc-800/80" style={{ aspectRatio: '16 / 9' }} />
              <div className="h-24" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-zinc-200 dark:bg-zinc-800/40" />
          ))}
        </div>
      )}
    </div>
  );
};
