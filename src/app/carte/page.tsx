'use client';

import React, { useState, Suspense } from 'react';
import { useQueryState, parseAsString, parseAsBoolean } from 'nuqs';
import { FloatingContextPill } from '@/components/context/FloatingContextPill';
import { TidalAlertChip } from '@/components/context/TidalAlertChip';
import { MobileExplorerSheet } from '@/components/explorer/MobileExplorerSheet';
import { DesktopSplitExplorer } from '@/components/explorer/DesktopSplitExplorer';
import { DynamicGolfeMap, MapSkeleton } from '@/components/map';
import { useFilteredPlaces } from '@/lib/hooks/useFilteredPlaces';
import type { PlaceMarkerData } from '@/lib/types/map';

// Échantillon initial représentatif des lieux phares du Golfe
const INITIAL_PLACES: PlaceMarkerData[] = [
  {
    id: 'berder',
    slug: 'passage-berder',
    name: 'Île de Berder',
    latitude: 47.5794,
    longitude: -2.8872,
    category: 'TRAIL',
    status: 'WARNING',
    label: 'Fermeture dans 35 min',
    score: 85,
  },
  {
    id: 'fogeo',
    slug: 'plage-fogeo',
    name: 'Plage du Fogeo (Arzon)',
    latitude: 47.5367,
    longitude: -2.8953,
    category: 'BEACH',
    status: 'IDEAL',
    label: 'Idéal marée haute',
    score: 95,
  },
  {
    id: 'saint-goustan',
    slug: 'port-saint-goustan',
    name: 'Port Saint-Goustan (Auray)',
    latitude: 47.6669,
    longitude: -2.9772,
    category: 'HERITAGE',
    status: 'IDEAL',
    label: 'Terrasses au soleil',
    score: 90,
  },
  {
    id: 'suscinio',
    slug: 'domaine-suscinio',
    name: 'Château de Suscinio',
    latitude: 47.5144,
    longitude: -2.7297,
    category: 'HERITAGE',
    status: 'IDEAL',
    score: 88,
  },
];

function CarteExplorerContent() {
  const [selectedCat] = useQueryState('cat', parseAsString.withDefault('ALL'));
  const [tideFilter] = useQueryState('maree', parseAsString.withDefault('ALL'));
  const [shelteredFromWind] = useQueryState('vent', parseAsBoolean.withDefault(false));
  const [rainOnly] = useQueryState('pluie', parseAsBoolean.withDefault(false));
  const [selectedSpot, setSelectedSpot] = useQueryState('spot', parseAsString.withDefault(''));

  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [activeSnapPoint, setActiveSnapPoint] = useState<string | number | null>('140px');

  const filteredPlaces = useFilteredPlaces(INITIAL_PLACES, {
    category: selectedCat,
    tideFilter,
    shelteredFromWind,
    strollerOnly: false,
    dogsOnly: false,
    rainOnly,
  });

  const effectiveSelectedId = selectedPlaceId || selectedSpot || null;

  const handleSelectPlace = (place: PlaceMarkerData) => {
    setSelectedPlaceId(place.id);
    setSelectedSpot(place.id, { shallow: true, history: 'replace' });
    setActiveSnapPoint(0.5); // Ouvre le tiroir à mi-hauteur sur mobile lors du clic marqueur/carte
  };

  return (
    <main className="relative w-full h-[100dvh] overflow-hidden flex flex-col lg:flex-row bg-slate-100">
      {/* Pilule contextuelle flottante haute visibilité */}
      <div className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-4 z-40 pointer-events-auto">
        <FloatingContextPill
          tideText="PM 17h42 (78)"
          weatherText="19°C · NO 12nd"
          urgentAlert={
            <TidalAlertChip
              passageName="Berder"
              minutesRemaining={35}
              isOpen={true}
            />
          }
        />
      </div>

      {/* Volet Desktop (>= 1024px) */}
      <div className="hidden lg:flex h-full">
        <DesktopSplitExplorer
          places={filteredPlaces}
          selectedPlaceId={effectiveSelectedId}
          onSelectPlace={handleSelectPlace}
          isRaining={rainOnly}
        />
      </div>

      {/* Canevas Cartographique Central */}
      <section
        aria-label="Canevas Cartographique WebGL"
        className="flex-1 relative w-full h-full bg-slate-200 flex items-center justify-center"
      >
        <DynamicGolfeMap
          places={filteredPlaces}
          selectedPlaceId={effectiveSelectedId}
          onSelectPlace={handleSelectPlace}
          activeSnapPoint={activeSnapPoint}
          className="w-full h-full"
        />
      </section>

      {/* Bottom Sheet Mobile (< 1024px) */}
      <MobileExplorerSheet
        places={filteredPlaces}
        selectedPlaceId={effectiveSelectedId}
        onSelectPlace={handleSelectPlace}
        activeSnapPoint={activeSnapPoint}
        onSnapChange={setActiveSnapPoint}
        isRaining={rainOnly}
      />
    </main>
  );
}

/**
 * Route explorateur cartographique plein écran `/carte`.
 * Enveloppé dans un Suspense boundary pour les hooks searchParams / nuqs.
 */
export default function CartePage() {
  return (
    <Suspense fallback={<MapSkeleton message="Chargement de l'explorateur..." height="h-screen" />}>
      <CarteExplorerContent />
    </Suspense>
  );
}
