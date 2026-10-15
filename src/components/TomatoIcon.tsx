import React from 'react';

interface TomatoIconProps {
  className?: string;
}

/** Tomate minimalista no mesmo traço dos ícones Lucide usados no app */
export const TomatoIcon: React.FC<TomatoIconProps> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M12 8.5c-4.7 0-8.5 2.7-8.5 6.5S7.3 21 12 21s8.5-2.2 8.5-6S16.7 8.5 12 8.5Z" />
    <path d="M12 8.5V4" />
    <path d="M12 8.5c-1-1.9-2.9-2.8-4.8-2.3" />
    <path d="M12 8.5c1-1.9 2.9-2.8 4.8-2.3" />
  </svg>
);
