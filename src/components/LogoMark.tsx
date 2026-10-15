import React from 'react';

interface LogoMarkProps {
  className?: string;
}

/**
 * Logo M//H em SVG: escala com o container e nunca quebra linha,
 * diferente do texto em caixa fixa que quebrava em telas pequenas.
 */
export const LogoMark: React.FC<LogoMarkProps> = ({ className = 'w-9 h-9' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 36 36"
    className={`shrink-0 ${className}`}
    role="img"
    aria-label="MONO // HABITS"
  >
    <rect width="36" height="36" rx="10" className="fill-zinc-950 dark:fill-zinc-50" />
    <text
      x="18"
      y="22.5"
      textAnchor="middle"
      fontFamily="'JetBrains Mono', ui-monospace, monospace"
      fontSize="12.5"
      fontWeight="700"
      textLength="26"
      lengthAdjust="spacingAndGlyphs"
      className="fill-zinc-50 dark:fill-zinc-950"
    >
      M//H
    </text>
  </svg>
);
