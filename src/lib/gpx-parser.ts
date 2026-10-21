import { DOMParser } from '@xmldom/xmldom';
import * as toGeoJSON from '@tmcw/togeojson';
import {
  haversineDistanceKm,
  calculateElevationGainWithHysteresis,
  estimateTrailDurationMinutes,
} from './utils/geo.js';
import type { ElevationPoint, ParsedGpxResult } from './types/gpx.js';

export interface ParseGpxOptions {
  maxProfilePoints?: number;
  elevationHysteresisMeters?: number;
}

/**
 * Parse un fichier XML GPX et retourne un objet GeoJSON enrichi avec distance et profil altimétrique.
 */
export function parseGpxTrack(
  gpxXmlString: string,
  options: ParseGpxOptions = {}
): ParsedGpxResult {
  if (!gpxXmlString || typeof gpxXmlString !== 'string' || gpxXmlString.trim().length === 0) {
    throw new Error('Empty or invalid GPX content provided');
  }

  const dom = new DOMParser({
    onError: (level, msg) => {
      if (level === 'fatalError') {
        throw new Error(`GPX XML fatal parsing error: ${msg}`);
      }
      if (level === 'error') {
        throw new Error(`GPX XML syntax error: ${msg}`);
      }
    },
  }).parseFromString(gpxXmlString, 'text/xml');

  const geojson = toGeoJSON.gpx(dom as unknown as Document);

  // Recherche de la première géométrie LineString ou MultiLineString
  let lineCoordinates: [number, number, number?][] = [];

  for (const feature of geojson.features) {
    if (feature.geometry.type === 'LineString') {
      lineCoordinates = feature.geometry.coordinates as [number, number, number?][];
      break;
    } else if (feature.geometry.type === 'MultiLineString') {
      // Concaténation des segments
      lineCoordinates = (feature.geometry.coordinates as [number, number, number?][][]).flat();
      break;
    }
  }

  if (lineCoordinates.length < 2) {
    throw new Error('No track found or fewer than 2 points in GPX');
  }

  // Calcul des distances cumulées et extraction des altitudes
  let totalDistanceKm = 0;
  const rawDistances: number[] = [0];
  const rawElevations: number[] = [];

  let minLat = lineCoordinates[0][1];
  let maxLat = lineCoordinates[0][1];
  let minLng = lineCoordinates[0][0];
  let maxLng = lineCoordinates[0][0];

  const firstEle = lineCoordinates[0][2];
  const hasElevation = typeof firstEle === 'number';

  if (hasElevation) {
    rawElevations.push(firstEle);
  }

  for (let i = 1; i < lineCoordinates.length; i++) {
    const prev = lineCoordinates[i - 1];
    const curr = lineCoordinates[i];

    const segDist = haversineDistanceKm(prev[1], prev[0], curr[1], curr[0]);
    totalDistanceKm += segDist;
    rawDistances.push(totalDistanceKm);

    if (hasElevation) {
      rawElevations.push(typeof curr[2] === 'number' ? curr[2] : rawElevations[rawElevations.length - 1] ?? 0);
    }

    if (curr[1] < minLat) minLat = curr[1];
    if (curr[1] > maxLat) maxLat = curr[1];
    if (curr[0] < minLng) minLng = curr[0];
    if (curr[0] > maxLng) maxLng = curr[0];
  }

  // Analyse du dénivelé
  const hysteresis = options.elevationHysteresisMeters ?? 3.0;
  const eleAnalysis = hasElevation
    ? calculateElevationGainWithHysteresis(rawElevations, hysteresis)
    : { gainM: 0, lossM: 0, minM: 0, maxM: 0 };

  // Sous-échantillonnage du profil altimétrique (max 150 points par défaut)
  const maxPoints = options.maxProfilePoints ?? 150;
  const elevationProfile: ElevationPoint[] = [];

  if (hasElevation && rawElevations.length > 0) {
    const step = Math.max(1, Math.floor(rawElevations.length / maxPoints));
    for (let i = 0; i < rawElevations.length; i += step) {
      elevationProfile.push({
        distKm: Math.round(rawDistances[i] * 100) / 100,
        altM: Math.round(rawElevations[i] * 10) / 10,
      });
    }
    // Dernier point garanti
    const lastIdx = rawElevations.length - 1;
    if (elevationProfile[elevationProfile.length - 1].distKm !== Math.round(rawDistances[lastIdx] * 100) / 100) {
      elevationProfile.push({
        distKm: Math.round(rawDistances[lastIdx] * 100) / 100,
        altM: Math.round(rawElevations[lastIdx] * 10) / 10,
      });
    }
  }

  const cleanCoordinates: GeoJSON.Position[] = lineCoordinates.map((coord) =>
    typeof coord[2] === 'number' ? [coord[0], coord[1], coord[2]] : [coord[0], coord[1]]
  );

  const trackFeature: GeoJSON.Feature<GeoJSON.LineString> = {
    type: 'Feature',
    properties: {
      name: dom.getElementsByTagName('name')?.[0]?.textContent ?? 'Trace GPX',
    },
    geometry: {
      type: 'LineString',
      coordinates: cleanCoordinates,
    },
  };

  const finalDistanceKm = Math.round(totalDistanceKm * 100) / 100;
  const estimatedDurationMinutes = estimateTrailDurationMinutes(finalDistanceKm, eleAnalysis.gainM);

  return {
    track: trackFeature,
    distanceKm: finalDistanceKm,
    elevationGainM: eleAnalysis.gainM,
    elevationLossM: eleAnalysis.lossM,
    minElevationM: eleAnalysis.minM,
    maxElevationM: eleAnalysis.maxM,
    estimatedDurationMinutes,
    elevationProfile,
    bounds: { minLat, maxLat, minLng, maxLng },
  };
}
