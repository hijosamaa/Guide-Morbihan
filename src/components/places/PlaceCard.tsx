'use client';

import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { MapPin } from 'lucide-react';
import type { PlaceMarkerData } from '@/lib/types/map';
import { ContextBadge } from './ContextBadge';

export interface PlaceCardProps {
  place: PlaceMarkerData;
  variant?: 'compact' | 'rich';
  isSelected?: boolean;
  onSelect?: (place: PlaceMarkerData) => void;
  className?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  BEACH: 'Plage & Crique',
  TRAIL: 'Sentier & Randonnée',
  HERITAGE: 'Patrimoine & Histoire',
  GASTRONOMY: 'Huîtres & Terroir',
  NAUTICAL: 'Nautisme & Cale',
  VIEWPOINT: 'Point de vue',
};

export function PlaceCard({
  place,
  variant = 'compact',
  isSelected = false,
  onSelect,
  className,
}: PlaceCardProps) {
  const categoryLabel = CATEGORY_LABELS[place.category] || place.category;

  if (variant === 'rich') {
    return (
      <article
        id={`spot-card-${place.id}`}
        role="button"
        tabIndex={0}
        aria-pressed={isSelected}
        onClick={() => onSelect?.(place)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect?.(place);
          }
        }}
        className={twMerge(
          clsx(
            'group flex flex-col rounded-2xl bg-white border border-slate-200/90 shadow-sm overflow-hidden cursor-pointer transition-transform duration-100 ease-out active:scale-[0.985] text-left select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
            isSelected && 'ring-2 ring-emerald-500 shadow-md',
            className
          )
        )}
      >
        <div className="relative aspect-video w-full bg-slate-100 flex items-center justify-center overflow-hidden">
          {place.imageUrl ? (
            <img
              src={place.imageUrl}
              alt={place.name}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
              <span className="text-4xl select-none" aria-hidden="true">
                {place.category === 'BEACH' ? '🏖️' : place.category === 'TRAIL' ? '🥾' : '🌊'}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 to-transparent z-10" />
          <div className="absolute top-3 right-3 z-20">
            <ContextBadge status={place.status} customLabel={place.label} />
          </div>
          <div className="absolute bottom-3 left-3 z-20">
            <span className="inline-block px-2.5 py-0.5 text-xs font-medium text-white/95 bg-black/40 backdrop-blur-sm rounded-full">
              {categoryLabel}
            </span>
          </div>
        </div>

        <div className="p-4 flex flex-col flex-1">
          <h3 className="font-bold text-slate-900 text-lg leading-snug group-hover:text-emerald-700 transition-colors">
            {place.name}
          </h3>
          <p className="mt-1 text-sm text-slate-500 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
            <span>Golfe du Morbihan</span>
          </p>
        </div>
      </article>
    );
  }

  return (
    <div
      id={`spot-card-${place.id}`}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onClick={() => onSelect?.(place)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.(place);
        }
      }}
      className={twMerge(
        clsx(
          'flex items-center gap-3.5 p-3 rounded-xl bg-white border border-slate-200/80 shadow-sm cursor-pointer transition-transform duration-100 ease-out active:scale-[0.98] select-none text-left touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
          isSelected && 'ring-2 ring-emerald-500 bg-emerald-50/25 border-emerald-300',
          className
        )
      )}
    >
      <div className="relative w-20 h-20 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden border border-slate-200/50">
        {place.imageUrl ? (
          <img
            src={place.imageUrl}
            alt={place.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-2xl select-none" aria-hidden="true">
            {place.category === 'BEACH' ? '🏖️' : place.category === 'TRAIL' ? '🥾' : '🌊'}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0 pr-1">
        <h4 className="font-semibold text-slate-900 text-sm truncate">
          {place.name}
        </h4>
        <p className="text-xs text-slate-500 mt-0.5 truncate">
          {categoryLabel}
        </p>
        <div className="mt-2">
          <ContextBadge status={place.status} customLabel={place.label} />
        </div>
      </div>
    </div>
  );
}
