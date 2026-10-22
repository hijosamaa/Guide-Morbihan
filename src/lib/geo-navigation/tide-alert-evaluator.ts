/**
 * Évaluateur Prédictif de Submersion Maritime avec Surcote Météo
 *
 * Calcule l'ETA du marcheur au passage submersible (Berder, Tascon, 7 Îles, Le Bono...)
 * et applique une marge de sécurité hydrographique dynamique tenant compte des surcotes :
 * - Marge de base : 15 min
 * - Fort coefficient (>= 80) : +10 min
 * - Vent fort d'Ouest/Sud-Ouest (>= 20 kts) : +15 min
 */

export interface TidalPassageEvaluationParams {
  passageName: string;
  distanceToPassageKm: number;
  speedKmH: number;
  currentDate: Date;
  passageOpensAt: Date;
  passageClosesAt: Date;
  tideCoefficient?: number;
  windSpeedKnots?: number;
  windCardinal?: string;
}

export interface TidalPassageStatusResult {
  status: 'PASSABLE' | 'WARNING_CLOSING' | 'SUBMERGED';
  etaDate: Date;
  effectiveClosingDate: Date;
  safetyMarginMinutes: number;
  message: string;
}

/**
 * Évalue l'état de praticabilité d'un passage à marée en tenant compte de l'ETA du marcheur
 * et des surcotes météo / marée.
 */
export function evaluateTidalPassageStatus(
  params: TidalPassageEvaluationParams
): TidalPassageStatusResult {
  const effectiveSpeed = Math.max(1.0, params.speedKmH);
  const travelDurationMinutes = (params.distanceToPassageKm / effectiveSpeed) * 60;
  const etaTimestamp = params.currentDate.getTime() + travelDurationMinutes * 60 * 1000;
  const etaDate = new Date(etaTimestamp);

  // Marge de sécurité hydrographique (Surcote vent + basse pression + coeff)
  let safetyMarginMinutes = 15;
  if ((params.tideCoefficient ?? 0) >= 80) {
    safetyMarginMinutes += 10;
  }
  const isSouthWestWind = params.windCardinal === 'SW' || params.windCardinal === 'W';
  if (isSouthWestWind && (params.windSpeedKnots ?? 0) >= 20) {
    safetyMarginMinutes += 15;
  }

  const effectiveClosingTimestamp = params.passageClosesAt.getTime() - safetyMarginMinutes * 60 * 1000;
  const effectiveClosingDate = new Date(effectiveClosingTimestamp);

  const etaHours = etaDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const closingHours = effectiveClosingDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  if (etaTimestamp < params.passageOpensAt.getTime()) {
    return {
      status: 'SUBMERGED',
      etaDate,
      effectiveClosingDate,
      safetyMarginMinutes,
      message: `${params.passageName} : encore sous l'eau à votre arrivée (${etaHours}). Ouverture à ${params.passageOpensAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`,
    };
  }

  if (etaTimestamp >= effectiveClosingTimestamp) {
    return {
      status: 'SUBMERGED',
      etaDate,
      effectiveClosingDate,
      safetyMarginMinutes,
      message: `${params.passageName} : submergé ou dangereux à votre arrivée estimée (${etaHours}). Fermeture sécurisée : ${closingHours}.`,
    };
  }

  // Si l'arrivée est à moins de 30 minutes de la fermeture effective
  if (effectiveClosingTimestamp - etaTimestamp <= 30 * 60 * 1000) {
    return {
      status: 'WARNING_CLOSING',
      etaDate,
      effectiveClosingDate,
      safetyMarginMinutes,
      message: `Attention : ${params.passageName} praticable à l'arrivée (${etaHours}) mais se referme rapidement (${closingHours}). Ne tardez pas.`,
    };
  }

  return {
    status: 'PASSABLE',
    etaDate,
    effectiveClosingDate,
    safetyMarginMinutes,
    message: `${params.passageName} : praticable à votre arrivée estimée (${etaHours}). Fermeture à ${closingHours}.`,
  };
}
