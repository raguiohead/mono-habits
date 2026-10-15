import React from 'react';

export const SkeletonLoader: React.FC = () => {
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
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-2xl bg-zinc-200 dark:bg-zinc-800/40" />
        ))}
      </div>
    </div>
  );
};
