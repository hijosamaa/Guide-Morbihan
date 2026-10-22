import type { ContextualRules } from '../db/schema';
import type {
  ContextBadge,
  ContextEvaluationResult,
  EvaluationStatus,
  MarineWeatherContext,
  PassageStatus,
  Place,
  PlaceCategory,
  TidePoint,
  TideStatus,
  WeatherContext,
  WindCardinal,
} from './types/context';

export interface PlaceWithContextRules {
  slug: string;
  name: string;
  category?: PlaceCategory | (string & {});
  contextualRules: Omit<ContextualRules, 'shelteredFromWindDirections'> & {
    shelteredFromWindDirections?: readonly WindCardinal[] | WindCardinal[];
  };
  isSponsored?: boolean;
}

/**
 * Évalue l'adéquation d'un lieu à l'instant T selon la marée, le vent et la météo.
 * Fonction 100% pure, exécutable sur serveur et client (isomorphe).
 *
 * @param place - Données du lieu avec ses règles contextuelles et sa catégorie optionnelle
 * @param currentTime - Horodatage de l'évaluation
 * @param tideContext - État de la marée au port de référence
 * @param weatherContext - Conditions météorologiques locales (vent, pluie, etc.)
 * @param passageContext - État optionnel d'un passage submersible (Berder, Tascon...)
 * @returns Résultat d'évaluation comprenant badge, statut, libellé contextualisé, score et détails
 */
export function evaluatePlaceContext(
  place: PlaceWithContextRules | Place,
  currentTime: Date,
  tideContext: TideStatus,
  weatherContext: WeatherContext,
  passageContext?: PassageStatus
): ContextEvaluationResult;

export function evaluatePlaceContext(
  place: PlaceWithContextRules | Place,
  context: MarineWeatherContext,
  tidePredictions?: unknown
): ContextEvaluationResult;

export function evaluatePlaceContext(
  place: PlaceWithContextRules | Place,
  currentTimeOrContext: Date | MarineWeatherContext,
  tideContextOrPredictions?: unknown,
  weatherContextParam?: WeatherContext,
  passageContextParam?: PassageStatus
): ContextEvaluationResult {
  let currentTime: Date;
  let tideContext: TideStatus;
  let weatherContext: WeatherContext;
  let passageContext: PassageStatus | undefined;

  if (currentTimeOrContext instanceof Date) {
    currentTime = currentTimeOrContext;
    tideContext = tideContextOrPredictions as TideStatus;
    weatherContext = weatherContextParam!;
    passageContext = passageContextParam;
  } else {
    const marineCtx = currentTimeOrContext;
    const rawTide = marineCtx.tideStatus as any;
    const harbor = (rawTide?.harbor as 'PORT_NAVALO' | 'VANNES') || 'VANNES';
    const now = rawTide?.timestamp ?? (rawTide?.nextTide?.time ?? new Date());
    currentTime = now;

    weatherContext = {
      sector: marineCtx.sector || 'VANNES',
      tempCelsius: marineCtx.tempCelsius,
      windSpeedKnots: marineCtx.windSpeedKnots,
      windDirectionDeg: marineCtx.windDirectionDeg,
      windCardinal: marineCtx.windCardinal,
      weatherCode: marineCtx.weatherCode ?? (marineCtx.isRaining ? 61 : 1),
      isRaining: marineCtx.isRaining,
    };

    if (rawTide && rawTide.previousEvent && rawTide.nextEvent) {
      tideContext = rawTide as TideStatus;
    } else {
      const currentHeight = rawTide?.currentHeight ?? rawTide?.waterHeightMeters ?? 2.0;
      const phase = (rawTide?.phase as any) || 'FLOOD';
      const coefficient = rawTide?.coefficient ?? 70;
      const nextTide = rawTide?.nextTide;

      let nextEvent: TidePoint;
      let previousEvent: TidePoint;

      if (nextTide) {
        const nextTimeMs = nextTide.time.getTime();
        nextEvent = {
          harbor,
          eventType: nextTide.type,
          eventTimestamp: nextTide.time,
          heightMeters: nextTide.height,
          coefficient,
        };
        const prevType = nextTide.type === 'LOW' ? 'HIGH' : 'LOW';
        const prevHeight = nextTide.type === 'LOW' ? 4.2 : 0.8;
        previousEvent = {
          harbor,
          eventType: prevType,
          eventTimestamp: new Date(nextTimeMs - 22320000), // 6.2 * 3600000
          heightMeters: prevHeight,
          coefficient,
        };
      } else {
        const nowMs = now.getTime();
        nextEvent = {
          harbor,
          eventType: 'HIGH',
          eventTimestamp: new Date(nowMs + 10800000),
          heightMeters: 4.2,
          coefficient,
        };
        previousEvent = {
          harbor,
          eventType: 'LOW',
          eventTimestamp: new Date(nowMs - 11520000),
          heightMeters: 0.8,
          coefficient,
        };
      }

      tideContext = {
        harbor,
        timestamp: currentTime,
        waterHeightMeters: currentHeight,
        phase,
        coefficient,
        previousEvent,
        nextEvent,
        minutesToNextEvent: Math.max(0, Math.round((nextEvent.eventTimestamp.getTime() - currentTime.getTime()) / 60000)),
        tidalRangeMeters: Math.abs(nextEvent.heightMeters - previousEvent.heightMeters),
      };
    }

    passageContext = undefined;
  }

  const rules = place.contextualRules;
  const category = (place as { category?: string }).category;
  const isHeritage = category === 'HERITAGE';
  const isGastronomy = category === 'GASTRONOMY';
  const isViewpoint = category === 'VIEWPOINT';
  const isBeach = category === 'BEACH';

  const reasons: string[] = [];
  let score = 50;
  let forceBadge: ContextBadge | null = null;
  let primaryReason = '';

  // 1. Évaluation de la contrainte de marée
  switch (rules.tideConstraint) {
    case 'HIGH_TIDE_ONLY': {
      // Baignade optimale à marée haute (PM ± 2h30 par défaut)
      const offsetBefore = rules.tideOffsetHours?.beforeHigh ?? 2.5;
      const offsetAfter = rules.tideOffsetHours?.afterHigh ?? 2.5;
      const midBefore = offsetBefore + 1.0;
      const midAfter = offsetAfter + 1.0;

      const isHighTideNear =
        (tideContext.previousEvent.eventType === 'HIGH' &&
          Math.abs(currentTime.getTime() - tideContext.previousEvent.eventTimestamp.getTime()) <= offsetAfter * 3600000) ||
        (tideContext.nextEvent.eventType === 'HIGH' &&
          Math.abs(tideContext.nextEvent.eventTimestamp.getTime() - currentTime.getTime()) <= offsetBefore * 3600000);

      const isMidTide =
        (tideContext.previousEvent.eventType === 'HIGH' &&
          Math.abs(currentTime.getTime() - tideContext.previousEvent.eventTimestamp.getTime()) <= midAfter * 3600000) ||
        (tideContext.nextEvent.eventType === 'HIGH' &&
          Math.abs(tideContext.nextEvent.eventTimestamp.getTime() - currentTime.getTime()) <= midBefore * 3600000);

      if (isHighTideNear) {
        score += 35;
        primaryReason = isBeach
          ? 'Baignade idéale actuellement'
          : 'Baignade idéale actuellement (marée haute)';
        reasons.push('Profondeur d’eau optimale pour la baignade.');
      } else if (isMidTide) {
        score += 10;
        primaryReason = 'Baignade praticable (mi-marée)';
        reasons.push('Hauteur d’eau correcte, pente douce.');
      } else {
        score -= 40;
        forceBadge = 'UNSUITABLE';
        primaryReason = isBeach
          ? 'Basse mer : estran découvert'
          : 'Baignade déconseillée actuellement (marée basse)';
        reasons.push('Estran découvert, présence de vase ou accès à l’eau difficile.');
      }
      break;
    }

    case 'LOW_TIDE_ONLY': {
      // Passages submersibles ou pêche à pied
      if (passageContext) {
        if (passageContext.status === 'OPEN') {
          score += 40;
          primaryReason = `Passage praticable au sec (encore ${passageContext.minutesRemaining} min)`;
          reasons.push(`Accès piéton sécurisé (${passageContext.source === 'OFFICIAL' ? 'Horaires officiels' : 'Calcul estimé'}).`);
        } else if (passageContext.status === 'CLOSING_SOON') {
          score -= 10;
          forceBadge = 'WARNING';
          primaryReason = `⚠️ Fermeture imminente dans ${passageContext.minutesRemaining} min`;
          reasons.push('Regagnez la rive immédiatement avant submersion complète de la chaussée.');
        } else if (passageContext.status === 'OPENING_SOON') {
          score -= 15;
          forceBadge = 'WARNING';
          primaryReason = `Ouverture du passage imminente (dans ${passageContext.minutesRemaining} min)`;
          reasons.push('La mer se retire, chaussée bientôt praticable au sec.');
        } else {
          score -= 50;
          forceBadge = 'UNSUITABLE';
          primaryReason = 'Passage submersible sous l’eau';
          reasons.push('Chaussée recouverte par la mer.');
        }
      } else {
        // Fallback sans contexte de passage (pêche à pied, etc.)
        const offsetBefore = rules.tideOffsetHours?.beforeLow ?? 2;
        const offsetAfter = rules.tideOffsetHours?.afterLow ?? 2;
        const isNearLow =
          (tideContext.previousEvent.eventType === 'LOW' &&
            Math.abs(currentTime.getTime() - tideContext.previousEvent.eventTimestamp.getTime()) <= offsetAfter * 3600000) ||
          (tideContext.nextEvent.eventType === 'LOW' &&
            Math.abs(tideContext.nextEvent.eventTimestamp.getTime() - currentTime.getTime()) <= offsetBefore * 3600000);

        if (isNearLow) {
          score += 35;
          primaryReason = 'Idéal à marée basse (estran accessible)';
          reasons.push('Pêche à pied et découverte de l’estran.');
        } else {
          score -= 30;
          forceBadge = 'UNSUITABLE';
          primaryReason = 'Estran recouvert par la mer';
          reasons.push('Praticable uniquement autour de la basse mer.');
        }
      }
      break;
    }

    case 'MID_TIDE_FLOW': {
      // Spectacle de courant marin (Courant de la Jument)
      const isSlack = tideContext.phase === 'SLACK_HIGH' || tideContext.phase === 'SLACK_LOW';
      if (!isSlack) {
        score += 35;
        primaryReason = 'Courant marin spectaculaire à mi-marée';
        reasons.push('Vitesse de courant maximale, marmites et bouillonnements saisissants.');
      } else {
        score -= 20;
        primaryReason = 'Courant calme en période d’étale';
        reasons.push('Activité du courant réduite aux heures de pleine et basse mer.');
      }
      break;
    }

    case 'ALL_TIDES':
    default: {
      score += 20;
      if (isHeritage) {
        if (!primaryReason) {
          primaryReason = 'Visite conseillée';
        }
        reasons.push('Site culturel et patrimonial accessible en toute saison.');
      } else if (isGastronomy) {
        if (!primaryReason) {
          primaryReason = 'Idéal pour une pause gourmande';
        }
        reasons.push('Pause gourmande accessible indépendamment de la marée.');
      } else if (isViewpoint) {
        if (!primaryReason) {
          primaryReason = 'Vue dégagée';
        }
        reasons.push('Point de vue panoramique accessible à toute heure.');
      } else {
        if (!primaryReason) {
          primaryReason = 'Praticable à toute heure de marée';
        }
        reasons.push('Lieu accessible indépendamment du niveau de la mer.');
      }
      break;
    }
  }

  // 2. Évaluation de l'abri au vent
  let isSheltered = false;
  if (
    rules.shelteredFromWindDirections &&
    rules.shelteredFromWindDirections.length > 0 &&
    rules.shelteredFromWindDirections.includes(weatherContext.windCardinal)
  ) {
    isSheltered = true;
    score += 15;
    reasons.push(
      isBeach
        ? `Plage bien abritée du vent de ${weatherContext.windCardinal}.`
        : `Site bien abrité du vent de ${weatherContext.windCardinal}.`
    );
  } else if (weatherContext.windSpeedKnots >= 20) {
    score -= 15;
    if (!forceBadge) {
      forceBadge = 'WARNING';
    }
    reasons.push(`Exposé au vent fort (${Math.round(weatherContext.windSpeedKnots)} nds).`);
  }

  // 3. Évaluation de la pluie et couverture
  if (weatherContext.isRaining) {
    if (rules.rainFriendly) {
      score += 30;
      primaryReason = isHeritage
        ? 'Idéal par temps pluvieux'
        : 'Idéal par temps de pluie (visite abritée)';
      reasons.push('Site couvert ou abrité des intempéries.');
    } else {
      score -= 30;
      if (!forceBadge && score < 70) {
        forceBadge = 'WARNING';
      }
      primaryReason = isViewpoint
        ? 'Visibilité réduite sous la pluie'
        : 'Activité de plein air déconseillée sous la pluie';
      reasons.push('Activité de plein air déconseillée sous la pluie.');
    }
  }

  // 4. Normalisation finale du score (borné entre 0 et 100)
  score = Math.max(0, Math.min(100, Math.round(score)));

  // 5. Attribution du badge contextuel
  let badge: ContextBadge;
  if (forceBadge) {
    badge = forceBadge;
  } else if (score >= 70) {
    badge = 'IDEAL';
  } else if (score >= 40) {
    badge = 'WARNING';
  } else {
    badge = 'UNSUITABLE';
  }

  const status: EvaluationStatus = badge === 'UNSUITABLE' ? 'DISCOURAGED' : badge;

  // 6. Libellé du badge adapté à la catégorie
  let badgeLabel = primaryReason || 'Conditions actuelles';
  if (isHeritage) {
    badgeLabel = weatherContext.isRaining ? 'Idéal par temps pluvieux' : 'Visite conseillée';
  } else if (isGastronomy) {
    badgeLabel = 'Idéal pour une pause gourmande';
  } else if (isViewpoint) {
    badgeLabel = weatherContext.isRaining ? 'Visibilité réduite sous la pluie' : 'Vue dégagée';
  } else if (isBeach) {
    if (badge === 'IDEAL') {
      badgeLabel = 'Baignade idéale actuellement';
    } else if (rules.tideConstraint === 'HIGH_TIDE_ONLY' && (forceBadge === 'UNSUITABLE' || score < 50)) {
      badgeLabel = 'Basse mer : estran découvert';
    }
  }

  return {
    placeSlug: place.slug,
    badge,
    status,
    badgeLabel,
    score,
    titleReason: primaryReason || 'Conditions actuelles',
    reasons,
    isSheltered,
    isSponsored: place.isSponsored,
    tideContext: {
      harbor: tideContext.harbor,
      waterHeightMeters: tideContext.waterHeightMeters,
      phase: tideContext.phase,
    },
    passageContext,
  };
}

/**
 * Trie une liste d'évaluations contextuelles par pertinence décroissante.
 * En cas d'égalité, les lieux sponsorisés bénéficient d'un léger avantage (+2 pts).
 *
 * @param evaluations - Liste des résultats d'évaluation de lieux
 * @returns Nouvelle liste triée par score descendant
 */
export function sortPlacesByContext<T extends { score: number; isSponsored?: boolean }>(
  evaluations: T[]
): T[] {
  return [...evaluations].sort((a, b) => {
    const scoreA = a.score + (a.isSponsored ? 2 : 0);
    const scoreB = b.score + (b.isSponsored ? 2 : 0);
    return scoreB - scoreA;
  });
}
