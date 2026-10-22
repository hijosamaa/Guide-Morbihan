import { calculateDayTides, type DayTidesSummary } from '../tide-engine';
import type {
  BaseSector,
  EscapadeDay,
  EscapadeMoment,
  EscapadePlace,
  EscapadePlan,
  EscapadeProfile,
  MomentType,
} from './types';

/**
 * Rotation géographique logique évitant les traversées de goulet et les bouchons d'été.
 * 1 jour = 1 seul secteur. Jours suivants = secteurs adjacents cohérents.
 */
export const SECTOR_ROTATION: Record<BaseSector, BaseSector[]> = {
  'Presqu-ile de Rhuys': ['Presqu-ile de Rhuys', 'Golfe', 'Ria d-Etel'],
  Golfe: ['Golfe', 'Presqu-ile de Rhuys', 'Presqu-ile de Quiberon'],
  'Presqu-ile de Quiberon': ['Presqu-ile de Quiberon', 'Ria d-Etel', 'Golfe'],
  'Ria d-Etel': ['Ria d-Etel', 'Presqu-ile de Quiberon', 'Golfe'],
};

const MOMENTS_CONFIG: { type: MomentType; title: string }[] = [
  { type: 'MATIN', title: 'Matinée iodée' },
  { type: 'DEJEUNER', title: 'Pause Déjeuner' },
  { type: 'APRES_MIDI', title: 'Après-midi marée' },
  { type: 'FIN_JOURNEE', title: 'Fin de journée' },
];

/**
 * Résout le port marégraphique approprié pour le secteur.
 */
function resolveHarborForSector(sector: BaseSector): 'PORT_NAVALO' | 'VANNES' {
  if (sector === 'Golfe') {
    return 'VANNES';
  }
  return 'PORT_NAVALO';
}

/**
 * Évalue l'adéquation d'un lieu pour un moment donné selon le profil et la marée.
 */
function scorePlaceForMoment(
  place: EscapadePlace,
  momentType: MomentType,
  profile: EscapadeProfile,
  tides: DayTidesSummary
): number {
  let score = 0;
  const category = place.category;
  const rules = place.contextualRules;

  switch (momentType) {
    case 'MATIN':
      if (category === 'HERITAGE') score += 15;
      else if (category === 'TRAIL') score += 12;
      else if (category === 'VIEWPOINT') score += 8;
      else if (category === 'NAUTICAL') score += 4;
      else if (category === 'BEACH') score += 2;
      else if (category === 'TIDAL_PASSAGE') score -= 15; // Préserve le passage pour l'après-midi marée
      else score += 1;

      if (profile.profileType === 'FAMILY' && rules?.strollerFriendly) score += 6;
      if (profile.profileType === 'NATURE' && (category === 'TRAIL' || category === 'VIEWPOINT')) score += 8;
      if (profile.profileType === 'HERITAGE_GOURMET' && category === 'HERITAGE') score += 8;
      break;

    case 'DEJEUNER':
      if (category === 'GASTRONOMY') score += 30;
      else if (category === 'HERITAGE') score += 6;
      else if (category === 'VIEWPOINT') score += 4;
      else if (category === 'BEACH') score += 2;
      else if (category === 'TIDAL_PASSAGE') score -= 20; // Ne pas programmer de pause déjeuner sur une chaussée submersible
      else score += 1;

      if (profile.profileType === 'FAMILY' && rules?.strollerFriendly) score += 4;
      if (profile.profileType === 'HERITAGE_GOURMET' && category === 'GASTRONOMY') score += 6;
      break;

    case 'APRES_MIDI':
      if (tides.isAfternoonLow) {
        // Marée basse : passage submersible ou estran priorisé absolument
        if (category === 'TIDAL_PASSAGE') score += 50;
        else if (rules?.tideConstraint === 'LOW_TIDE_ONLY') score += 40;
        else if (category === 'BEACH') score += 10;
        else if (category === 'TRAIL') score += 8;
        else if (category === 'NAUTICAL') score += 6;
        else score += 2;
      } else if (tides.isAfternoonHigh) {
        // Marée haute : baignade priorisée
        if (category === 'BEACH') {
          score += 45;
          if (rules?.tideConstraint === 'HIGH_TIDE_ONLY') score += 15;
        } else if (category === 'NAUTICAL') score += 15;
        else if (category === 'HERITAGE') score += 6;
        else if (category === 'TRAIL') score += 6;
        else score += 2;
      } else {
        if (category === 'BEACH') score += 20;
        else if (category === 'TIDAL_PASSAGE') score += 18;
        else if (category === 'NAUTICAL') score += 12;
        else if (category === 'TRAIL') score += 8;
        else score += 2;
      }

      if (profile.profileType === 'FAMILY' && rules?.strollerFriendly) score += 4;
      if (profile.profileType === 'NATURE' && (category === 'TRAIL' || category === 'TIDAL_PASSAGE')) score += 6;
      break;

    case 'FIN_JOURNEE':
      if (category === 'VIEWPOINT') score += 25;
      else if (category === 'GASTRONOMY') score += 15;
      else if (category === 'HERITAGE') score += 8;
      else if (category === 'BEACH') score += 6;
      else if (category === 'TIDAL_PASSAGE') score -= 15;
      else score += 1;

      if (profile.profileType === 'HERITAGE_GOURMET' && (category === 'GASTRONOMY' || category === 'HERITAGE')) score += 6;
      if (profile.profileType === 'NATURE' && category === 'VIEWPOINT') score += 6;
      if (profile.profileType === 'FAMILY' && rules?.strollerFriendly) score += 4;
      break;
  }

  return score;
}

/**
 * Moteur déterministe d'escapade 100% Morbihan.
 * Respecte les 3 contraintes locales :
 * 1. Anti-bouchons : 1 jour = 1 seul secteur
 * 2. Ancrage marée : synchronisation avec tide-engine
 * 3. Blocs de vie : 4 moments naturels (Matin, Déjeuner, Après-midi, Fin de journée)
 */
export function generateEscapade(
  profile: EscapadeProfile,
  placesPool: EscapadePlace[],
  targetDate?: Date
): EscapadePlan {
  const baseDate = targetDate ? new Date(targetDate) : new Date();
  const numDays = Math.max(1, Math.min(profile.durationDays || 1, 3));
  const rotation = SECTOR_ROTATION[profile.baseSector] || [profile.baseSector, 'Golfe', 'Presqu-ile de Rhuys'];

  const days: EscapadeDay[] = [];

  for (let dayIndex = 1; dayIndex <= numDays; dayIndex++) {
    const dayDate = new Date(baseDate.getTime() + (dayIndex - 1) * 24 * 3600 * 1000);
    const dateStr = dayDate.toISOString().split('T')[0];
    const sector = rotation[(dayIndex - 1) % rotation.length] as BaseSector;
    const harbor = resolveHarborForSector(sector);
    const tides = calculateDayTides(dayDate, harbor);

    // Filtrage des lieux pour ce secteur (avec repli sur l'ensemble si vide)
    const sectorPlaces = placesPool.filter((p) => p.sector === sector);
    const candidatePool = sectorPlaces.length > 0 ? sectorPlaces : placesPool;

    const assignedIds = new Set<string>();
    const moments: EscapadeMoment[] = [];

    for (const { type, title } of MOMENTS_CONFIG) {
      // Calcul des scores pour chaque lieu candidat
      const scoredPlaces = candidatePool.map((p) => ({
        place: p,
        score: scorePlaceForMoment(p, type, profile, tides),
        id: p.id || p.slug || p.name,
      }));

      // Tri décroissant
      scoredPlaces.sort((a, b) => b.score - a.score);

      // Sélection prioritaire d'un lieu non encore attribué aujourd'hui
      const chosenEntry = scoredPlaces.find((item) => !assignedIds.has(item.id)) || scoredPlaces[0];
      const chosenPlace = chosenEntry.place;
      assignedIds.add(chosenEntry.id);

      // Pool d'alternatives immédiates (jusqu'à 2 lieux remplaçants du même secteur)
      const alternatives = scoredPlaces
        .filter((item) => item.id !== chosenEntry.id)
        .slice(0, 2)
        .map((item) => item.place);

      // Notice contextuelle de marée
      let tideNotice: string | undefined;
      if (type === 'APRES_MIDI') {
        if (chosenPlace.category === 'TIDAL_PASSAGE' || chosenPlace.contextualRules?.tideConstraint === 'LOW_TIDE_ONLY') {
          tideNotice = `Basse mer (coef ${tides.coefficient}) : créneau optimal pour traverser à pied sec`;
        } else if (chosenPlace.category === 'BEACH' && tides.isAfternoonHigh) {
          tideNotice = `Marée haute l'après-midi : mer formée, baignade optimale`;
        } else {
          tideNotice = tides.summaryText;
        }
      }

      moments.push({
        momentType: type,
        title,
        place: chosenPlace,
        alternatives,
        tideNotice,
      });
    }

    days.push({
      dayIndex,
      date: dateStr,
      sector,
      moments,
      tideSummary: tides,
      isRainMode: false,
    });
  }

  const cleanSectorSlug = profile.baseSector.toLowerCase().replace(/[^a-z0-9]/g, '-');
  return {
    id: `escapade-${cleanSectorSlug}-${numDays}j-${Date.now().toString(36)}`,
    profile,
    days,
    createdAt: new Date().toISOString(),
  };
}
