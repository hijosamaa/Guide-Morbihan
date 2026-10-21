'use client';

import React from 'react';
import { Plus, Minus, Compass, Navigation } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

export interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetCenter: () => void;
  onLocateUser?: () => void;
  isLocating?: boolean;
  className?: string;
}

export function MapControls({
  onZoomIn,
  onZoomOut,
  onResetCenter,
  onLocateUser,
  isLocating = false,
  className = '',
}: MapControlsProps) {
  return (
    <div
      className={twMerge('absolute right-4 bottom-8 flex flex-col gap-2 z-10', className)}
      role="toolbar"
      aria-label="Contrôles de la carte"
    >
      {onLocateUser && (
        <button
          type="button"
          onClick={onLocateUser}
          disabled={isLocating}
          className="w-10 h-10 rounded-full bg-white/95 backdrop-blur-sm text-slate-700 shadow-md flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
          aria-label="Autour de moi"
          title="Autour de moi"
        >
          <Navigation className={`w-4 h-4 ${isLocating ? 'animate-spin text-sky-600' : ''}`} />
        </button>
      )}

      <button
        type="button"
        onClick={onResetCenter}
        className="w-10 h-10 rounded-full bg-white/95 backdrop-blur-sm text-slate-700 shadow-md flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-sky-500"
        aria-label="Recentrer sur le Golfe"
        title="Recentrer sur le Golfe"
      >
        <Compass className="w-5 h-5 text-slate-700" />
      </button>

      <div className="flex flex-col bg-white/95 backdrop-blur-sm rounded-full shadow-md overflow-hidden divide-y divide-slate-100">
        <button
          type="button"
          onClick={onZoomIn}
          className="w-10 h-10 text-slate-700 flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-sky-500"
          aria-label="Zoom avant"
          title="Zoom avant"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onZoomOut}
          className="w-10 h-10 text-slate-700 flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-sky-500"
          aria-label="Zoom arrière"
          title="Zoom arrière"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
