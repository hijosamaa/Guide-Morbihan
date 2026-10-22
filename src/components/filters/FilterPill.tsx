import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface FilterPillProps {
  /** Label affiché sur la pilule */
  label: string;
  /** Emoji ou icône optionnelle */
  icon?: string;
  /** État actif/inactif du filtre */
  isActive: boolean;
  /** Callback déclenché au clic */
  onClick: () => void;
  /** Classes CSS supplémentaires optionnelles */
  className?: string;
}

/**
 * Composant de pilule tactile optimisé mobile-first.
 * Garantit une cible tactile >= 48px (h-12), un retour haptique visuel (active:scale-[0.96]),
 * et une conformité d'accessibilité WCAG avec aria-pressed et focus-visible.
 */
export function FilterPill({
  label,
  icon,
  isActive,
  onClick,
  className,
}: FilterPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={twMerge(
        clsx(
          'h-12 px-4 rounded-full text-sm font-semibold whitespace-nowrap flex items-center gap-2 border select-none transition-transform duration-100 ease-out active:scale-[0.96] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2',
          isActive
            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
            : 'bg-white/95 text-slate-800 border-slate-300 hover:border-slate-400 shadow-sm',
          className
        )
      )}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      <span>{label}</span>
    </button>
  );
}
