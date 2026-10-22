'use client';

import React from 'react';
import type { PlaceMarkerData } from '@/lib/types/map';
import { PlaceCard } from '@/components/places/PlaceCard';
import { FilterBar } from '@/components/filters/FilterBar';

export interface DesktopSplitExplorerProps {
  places: PlaceMarkerData[];
  selectedPlaceId?: string | null;
  onSelectPlace?: (place: PlaceMarkerData) => void;
  isRaining?: boolean;
}

export function DesktopSplitExplorer({
  places,
  selectedPlaceId,
  onSelectPlace,
  isRaining = false,
}: DesktopSplitExplorerProps) {
  return (
    <aside className="w-[440px] h-full flex flex-col bg-white border-r border-slate-200 shadow-sm shrink-0 z-10">
      <div className="p-4 border-b border-slate-100 space-y-3">
        <h1 className="font-bold text-slate-900 text-lg">
          Explorateur du Golfe
        </h1>
        <FilterBar isRaining={isRaining} />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {places.length} lieu{places.length > 1 ? 'x' : ''} trouvés
        </div>

        {places.map((place) => (
          <PlaceCard
            key={place.id}
            place={place}
            variant="compact"
            isSelected={place.id === selectedPlaceId}
            onSelect={onSelectPlace}
          />
        ))}
      </div>
    </aside>
  );
}
