import { useMemo } from 'react';
import type { PlaceMarkerData } from '@/lib/types/map';

export interface FilterCriteria {
  category: string;
  tideFilter: string;
  shelteredFromWind: boolean;
  strollerOnly: boolean;
  dogsOnly: boolean;
  rainOnly: boolean;
}

/**
 * Fonction pure de filtrage en mémoire (exécutable côté client et test unitaire).
 */
export function filterPlacesInMemory(
  places: PlaceMarkerData[],
  criteria: FilterCriteria
): PlaceMarkerData[] {
  return places.filter((place) => {
    // 1. Filtrage par catégorie
    if (criteria.category && criteria.category !== 'ALL' && place.category !== criteria.category) {
      return false;
    }

    // 2. Filtrage par marée idéale
    if (criteria.tideFilter === 'IDEAL_NOW' && place.status !== 'IDEAL') {
      return false;
    }

    return true;
  });
}

/**
 * Hook mémoïsé React pour le filtrage fluide sans blocage UI.
 */
export function useFilteredPlaces(
  places: PlaceMarkerData[],
  criteria: FilterCriteria
): PlaceMarkerData[] {
  return useMemo(() => {
    return filterPlacesInMemory(places, criteria);
  }, [places, criteria]);
}
