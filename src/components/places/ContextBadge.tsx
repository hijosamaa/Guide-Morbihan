import React from 'react';
import { CheckCircle2, AlertTriangle, Ban, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { EvaluationStatus } from '@/lib/types/context';

export interface ContextBadgeProps {
  status: EvaluationStatus | 'SPONSORED';
  customLabel?: string;
  className?: string;
}

const BADGE_CONFIG = {
  IDEAL: {
    bg: 'bg-emerald-50 text-emerald-900 border-emerald-600',
    icon: CheckCircle2,
    defaultLabel: 'Idéal maintenant',
  },
  WARNING: {
    bg: 'bg-amber-50 text-amber-900 border-amber-600',
    icon: AlertTriangle,
    defaultLabel: 'Vigilance marée',
  },
  DISCOURAGED: {
    bg: 'bg-slate-100 text-slate-900 border-slate-500',
    icon: Ban,
    defaultLabel: 'Déconseillé à cette heure',
  },
  SPONSORED: {
    bg: 'bg-yellow-50 text-yellow-950 border-yellow-600',
    icon: Sparkles,
    defaultLabel: 'Coup de cœur',
  },
};

export function ContextBadge({ status, customLabel, className }: ContextBadgeProps) {
  const config = BADGE_CONFIG[status] || BADGE_CONFIG.DISCOURAGED;
  const Icon = config.icon;
  const label = customLabel || config.defaultLabel;

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border',
          config.bg,
          className
        )
      )}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
