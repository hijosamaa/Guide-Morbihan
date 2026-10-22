'use client';

import React, { useState } from 'react';
import { Drawer } from 'vaul';
import type { PlaceMarkerData } from '@/lib/types/map';
import { PlaceCard } from '@/components/places/PlaceCard';
import { FilterBar } from '@/components/filters/FilterBar';

export interface MobileExplorerSheetProps {
  places: PlaceMarkerData[];
  selectedPlaceId?: string | null;
  onSelectPlace?: (place: PlaceMarkerData) => void;
  isRaining?: boolean;
  activeSnapPoint?: string | number | null;
  onSnapChange?: (snap: string | number | null) => void;
}

export function MobileExplorerSheet({
  places,
  selectedPlaceId,
  onSelectPlace,
  isRaining = false,
  activeSnapPoint,
  onSnapChange,
}: MobileExplorerSheetProps) {
  const [internalSnap, setInternalSnap] = useState<string | number | null>('140px');
  const snap = activeSnapPoint !== undefined ? activeSnapPoint : internalSnap;

  const handleSnapChange = (newSnap: string | number | null) => {
    setInternalSnap(newSnap);
    onSnapChange?.(newSnap);
  };

  return (
    <Drawer.Root
      open={true}
      modal={false} // CRITIQUE : Permet l'interaction avec la carte WebGL en arrière-plan
      dismissible={false} // Reste toujours au minimum à 140px
      snapPoints={['140px', 0.5, 0.92]}
      activeSnapPoint={snap}
      setActiveSnapPoint={handleSnapChange}
    >
      <Drawer.Portal>
        <Drawer.Content
          className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex flex-col rounded-t-[24px] bg-white/95 backdrop-blur-md shadow-2xl border-t border-slate-200/80 outline-none select-none"
          style={{ height: '92dvh' }}
        >
          <Drawer.Title className="sr-only">Lieux à proximité</Drawer.Title>
          <Drawer.Description className="sr-only">
            Liste des lieux d&apos;intérêt du Golfe du Morbihan
          </Drawer.Description>

          {/* Poignée de manipulation physique */}
          <div className="py-2.5 flex justify-center cursor-grab active:cursor-grabbing">
            <Drawer.Handle className="w-12 h-1.5 bg-slate-300 rounded-full" />
          </div>

          {/* Barre de filtres intégrée sous la poignée */}
          <div className="px-4 pb-2 border-b border-slate-100">
            <FilterBar isRaining={isRaining} />
          </div>

          {/* Liste interne défilable avec confinement de scroll */}
          <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y px-4 py-3 space-y-2.5 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
              {places.length} lieu{places.length > 1 ? 'x' : ''} à proximité
            </div>

            {places.map((place) => (
              <PlaceCard
                key={place.id}
                place={place}
                variant="compact"
                isSelected={place.id === selectedPlaceId}
                onSelect={(p) => {
                  handleSnapChange(0.5); // Ouvre à 50% au tap
                  onSelectPlace?.(p);
                }}
              />
            ))}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
