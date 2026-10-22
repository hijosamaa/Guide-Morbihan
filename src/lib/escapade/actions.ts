import type {
  EscapadeDay,
  EscapadeMoment,
  EscapadePlace,
  EscapadePlan,
  MomentType,
} from './types';

/**
 * Extrait une clé d'identification unique et stable pour un lieu.
 */
function getPlaceKey(place: EscapadePlace): string {
  return place.id || place.slug || place.name || '';
}

/**
 * Vérifie si deux lieux correspondent à la même entité.
 */
function isSamePlace(placeA: EscapadePlace, placeB: EscapadePlace): boolean {
  const keyA = getPlaceKey(placeA);
  const keyB = getPlaceKey(placeB);
  return Boolean(keyA && keyB && keyA === keyB);
}

/**
 * Vérifie si un lieu correspond à l'identifiant cible (id, slug ou nom).
 */
function isPlaceMatchingId(place: EscapadePlace, targetId: string): boolean {
  return (
    place.id === targetId ||
    place.slug === targetId ||
    place.name === targetId
  );
}

/**
 * Échange instantanément (0 ms) le spot d'un moment avec une alternative choisie.
 * Fonction pure garantissant l'immuabilité de l'EscapadePlan.
 *
 * @param plan Le plan d'escapade en cours.
 * @param dayIndex L'index du jour concerné (1, 2 ou 3).
 * @param momentType Le bloc de vie à modifier ('MATIN', 'DEJEUNER', 'APRES_MIDI', 'FIN_JOURNEE').
 * @param newPlaceId L'identifiant (id ou slug) du lieu remplaçant.
 * @param placesPool Pool global de lieux optionnel si non présent dans les alternatives immédiates.
 * @returns Une nouvelle référence d'EscapadePlan avec le lieu interverti.
 */
export function swapMomentPlace(
  plan: EscapadePlan,
  dayIndex: number,
  momentType: MomentType,
  newPlaceId: string,
  placesPool?: EscapadePlace[]
): EscapadePlan {
  if (!plan?.days || plan.days.length === 0) {
    return plan;
  }

  const targetDay = plan.days.find((d) => d.dayIndex === dayIndex);
  if (!targetDay) {
    return plan;
  }

  const targetMoment = targetDay.moments.find((m) => m.momentType === momentType);
  if (!targetMoment) {
    return plan;
  }

  // Si le lieu actuel est déjà le lieu cible, aucune modification
  if (isPlaceMatchingId(targetMoment.place, newPlaceId)) {
    return plan;
  }

  // Recherche du nouveau lieu : d'abord dans les alternatives du moment, sinon dans placesPool
  let replacementPlace = targetMoment.alternatives.find((alt) =>
    isPlaceMatchingId(alt, newPlaceId)
  );

  if (!replacementPlace && placesPool) {
    replacementPlace = placesPool.find((p) => isPlaceMatchingId(p, newPlaceId));
  }

  if (!replacementPlace) {
    return plan;
  }

  const currentPlace = targetMoment.place;

  // L'ancien lieu prend la place du nouveau dans la liste des alternatives
  const updatedAlternatives: EscapadePlace[] = [
    currentPlace,
    ...targetMoment.alternatives.filter((alt) => !isSamePlace(alt, replacementPlace!)),
  ];

  const updatedMoment: EscapadeMoment = {
    ...targetMoment,
    place: replacementPlace,
    alternatives: updatedAlternatives,
  };

  const updatedDays: EscapadeDay[] = plan.days.map((day) => {
    if (day.dayIndex !== dayIndex) {
      return day;
    }
    return {
      ...day,
      moments: day.moments.map((m) =>
        m.momentType === momentType ? updatedMoment : m
      ),
    };
  });

  return {
    ...plan,
    days: updatedDays,
  };
}

/**
 * Bascule en 1-clic le mode pluie (« ☔ Il pleut ») pour une journée spécifique.
 * - Si activé (isRainMode: true) : remplace les spots extérieurs par des alternatives
 *   abritées (rainFriendly: true) dans le même secteur géographique.
 * - Si désactivé (isRainMode: false) : restaure les spots extérieurs originaux.
 *
 * Fonction pure et immuable.
 *
 * @param plan Le plan d'escapade en cours.
 * @param dayIndex L'index du jour concerné (1, 2 ou 3).
 * @param placesPool Pool global de lieux optionnel pour trouver des alternatives couvertes.
 * @returns Une nouvelle référence d'EscapadePlan mis à jour.
 */
export function toggleDayRainMode(
  plan: EscapadePlan,
  dayIndex: number,
  placesPool?: EscapadePlace[]
): EscapadePlan {
  if (!plan?.days || plan.days.length === 0) {
    return plan;
  }

  const targetDay = plan.days.find((d) => d.dayIndex === dayIndex);
  if (!targetDay) {
    return plan;
  }

  const nextRainMode = !Boolean(targetDay.isRainMode);

  if (nextRainMode) {
    // PASSAGE EN MODE PLUIE
    const assignedKeys = new Set<string>();

    // Identifier les spots déjà couverts conservés pour éviter les doublons sur la journée
    for (const moment of targetDay.moments) {
      if (moment.place.contextualRules?.rainFriendly) {
        assignedKeys.add(getPlaceKey(moment.place));
      }
    }

    const updatedMoments: EscapadeMoment[] = targetDay.moments.map((moment) => {
      // Si le spot est déjà abrité, on le conserve tel quel
      if (moment.place.contextualRules?.rainFriendly) {
        return moment;
      }

      // Recherche d'un lieu de repli abrité dans le même secteur
      // 1. D'abord parmi les alternatives existantes du moment
      const rainAlts = moment.alternatives.filter(
        (alt) => alt.contextualRules?.rainFriendly
      );

      let chosenRainPlace = rainAlts.find(
        (alt) => !assignedKeys.has(getPlaceKey(alt))
      ) || rainAlts[0];

      // 2. Si aucune alternative abritée, recherche dans le pool global sur le même secteur
      if (!chosenRainPlace && placesPool) {
        const poolCandidates = placesPool.filter(
          (p) =>
            (!p.sector || p.sector === targetDay.sector) &&
            p.contextualRules?.rainFriendly
        );

        chosenRainPlace = poolCandidates.find(
          (p) => !assignedKeys.has(getPlaceKey(p))
        ) || poolCandidates[0];
      }

      // Si aucun lieu de repli trouvé, conserver le lieu actuel
      if (!chosenRainPlace) {
        return moment;
      }

      assignedKeys.add(getPlaceKey(chosenRainPlace));

      const updatedAlternatives: EscapadePlace[] = [
        moment.place,
        ...moment.alternatives.filter((alt) => !isSamePlace(alt, chosenRainPlace!)),
      ];

      return {
        ...moment,
        place: chosenRainPlace,
        alternatives: updatedAlternatives,
        originalPlace: moment.originalPlace ?? moment.place,
      };
    });

    const updatedDays: EscapadeDay[] = plan.days.map((day) =>
      day.dayIndex === dayIndex
        ? { ...day, isRainMode: true, moments: updatedMoments }
        : day
    );

    return {
      ...plan,
      days: updatedDays,
    };
  } else {
    // SORTIE DU MODE PLUIE (RESTAURATION EXTÉRIEUR)
    const updatedMoments: EscapadeMoment[] = targetDay.moments.map((moment) => {
      // 1. Si un originalPlace a été mémorisé, on le restaure directement
      if (moment.originalPlace) {
        const restoredPlace = moment.originalPlace;
        const updatedAlternatives: EscapadePlace[] = [
          moment.place,
          ...moment.alternatives.filter((alt) => !isSamePlace(alt, restoredPlace)),
        ];

        return {
          ...moment,
          place: restoredPlace,
          alternatives: updatedAlternatives,
          originalPlace: undefined,
        };
      }

      // 2. Si pas d'originalPlace explicite mais que le lieu actuel est abrité
      // et qu'une alternative extérieure existe, on la restaure
      if (moment.place.contextualRules?.rainFriendly) {
        const outdoorAlt = moment.alternatives.find(
          (alt) => alt.contextualRules?.rainFriendly === false || !alt.contextualRules?.rainFriendly
        );

        if (outdoorAlt) {
          const updatedAlternatives: EscapadePlace[] = [
            moment.place,
            ...moment.alternatives.filter((alt) => !isSamePlace(alt, outdoorAlt)),
          ];

          return {
            ...moment,
            place: outdoorAlt,
            alternatives: updatedAlternatives,
          };
        }
      }

      return moment;
    });

    const updatedDays: EscapadeDay[] = plan.days.map((day) =>
      day.dayIndex === dayIndex
        ? { ...day, isRainMode: false, moments: updatedMoments }
        : day
    );

    return {
      ...plan,
      days: updatedDays,
    };
  }
}
