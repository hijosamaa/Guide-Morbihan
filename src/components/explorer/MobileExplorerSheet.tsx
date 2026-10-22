'use client';

import React, { useState } from 'react';
import { Drawer } from 'vaul';
import { ArrowLeft } from 'lucide-react';
import type { PlaceMarkerData } from '@/lib/types/map';
import type { Place } from '@/lib/types/context';
import { PlaceCard } from '@/components/places/PlaceCard';
import { PlaceDetailView } from '@/components/places/PlaceDetailView';
import { FilterBar } from '@/components/filters/FilterBar';

export interface MobileExplorerSheetProps {
  places: (PlaceMarkerData | Place)[];
  selectedPlace?: Place | null;
  selectedPlaceId?: string | null;
  onSelectPlace?: (place: PlaceMarkerData | Place) => void;
  onClosePlace?: () => void;
  isRaining?: boolean;
  activeSnapPoint?: string | number | null;
  snapPoint?: string | number | null;
  onSnapChange?: (snap: string | number | null) => void;
  onSnapPointChange?: (snap: string | number | null) => void;
}

function normalizeToPlaceMarker(p: PlaceMarkerData | Place): PlaceMarkerData {
  if ('status' in p && typeof (p as any).status === 'string') {
    return p as PlaceMarkerData;
  }
  return {
    id: p.id || (p as any).slug || 'unknown',
    slug: (p as any).slug || p.id || '',
    name: p.name,
    latitude: p.latitude ?? 0,
    longitude: p.longitude ?? 0,
    category: p.category,
    status: (p as any).status || 'IDEAL',
    isSponsored: p.isSponsored,
  };
}

interface SheetBodyProps {
  places: (PlaceMarkerData | Place)[];
  selectedPlace?: Place | null;
  selectedPlaceId?: string | null;
  onSelectPlace?: (place: PlaceMarkerData | Place) => void;
  handleClose: () => void;
  handleSnapChange: (snap: string | number | null) => void;
  isRaining?: boolean;
}

function SheetBody({
  places,
  selectedPlace,
  selectedPlaceId,
  onSelectPlace,
  handleClose,
  handleSnapChange,
  isRaining,
}: SheetBodyProps) {
  const currentSelectedPlace: Place | null =
    selectedPlace ||
    (selectedPlaceId
      ? ((places.find(
          (p) => p.id === selectedPlaceId || (p as any).slug === selectedPlaceId
        ) as unknown) as Place) || null
      : null);

  return (
    <>
      {/* Poignée de manipulation physique */}
      <div className="py-2.5 flex justify-center cursor-grab active:cursor-grabbing">
        <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
      </div>

      {currentSelectedPlace ? (
        <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y">
          {/* Bouton de retour unique vers la liste des spots */}
          <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between bg-white/95 sticky top-0 z-20">
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex min-h-[44px] items-center gap-2 px-3.5 py-1.5 text-sm font-semibold text-emerald-800 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
              aria-label="Retour aux spots"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>← Retour aux spots</span>
            </button>
          </div>

          {/* Fiche détaillée enrichie (onClose non transmis ici pour éviter le bouton de fermeture dupliqué) */}
          <PlaceDetailView place={currentSelectedPlace} />
        </div>
      ) : (
        <>
          {/* Barre de filtres intégrée sous la poignée */}
          <div className="px-4 pb-2 border-b border-slate-100">
            <FilterBar isRaining={isRaining} />
          </div>

          {/* Liste interne défilable avec confinement de scroll */}
          <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y px-4 py-3 space-y-2.5 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
              {places.length} lieu{places.length > 1 ? 'x' : ''} à proximité
            </div>

            {places.map((p) => {
              const placeMarker = normalizeToPlaceMarker(p);
              return (
                <PlaceCard
                  key={placeMarker.id || placeMarker.slug}
                  place={placeMarker}
                  variant="compact"
                  isSelected={
                    placeMarker.id === selectedPlaceId ||
                    placeMarker.slug === selectedPlaceId
                  }
                  onSelect={(selected) => {
                    handleSnapChange(0.92);
                    onSelectPlace?.(selected);
                  }}
                />
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

export function MobileExplorerSheet({
  places,
  selectedPlace,
  selectedPlaceId,
  onSelectPlace,
  onClosePlace,
  isRaining = false,
  activeSnapPoint,
  snapPoint,
  onSnapChange,
  onSnapPointChange,
}: MobileExplorerSheetProps) {
  const [internalSnap, setInternalSnap] = useState<string | number | null>(
    selectedPlace ? 0.92 : '140px'
  );
  const snap =
    snapPoint !== undefined
      ? snapPoint
      : activeSnapPoint !== undefined
      ? activeSnapPoint
      : internalSnap;

  const handleSnapChange = (newSnap: string | number | null) => {
    setInternalSnap(newSnap);
    onSnapChange?.(newSnap);
    onSnapPointChange?.(newSnap);
  };

  const handleClose = () => {
    handleSnapChange(0.5);
    onClosePlace?.();
  };

  const currentSelectedPlace: Place | null =
    selectedPlace ||
    (selectedPlaceId
      ? ((places.find(
          (p) => p.id === selectedPlaceId || (p as any).slug === selectedPlaceId
        ) as unknown) as Place) || null
      : null);

  // En environnement SSR / node sans DOM, rendu direct pour éviter le blocage de Radix Portal
  if (typeof window === 'undefined') {
    return (
      <aside
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex flex-col rounded-t-[24px] bg-white/95 backdrop-blur-md shadow-2xl border-t border-slate-200/80 outline-none select-none"
        style={{ height: '92dvh' }}
        aria-label="Explorateur mobile"
      >
        <h2 className="sr-only">
          {currentSelectedPlace ? currentSelectedPlace.name : 'Lieux à proximité'}
        </h2>
        <SheetBody
          places={places}
          selectedPlace={selectedPlace}
          selectedPlaceId={selectedPlaceId}
          onSelectPlace={onSelectPlace}
          handleClose={handleClose}
          handleSnapChange={handleSnapChange}
          isRaining={isRaining}
        />
      </aside>
    );
  }

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
          <Drawer.Title className="sr-only">
            {currentSelectedPlace ? currentSelectedPlace.name : 'Lieux à proximité'}
          </Drawer.Title>
          <Drawer.Description className="sr-only">
            {currentSelectedPlace
              ? `Détails sur ${currentSelectedPlace.name}`
              : "Liste des lieux d'intérêt du Golfe du Morbihan"}
          </Drawer.Description>

          <SheetBody
            places={places}
            selectedPlace={selectedPlace}
            selectedPlaceId={selectedPlaceId}
            onSelectPlace={onSelectPlace}
            handleClose={handleClose}
            handleSnapChange={handleSnapChange}
            isRaining={isRaining}
          />
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
