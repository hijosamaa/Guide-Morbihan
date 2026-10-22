/**
 * @fileoverview Calculs géométriques et projection métrique locale équirectangulaire.
 *
 * Dans le Morbihan (~47.5°N), 1° de longitude équivaut à environ 75.1 km tandis que
 * 1° de latitude équivaut à environ 111.2 km (distorsion de ~32.4%).
 * Cette projection métrique locale applique la correction cosinus sur la latitude
 * de référence pour permettre des calculs euclidiens en mètres (projections orthogonales,
 * distances cross-track) avec une précision millimétrique à l'échelle locale (< 100 km).
 */

const EARTH_RADIUS_METERS = 6371000;
const DEG_TO_RAD = Math.PI / 180;

/**
 * Coordonnées projetées en mètres dans le repère local.
 */
export interface MetricPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Résultat de projection orthogonale bornée sur un segment.
 */
export interface SegmentProjectionResult {
  /** Coordonnées géographiques projetées [longitude, latitude] */
  readonly projected: [number, number];
  /** Distance orthogonale en mètres entre le point et le segment */
  readonly crossTrackDistanceMeters: number;
  /** Paramètre d'avancement t sur le segment [A, B], borné dans [0, 1] */
  readonly t: number;
}

/**
 * Projette des coordonnées géographiques WGS84 en coordonnées métriques locales.
 *
 * @param lon - Longitude en degrés décimaux (-180 à 180)
 * @param lat - Latitude en degrés décimaux (-90 à 90)
 * @param refLat - Latitude de référence locale en degrés pour la correction cosinus
 * @returns Point métrique local en mètres { x, y }
 */
export function toLocalMetric(lon: number, lat: number, refLat: number): MetricPoint {
  const cosRef = Math.cos(refLat * DEG_TO_RAD);
  return {
    x: lon * DEG_TO_RAD * EARTH_RADIUS_METERS * cosRef,
    y: lat * DEG_TO_RAD * EARTH_RADIUS_METERS,
  };
}

/**
 * Convertit un point métrique local en coordonnées géographiques WGS84.
 *
 * @param x - Coordonnée X en mètres (Est)
 * @param y - Coordonnée Y en mètres (Nord)
 * @param refLat - Latitude de référence locale utilisée lors de la projection
 * @returns Coordonnées géographiques [longitude, latitude]
 */
export function fromLocalMetric(x: number, y: number, refLat: number): [number, number] {
  const cosRef = Math.cos(refLat * DEG_TO_RAD);
  const lon = x / (DEG_TO_RAD * EARTH_RADIUS_METERS * cosRef);
  const lat = y / (DEG_TO_RAD * EARTH_RADIUS_METERS);
  return [lon, lat];
}

/**
 * Projette orthogonalement un point P sur un segment [A, B] dans le repère métrique local,
 * et bride le projeté aux extrémités du segment (t ∈ [0, 1]).
 *
 * @param p - Point à projeter [lon, lat]
 * @param a - Début du segment [lon, lat]
 * @param b - Fin du segment [lon, lat]
 * @returns Résultat de projection contenant le point projeté WGS84, la distance cross-track en mètres, et t ∈ [0, 1]
 */
export function projectPointOnSegment(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): SegmentProjectionResult {
  const refLat = (a[1] + b[1] + p[1]) / 3;
  const pM = toLocalMetric(p[0], p[1], refLat);
  const aM = toLocalMetric(a[0], a[1], refLat);
  const bM = toLocalMetric(b[0], b[1], refLat);

  const abX = bM.x - aM.x;
  const abY = bM.y - aM.y;
  const apX = pM.x - aM.x;
  const apY = pM.y - aM.y;

  const abLenSq = abX * abX + abY * abY;

  let t = 0;
  if (abLenSq > 0) {
    t = (apX * abX + apY * abY) / abLenSq;
  }
  const tClamped = Math.max(0, Math.min(1, t));

  if (tClamped === 0) {
    const dx = pM.x - aM.x;
    const dy = pM.y - aM.y;
    return {
      projected: [a[0], a[1]],
      crossTrackDistanceMeters: Math.sqrt(dx * dx + dy * dy),
      t: 0,
    };
  }

  if (tClamped === 1) {
    const dx = pM.x - bM.x;
    const dy = pM.y - bM.y;
    return {
      projected: [b[0], b[1]],
      crossTrackDistanceMeters: Math.sqrt(dx * dx + dy * dy),
      t: 1,
    };
  }

  const projM = {
    x: aM.x + tClamped * abX,
    y: aM.y + tClamped * abY,
  };

  const dx = pM.x - projM.x;
  const dy = pM.y - projM.y;
  const crossTrackDistanceMeters = Math.sqrt(dx * dx + dy * dy);

  return {
    projected: fromLocalMetric(projM.x, projM.y, refLat),
    crossTrackDistanceMeters,
    t: tClamped,
  };
}

/**
 * Calcule la distance orthogonale en mètres entre un point P et un segment [A, B],
 * en tenant compte du bridage aux extrémités du segment.
 *
 * @param p - Point source [lon, lat]
 * @param a - Début du segment [lon, lat]
 * @param b - Fin du segment [lon, lat]
 * @returns Distance minimale en mètres
 */
export function pointToLineDistanceMeters(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): number {
  return projectPointOnSegment(p, a, b).crossTrackDistanceMeters;
}
