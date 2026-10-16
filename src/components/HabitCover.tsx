import React from 'react';
import type { HabitCover as HabitCoverData } from '@/types/habit';
import { coverImageStyle, coverStyle } from '@/lib/covers';

interface HabitCoverProps {
  cover?: HabitCoverData;
  /** Proporção reservada (largura / altura); padrão 16/9. Use 1 para miniaturas quadradas. */
  aspectRatio?: number;
  /** Escala do ladrilho dos padrões (miniaturas usam < 1) */
  scale?: number;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Capa decorativa do hábito: padrão geométrico (CSS) ou imagem enviada. Preenche o contêiner
 * com proporção reservada (sem CLS). Sem capa, renderiza só o contêiner vazio com `children`.
 */
export const HabitCover = React.memo<HabitCoverProps>(function HabitCover({
  cover,
  aspectRatio = 16 / 9,
  scale = 1,
  className = '',
  children
}) {
  return (
    <div
      aria-hidden="true"
      className={`relative overflow-hidden ${className}`}
      style={{ aspectRatio: String(aspectRatio) }}
    >
      {cover?.type === 'pattern' && (
        <>
          <div className="absolute inset-0 dark:hidden" style={coverStyle(cover, 'light', scale)} />
          <div className="absolute inset-0 hidden dark:block" style={coverStyle(cover, 'dark', scale)} />
        </>
      )}
      {cover?.type === 'image' && (
        <img
          src={cover.dataUrl}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          style={coverImageStyle(cover)}
        />
      )}
      {children}
    </div>
  );
});
