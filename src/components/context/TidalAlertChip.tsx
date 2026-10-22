import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Props for TidalAlertChip component.
 */
export interface TidalAlertChipProps {
  /** Name of the submersible passage (e.g. "Passage de Berder", "Tascon") */
  passageName: string;
  /** Minutes remaining before passage submersion/closure */
  minutesRemaining: number;
  /** Whether the submersible passage is currently passable */
  isOpen: boolean;
  /** Optional custom CSS classes */
  className?: string;
}

/**
 * TidalAlertChip
 * 
 * Displays an urgent submersible passage warning chip.
 * STRICT BUSINESS RULE: Only renders when the passage is currently open
 * and closing in 45 minutes or less (minutesRemaining > 0 and <= 45).
 */
export function TidalAlertChip({
  passageName,
  minutesRemaining,
  isOpen,
  className = '',
}: TidalAlertChipProps) {
  // RÈGLE MÉTIER STRICTE : N'apparaît que si le passage est ouvert mais ferme dans moins de 45 minutes
  if (!isOpen || minutesRemaining > 45 || minutesRemaining <= 0) {
    return null;
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500 text-slate-950 font-bold text-xs rounded-full shadow-md animate-pulse border border-amber-600 ${className}`}
      role="alert"
    >
      <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>
        {passageName} : Fermeture dans{' '}
        <span className="font-mono tabular-nums">{`${minutesRemaining} min`}</span>
      </span>
    </div>
  );
}
