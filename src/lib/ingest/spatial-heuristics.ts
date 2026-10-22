import { COASTAL_SECTORS } from '../open-meteo';
import { haversineDistanceKm } from '../utils/geo';
import type { WindCardinal } from '../types/context';

/**
 * Assigne le marégraphe de référence en fonction des coordonnées géographiques.
 * Si le lieu se trouve dans le golfe intérieur nord/est (fond de golfe, Vannes, Séné),
 * le marégraphe de Vannes s'applique.
 * Vers le goulet d'entrée ou l'océan, le marégraphe de Port-Navalo s'applique.
 */
export function resolveTideHarborByCoords(latitude: number, longitude: number): 'PORT_NAVALO' | 'VANNES' {
  if (longitude > -2.85 && latitude > 47.55) {
    return 'VANNES';
  }
  return 'PORT_NAVALO';
}

/**
 * Évalue les directions de vent contre lesquelles une plage ou crique est naturellement abritée,
 * en fonction de son exposition/orientation cardinale vers le plan d'eau.
 * Ex: Une plage orientée Sud (ouvrant au sud) a la terre au Nord et est donc protégée des vents de Nord (N, NE, NW).
 */
export function estimateBeachWindShelter(cardinalOpening: WindCardinal): WindCardinal[] {
  const shelterMap: Record<WindCardinal, WindCardinal[]> = {
    S: ['N', 'NE', 'NW'],
    SW: ['N', 'NE', 'E'],
    SE: ['N', 'NW', 'W'],
    N: ['S', 'SE', 'SW'],
    E: ['W', 'SW', 'NW'],
    W: ['E', 'NE', 'SE'],
    NE: ['S', 'SW', 'W'],
    NW: ['S', 'SE', 'E'],
  };
  return shelterMap[cardinalOpening] || ['N'];
}

/**
 * Détermine le secteur météo le plus proche parmi les secteurs stratégiques du Morbihan.
 */
export function resolveSectorByCoords(latitude: number, longitude: number): string {
  let closestSector = 'ARRADON';
  let minDistance = Infinity;

  for (const [key, config] of Object.entries(COASTAL_SECTORS)) {
    const dist = haversineDistanceKm(latitude, longitude, config.latitude, config.longitude);
    if (dist < minDistance) {
      minDistance = dist;
      closestSector = key;
    }
  }

  return closestSector;
}
