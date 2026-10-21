import type { ContextualRules } from '../db/schema';
import type {
  ContextBadge,
  ContextEvaluationResult,
  PassageStatus,
  TideStatus,
  WeatherContext,
  WindCardinal,
} from './types/context';

export interface PlaceWithContextRules {
  slug: string;
  name: string;
  contextualRules: Omit<ContextualRules, 'shelteredFromWindDirections'> & {
    shelteredFromWindDirections?: readonly WindCardinal[];
  };
  isSponsored?: boolean;
}

/**
 * Évalue l'adéquation d'un lieu à l'instant T selon la marée, le vent et la météo.
 * Fonction 100% pure, exécutable sur serveur et client (isomorphe).
 *
 * @param place - Données du lieu avec ses règles contextuelles
 * @param currentTime - Horodatage de l'évaluation
 * @param tideContext - État de la marée au port de référence
 * @param weatherContext - Conditions météorologiques locales (vent, pluie, etc.)
 * @param passageContext - État optionnel d'un passage submersible (Berder, Tascon...)
 * @returns Résultat d'évaluation comprenant badge, score (0-100), raison principale et détails
 */
export function evaluatePlaceContext(
  place: PlaceWithContextRules,
  currentTime: Date,
  tideContext: TideStatus,
  weatherContext: WeatherContext,
  passageContext?: PassageStatus
): ContextEvaluationResult {
  const rules = place.contextualRules;
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
        primaryReason = 'Baignade idéale actuellement (marée haute)';
        reasons.push('Profondeur d’eau optimale pour la baignade.');
      } else if (isMidTide) {
        score += 10;
        primaryReason = 'Baignade praticable (mi-marée)';
        reasons.push('Hauteur d’eau correcte, pente douce.');
      } else {
        score -= 40;
        forceBadge = 'UNSUITABLE';
        primaryReason = 'Baignade déconseillée actuellement (marée basse)';
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
      if (!primaryReason) {
        primaryReason = 'Praticable à toute heure de marée';
      }
      reasons.push('Lieu accessible indépendamment du niveau de la mer.');
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
    reasons.push(`Plage bien abritée du vent de ${weatherContext.windCardinal}.`);
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
      primaryReason = 'Idéal par temps de pluie (visite abritée)';
      reasons.push('Site couvert ou abrité des intempéries.');
    } else {
      score -= 30;
      if (!forceBadge && score < 70) {
        forceBadge = 'WARNING';
      }
      primaryReason = 'Activité de plein air déconseillée sous la pluie';
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

  return {
    placeSlug: place.slug,
    badge,
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
export function sortPlacesByContext<T extends ContextEvaluationResult & { isSponsored?: boolean }>(
  evaluations: T[]
): T[] {
  return [...evaluations].sort((a, b) => {
    const scoreA = a.score + (a.isSponsored ? 2 : 0);
    const scoreB = b.score + (b.isSponsored ? 2 : 0);
    return scoreB - scoreA;
  });
}
