'use client';

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import type { PlaceMarkerData } from '@/lib/types/map';
import type { Place } from '@/lib/types/context';
import { PlaceCard } from '@/components/places/PlaceCard';
import { PlaceDetailView } from '@/components/places/PlaceDetailView';
import { FilterBar } from '@/components/filters/FilterBar';

export interface DesktopSplitExplorerProps {
  places: PlaceMarkerData[];
  selectedPlace?: Place | null;
  selectedPlaceId?: string | null;
  onSelectPlace?: (place: PlaceMarkerData) => void;
  onClosePlace?: () => void;
  isRaining?: boolean;
}

export function DesktopSplitExplorer({
  places,
  selectedPlace,
  selectedPlaceId,
  onSelectPlace,
  onClosePlace,
  isRaining = false,
}: DesktopSplitExplorerProps) {
  return (
    <aside className="w-[440px] h-full flex flex-col bg-white border-r border-slate-200 shadow-sm shrink-0 z-10">
      {selectedPlace ? (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Header de retour à la liste */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
            <button
              type="button"
              onClick={onClosePlace}
              className="inline-flex min-h-[44px] items-center gap-2 px-3.5 py-1.5 text-sm font-semibold text-emerald-800 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
              aria-label="Retour aux spots"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>← Retour aux spots</span>
            </button>
          </div>

          {/* Fiche détaillée défilable */}
          <div className="flex-1 overflow-y-auto">
            <PlaceDetailView place={selectedPlace} onClose={onClosePlace} />
          </div>
        </div>
      ) : (
        <>
          <div className="p-4 border-b border-slate-100 space-y-3">
            <h1 className="font-bold text-slate-900 text-lg">
              Explorateur du Golfe
            </h1>
            <FilterBar isRaining={isRaining} />
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {places.length} lieu{places.length > 1 ? 'x' : ''} trouvé{places.length > 1 ? 's' : ''}
            </div>

            {places.map((place) => (
              <PlaceCard
                key={place.id}
                place={place}
                variant="compact"
                isSelected={place.id === selectedPlaceId || place.slug === selectedPlaceId}
                onSelect={onSelectPlace}
              />
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
