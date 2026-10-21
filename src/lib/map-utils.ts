/**
 * Pure geodesic, bounding box, elevation scaling, and map styling utilities.
 * Follows functional programming patterns with no external side-effects.
 */

import { GOLFE_MAP_CONFIG, STATUS_STYLE_CONFIG } from './map-config';
import type { ElevationPoint, MapViewportBounds, MarkerStyleTokens } from './types/map';
import type { EvaluationStatus } from './types/context';

/**
 * Calculates a 2D bounding box `[[minLon, minLat], [maxLon, maxLat]]` from an array of coordinates.
 * Falls back to `GOLFE_MAP_CONFIG.maxBounds` if the array is empty or undefined.
 */
export function calculateBoundingBox(
  coordinates: [number, number][]
): [[number, number], [number, number]] {
  if (!coordinates || coordinates.length === 0) {
    return GOLFE_MAP_CONFIG.maxBounds;
  }

  let minLon = coordinates[0][0];
  let maxLon = coordinates[0][0];
  let minLat = coordinates[0][1];
  let maxLat = coordinates[0][1];

  for (let i = 1; i < coordinates.length; i++) {
    const [lon, lat] = coordinates[i];
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ];
}

/**
 * Finds the nearest elevation profile point to a target distance (in kilometers).
 * Used for synchronized mouse/scrubber interactions between elevation chart and map marker.
 */
export function findNearestElevationPoint(
  points: ElevationPoint[],
  targetDistanceKm: number
): ElevationPoint {
  if (!points || points.length === 0) {
    return { distanceKm: 0, elevationM: 0, lat: 0, lon: 0 };
  }

  let nearest = points[0];
  let minDiff = Math.abs(points[0].distanceKm - targetDistanceKm);

  for (let i = 1; i < points.length; i++) {
    const diff = Math.abs(points[i].distanceKm - targetDistanceKm);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = points[i];
    }
  }

  return nearest;
}

export interface ElevationScalesResult {
  minElevation: number;
  maxElevation: number;
  totalDistanceKm: number;
  pathLine: string;
  pathArea: string;
  pointsCoordinates: Array<{ x: number; y: number; point: ElevationPoint }>;
}

/**
 * Projects a sequence of elevation points into SVG coordinate space `(x, y)`
 * and generates SVG path commands for the line and filled gradient area.
 * Prevents zero division on completely flat terrain.
 */
export function calculateElevationScales(
  points: ElevationPoint[],
  svgWidth = 800,
  svgHeight = 160
): ElevationScalesResult {
  if (!points || points.length === 0) {
    return {
      minElevation: 0,
      maxElevation: 0,
      totalDistanceKm: 0,
      pathLine: `M 0 ${svgHeight} L ${svgWidth} ${svgHeight}`,
      pathArea: `M 0 ${svgHeight} L ${svgWidth} ${svgHeight} Z`,
      pointsCoordinates: [],
    };
  }

  let minEle = points[0].elevationM;
  let maxEle = points[0].elevationM;
  const maxDist = Math.max(0.1, points[points.length - 1].distanceKm);

  for (const pt of points) {
    if (pt.elevationM < minEle) minEle = pt.elevationM;
    if (pt.elevationM > maxEle) maxEle = pt.elevationM;
  }

  // Prevent divide by zero if profile is perfectly flat (minimum 5m dynamic range)
  const eleSpan = Math.max(5, maxEle - minEle);
  const paddingTop = 20;
  const paddingBottom = 20;
  const usableHeight = svgHeight - paddingTop - paddingBottom;

  const pointsCoordinates = points.map((pt) => {
    const x = (pt.distanceKm / maxDist) * svgWidth;
    const normalizedY = (pt.elevationM - minEle) / eleSpan;
    const y = svgHeight - paddingBottom - normalizedY * usableHeight;
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)), point: pt };
  });

  const lineCommands = pointsCoordinates.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  const areaCommand = `${lineCommands} L ${svgWidth} ${svgHeight} L 0 ${svgHeight} Z`;

  return {
    minElevation: minEle,
    maxElevation: maxEle,
    totalDistanceKm: maxDist,
    pathLine: lineCommands,
    pathArea: areaCommand,
    pointsCoordinates,
  };
}

/**
 * Estimates hiking duration using the French Hiking Federation (FFRandonnée) reference formula:
 * 4 km/h horizontal pace + 1 hour per 300 meters of cumulative elevation gain (D+).
 */
export function estimateHikingDuration(
  distanceKm: number,
  elevationGainM: number
): { hours: number; minutes: number; formatted: string } {
  const flatHours = distanceKm / 4.0;
  const elevationHours = Math.max(0, elevationGainM) / 300.0;
  const totalHoursDec = flatHours + elevationHours;

  const hours = Math.floor(totalHoursDec);
  const minutes = Math.round((totalHoursDec - hours) * 60);

  // Normalize 60 minutes
  const adjustedHours = minutes === 60 ? hours + 1 : hours;
  const adjustedMinutes = minutes === 60 ? 0 : minutes;

  const formatted = `${adjustedHours}h${adjustedMinutes.toString().padStart(2, '0')}`;
  return { hours: adjustedHours, minutes: adjustedMinutes, formatted };
}

/**
 * Checks if a given coordinate (lat, lon) is within the visible bounding box of the map viewport.
 */
export function isPointInBounds(lat: number, lon: number, bounds: MapViewportBounds): boolean {
  return lat >= bounds.south && lat <= bounds.north && lon >= bounds.west && lon <= bounds.east;
}

/**
 * Resolves Tailwind styling tokens for map markers based on context evaluation status and sponsorship.
 */
export function getMarkerStyleTokens(status: EvaluationStatus, isSponsored = false): MarkerStyleTokens {
  if (isSponsored) {
    return STATUS_STYLE_CONFIG.SPONSORED;
  }
  return STATUS_STYLE_CONFIG[status] || STATUS_STYLE_CONFIG.DISCOURAGED;
}
