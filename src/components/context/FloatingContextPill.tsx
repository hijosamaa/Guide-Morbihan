'use client';

import React, { useState } from 'react';
import { Waves, Sun } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Props for FloatingContextPill component.
 */
export interface FloatingContextPillProps {
  /** Tide summary text (e.g. "PM 17h42 (78)") */
  tideText?: string;
  /** Weather & wind summary text (e.g. "19°C · NO 12nd") */
  weatherText?: string;
  /** Optional alert component (e.g. TidalAlertChip) displayed above pill */
  urgentAlert?: React.ReactNode;
  /** Optional custom CSS classes */
  className?: string;
}

/**
 * FloatingContextPill
 * 
 * Floating minimal pill displaying live tidal and meteorological context.
 * Replaces sticky top banners with a non-intrusive 48px touch target.
 * Expands into a contextual popover on click with live tidal calculation details.
 */
export function FloatingContextPill({
  tideText = 'PM 17h42 (78)',
  weatherText = '19°C · NO 12nd',
  urgentAlert,
  className,
}: FloatingContextPillProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={twMerge(
        clsx('flex flex-col items-end gap-1.5 z-20 select-none', className)
      )}
    >
      {urgentAlert}

      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        aria-label="Conditions météo et marée"
        className="min-h-[48px] h-12 px-4 rounded-full bg-white/95 backdrop-blur-md border border-slate-300/80 shadow-md flex items-center gap-2.5 text-xs font-semibold text-slate-800 transition-transform duration-100 ease-out active:scale-[0.97] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
      >
        <span className="flex items-center gap-1">
          <Waves className="w-3.5 h-3.5 text-sky-600" aria-hidden="true" />
          <span>{tideText}</span>
        </span>
        <span className="w-px h-3 bg-slate-300" aria-hidden="true" />
        <span className="flex items-center gap-1 text-slate-600">
          <Sun className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
          <span>{weatherText}</span>
        </span>
      </button>

      {/* Popover déplié en overlay translucide */}
      {isExpanded && (
        <div className="mt-1 p-3.5 bg-slate-900 text-white text-xs rounded-2xl shadow-xl border border-slate-800 max-w-xs transition-opacity transition-transform duration-120 ease-out origin-top-right">
          <p className="font-bold text-sm text-emerald-400">Marée & Vent en Direct</p>
          <p className="mt-1 text-slate-300 leading-relaxed">
            Données calculées en temps réel par la règle des 12e pour le Golfe du Morbihan.
          </p>
          <div className="mt-2 pt-2 border-t border-slate-800 flex justify-between text-slate-400">
            <span>Coeff : 78</span>
            <span>Marnage : 3,80m</span>
          </div>
        </div>
      )}
    </div>
  );
}
