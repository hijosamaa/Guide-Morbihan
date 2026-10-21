/**
 * Rayon moyen volumétrique de la Terre en kilomètres (IUGG)
 */
const EARTH_RADIUS_KM = 6371.0088;

/**
 * Calcule la distance orthodromique entre deux points en kilomètres (Formule de Haversine).
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);

  const rawA =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const a = Math.min(1, Math.max(0, rawA));

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export type CardinalDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

/**
 * Convertit un angle en degrés (0 à 360) en direction cardinale sur 8 secteurs de 45°.
 */
export function degreesToCardinal(deg: number): CardinalDirection {
  const normalized = ((deg % 360) + 360) % 360;
  if (normalized >= 337.5 || normalized < 22.5) return 'N';
  if (normalized >= 22.5 && normalized < 67.5) return 'NE';
  if (normalized >= 67.5 && normalized < 112.5) return 'E';
  if (normalized >= 112.5 && normalized < 157.5) return 'SE';
  if (normalized >= 157.5 && normalized < 202.5) return 'S';
  if (normalized >= 202.5 && normalized < 247.5) return 'SW';
  if (normalized >= 247.5 && normalized < 292.5) return 'W';
  return 'NW';
}

export interface ElevationAnalysis {
  gainM: number;
  lossM: number;
  minM: number;
  maxM: number;
}

/**
 * Calcule le dénivelé positif cumulé (D+) et négatif (D-) à l'aide d'un filtre d'hystérésis
 * pour éliminer le bruit vertical des traces GPS de smartphones.
 *
 * @param elevations Tableau chronologique des altitudes en mètres
 * @param thresholdMeters Seuil d'inflexion minimale requis pour valider une variation (défaut 3.0 m)
 */
export function calculateElevationGainWithHysteresis(
  elevations: number[],
  thresholdMeters = 3.0
): ElevationAnalysis {
  if (!elevations || elevations.length === 0) {
    return { gainM: 0, lossM: 0, minM: 0, maxM: 0 };
  }

  let minM = elevations[0];
  let maxM = elevations[0];
  for (let i = 1; i < elevations.length; i++) {
    if (elevations[i] < minM) minM = elevations[i];
    if (elevations[i] > maxM) maxM = elevations[i];
  }

  let gainM = 0;
  let lossM = 0;

  let lastExtremum = elevations[0];
  let currentTrend: 'UP' | 'DOWN' | 'NONE' = 'NONE';

  for (let i = 1; i < elevations.length; i++) {
    const current = elevations[i];
    const diff = current - lastExtremum;

    if (currentTrend === 'NONE') {
      if (diff >= thresholdMeters) {
        gainM += diff;
        lastExtremum = current;
        currentTrend = 'UP';
      } else if (diff <= -thresholdMeters) {
        lossM += Math.abs(diff);
        lastExtremum = current;
        currentTrend = 'DOWN';
      }
    } else if (currentTrend === 'UP') {
      if (current > lastExtremum) {
        gainM += current - lastExtremum;
        lastExtremum = current;
      } else if (diff <= -thresholdMeters) {
        lossM += Math.abs(diff);
        lastExtremum = current;
        currentTrend = 'DOWN';
      }
    } else if (currentTrend === 'DOWN') {
      if (current < lastExtremum) {
        lossM += lastExtremum - current;
        lastExtremum = current;
      } else if (diff >= thresholdMeters) {
        gainM += diff;
        lastExtremum = current;
        currentTrend = 'UP';
      }
    }
  }

  return {
    gainM: Math.round(gainM),
    lossM: Math.round(lossM),
    minM: Math.round(minM * 10) / 10,
    maxM: Math.round(maxM * 10) / 10,
  };
}

/**
 * Estime la durée d'une randonnée en minutes (Norme FFRandonnée : 4 km/h à plat + 1h pour 300m D+).
 */
export function estimateTrailDurationMinutes(distanceKm: number, elevationGainM: number): number {
  const flatHours = distanceKm / 4.0;
  const climbHours = elevationGainM / 300.0;
  return Math.round((flatHours + climbHours) * 60);
}
