'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useQueryState, parseAsString, parseAsBoolean } from 'nuqs';
import { FloatingContextPill } from '@/components/context/FloatingContextPill';
import { TidalAlertChip } from '@/components/context/TidalAlertChip';
import { MobileExplorerSheet } from '@/components/explorer/MobileExplorerSheet';
import { DesktopSplitExplorer } from '@/components/explorer/DesktopSplitExplorer';
import { DynamicGolfeMap, MapSkeleton } from '@/components/map';
import { useFilteredPlaces } from '@/lib/hooks/useFilteredPlaces';
import type { PlaceMarkerData } from '@/lib/types/map';
import type { Place } from '@/lib/types/context';
import curatedSpotsData from '../../../data/curated-spots.json';

// Échantillon initial représentatif des lieux phares du Golfe aligné avec les slugs officiels curés
const INITIAL_PLACES: PlaceMarkerData[] = [
  {
    id: 'berder',
    slug: 'ile-de-berder',
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
    slug: 'chateau-de-suscinio',
    name: 'Château de Suscinio',
    latitude: 47.5144,
    longitude: -2.7297,
    category: 'HERITAGE',
    status: 'IDEAL',
    score: 88,
  },
];

// Alias et correspondances d'identifiants historiques
const SPOT_SLUG_ALIASES: Record<string, string> = {
  berder: 'ile-de-berder',
  'passage-berder': 'ile-de-berder',
  'ile-de-berder': 'ile-de-berder',
  fogeo: 'plage-fogeo',
  'plage-fogeo': 'plage-fogeo',
  'saint-goustan': 'port-saint-goustan',
  'port-saint-goustan': 'port-saint-goustan',
  suscinio: 'chateau-de-suscinio',
  'domaine-suscinio': 'chateau-de-suscinio',
  'chateau-de-suscinio': 'chateau-de-suscinio',
};

/**
 * Retrouve les détails enrichis d'un lieu à partir de son slug ou de son identifiant.
 */
function findSpotBySlugOrId(slugOrId: string | null): Place | null {
  if (!slugOrId) return null;
  const raw = slugOrId.toLowerCase().trim();
  const targetSlug = SPOT_SLUG_ALIASES[raw] || raw;

  // 1. Recherche prioritaire dans les spots curés enrichis
  const curated = (curatedSpotsData as unknown as Place[]).find(
    (s) =>
      s.slug === targetSlug ||
      s.slug === raw ||
      (s.id && s.id === raw) ||
      s.slug.replace(/-/g, '').includes(targetSlug.replace(/-/g, '')) ||
      targetSlug.replace(/-/g, '').includes(s.slug.replace(/-/g, ''))
  );
  if (curated) return curated;

  // 2. Repli vers les lieux initiaux si non trouvé dans les fiches curées
  const initial = INITIAL_PLACES.find(
    (p) =>
      p.slug === targetSlug ||
      p.slug === raw ||
      p.id === raw ||
      p.id.toLowerCase() === raw
  );
  if (initial) {
    return {
      id: initial.id,
      slug: initial.slug,
      name: initial.name,
      category: initial.category as any,
      latitude: initial.latitude,
      longitude: initial.longitude,
      shortDescription: initial.label,
      contextualRules: {
        tideConstraint: 'ALL_TIDES',
        dogsAllowedSummer: true,
        strollerFriendly: true,
        rainFriendly: true,
      },
      isSponsored: initial.isSponsored,
    };
  }

  return null;
}

function CarteExplorerContent() {
  const [selectedCat] = useQueryState('cat', parseAsString.withDefault('ALL'));
  const [tideFilter] = useQueryState('maree', parseAsString.withDefault('ALL'));
  const [shelteredFromWind] = useQueryState('vent', parseAsBoolean.withDefault(false));
  const [rainOnly] = useQueryState('pluie', parseAsBoolean.withDefault(false));
  const [selectedSpot, setSelectedSpot] = useQueryState('spot', parseAsString.withDefault(''));

  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(() => selectedSpot || null);
  const [activeSnapPoint, setActiveSnapPoint] = useState<string | number | null>(() =>
    selectedSpot ? 0.92 : '140px'
  );

  const isFirstMount = useRef(true);

  // Synchronisation automatique si le paramètre d'URL change (navigation externe, partage de lien, retour navigateur)
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    if (selectedSpot) {
      setSelectedPlaceId(selectedSpot);
      setActiveSnapPoint(0.92);
    } else {
      // Retour navigateur ou réinitialisation d'URL : referme la fiche et réinitialise le tiroir
      setSelectedPlaceId(null);
      setActiveSnapPoint(0.5);
    }
  }, [selectedSpot]);

  const filteredPlaces = useFilteredPlaces(INITIAL_PLACES, {
    category: selectedCat,
    tideFilter,
    shelteredFromWind,
    strollerOnly: false,
    dogsOnly: false,
    rainOnly,
  });

  const effectiveSpotSlug = selectedSpot || selectedPlaceId || null;
  const selectedPlace = effectiveSpotSlug ? findSpotBySlugOrId(effectiveSpotSlug) : null;
  const effectiveSelectedId = selectedPlace ? (selectedPlace.id || selectedPlace.slug) : effectiveSpotSlug;

  const handleSelectPlace = (place: PlaceMarkerData | Place) => {
    const slug = (place as Place).slug || place.id || '';
    setSelectedPlaceId(slug);
    setActiveSnapPoint(0.92); // Ouvre en grand le tiroir à 0.92 lors de la sélection
    setSelectedSpot(slug, { shallow: true, history: 'push' });
  };

  const handleClosePlace = () => {
    setSelectedPlaceId(null);
    setActiveSnapPoint(0.5); // Réinitialise le tiroir à mi-hauteur au retour à la liste
    setSelectedSpot('', { shallow: true, history: 'push' });
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
        selectedPlace={selectedPlace}
        selectedPlaceId={effectiveSelectedId}
        onSelectPlace={handleSelectPlace}
        onClosePlace={handleClosePlace}
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
