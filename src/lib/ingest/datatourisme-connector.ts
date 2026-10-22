import { resolveSectorByCoords } from './spatial-heuristics';
import type { WindCardinal } from '../types/context';

const REJECTED_TYPES = new Set([
  'camping',
  'accommodation',
  'hotel',
  'hoteltrade',
  'collectiveaccommodation',
  'rentalaccommodation',
  'guesthouse',
  'lodgingbusiness',
  'holidayresort',
  'selfcateringaccommodation',
]);

const ACCEPTED_TYPES = new Set([
  'naturalheritage',
  'culturalheritage',
  'beach',
  'viewpoint',
  'siteandmonument',
  'tastingprovider',
  'sportsandleisureplace',
  'parkandgarden',
  'dolmen',
  'megalith',
  'localproduce',
  'cove',
  'headland',
  'island',
  'lakeorpond',
  'castle',
  'religioussite',
  'remembranceplace',
  'museum',
  'harbour',
]);

export interface PartialPlace {
  externalId?: string;
  slug: string;
  name: string;
  shortDescription: string;
  fullDescription?: string;
  category: 'BEACH' | 'TRAIL' | 'TIDAL_PASSAGE' | 'HERITAGE' | 'GASTRONOMY' | 'NAUTICAL' | 'VIEWPOINT';
  commune: string;
  communeSlug: string;
  sector: string;
  latitude: number;
  longitude: number;
  contextualRules: {
    tideConstraint: 'ALL_TIDES' | 'HIGH_TIDE_ONLY' | 'LOW_TIDE_ONLY' | 'MID_TIDE_FLOW';
    shelteredFromWindDirections?: WindCardinal[];
    dogsAllowedSummer: boolean;
    strollerFriendly: boolean;
    rainFriendly: boolean;
  };
  sourceType: 'DATATOURISME';
  coverImageUrl?: string;
}

/**
 * Normalise un texte en slug URL (minuscules, sans accents, sans caractères spéciaux).
 */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Nettoie les balises HTML et les entités résiduelles des descriptions brutes DATAtourisme.
 */
export function cleanPlaceDescription(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Vérifie si la liste de types DATAtourisme correspond à un lieu d'intérêt acceptable
 * et ne contient aucun type d'hébergement ou camping rejeté.
 */
export function isAcceptedDatatourismeCategory(types: string[]): boolean {
  const normalized = types.map((t) => t.toLowerCase());
  for (const t of normalized) {
    if (REJECTED_TYPES.has(t)) return false;
  }
  for (const t of normalized) {
    if (ACCEPTED_TYPES.has(t)) return true;
  }
  return false;
}

/**
 * Extrait les types d'un objet DATAtourisme brut (compatible JSON-LD ou objet simplifié).
 */
function extractRecordTypes(record: Record<string, unknown>): string[] {
  let rawTypes: unknown[] = [];
  if (Array.isArray(record['@type'])) {
    rawTypes = record['@type'];
  } else if (typeof record['@type'] === 'string') {
    rawTypes = [record['@type']];
  } else if (Array.isArray(record.type)) {
    rawTypes = record.type;
  } else if (typeof record.type === 'string') {
    rawTypes = [record.type];
  }

  return rawTypes
    .filter((t): t is string => typeof t === 'string')
    .map((t) => {
      // Nettoie les URI comme "https://www.datatourisme.fr/ontology/core#NaturalHeritage"
      const fragment = t.includes('#') ? t.split('#').pop() : t.split('/').pop();
      return (fragment || t).trim();
    });
}

/**
 * Détermine si un enregistrement DATAtourisme est admissible pour notre guide.
 */
export function filterDatatourismeRecord(record: unknown): boolean {
  if (!record || typeof record !== 'object') return false;
  const types = extractRecordTypes(record as Record<string, unknown>);
  if (types.length === 0) return false;
  return isAcceptedDatatourismeCategory(types);
}

/**
 * Extrait les coordonnées (latitude, longitude) d'un enregistrement DATAtourisme brut.
 */
function extractCoordinates(rec: Record<string, unknown>): { lat: number; lng: number } | null {
  if (typeof rec.latitude === 'number' && typeof rec.longitude === 'number') {
    return { lat: rec.latitude, lng: rec.longitude };
  }

  // Schema.org isLocatedAt pattern
  if (Array.isArray(rec.isLocatedAt) && rec.isLocatedAt.length > 0) {
    const location = rec.isLocatedAt[0] as Record<string, unknown>;
    const geo = (location?.['schema:geo'] || location?.geo) as Record<string, unknown> | undefined;
    if (geo) {
      const lat = Number(geo['schema:latitude'] ?? geo.latitude);
      const lng = Number(geo['schema:longitude'] ?? geo.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng };
      }
    }
  }

  return null;
}

/**
 * Extrait le libellé principal du lieu.
 */
function extractLabel(rec: Record<string, unknown>): string | null {
  if (typeof rec.name === 'string' && rec.name.trim()) return rec.name.trim();
  if (typeof rec.label === 'string' && rec.label.trim()) return rec.label.trim();

  // rdfs:label multi-langue
  const rdfsLabel = rec['rdfs:label'] as Record<string, unknown> | undefined;
  if (rdfsLabel && typeof rdfsLabel === 'object') {
    if (Array.isArray(rdfsLabel.fr) && rdfsLabel.fr[0]) return String(rdfsLabel.fr[0]).trim();
    if (typeof rdfsLabel.fr === 'string') return rdfsLabel.fr.trim();
  }

  const labelObj = rec.label as Record<string, unknown> | undefined;
  if (labelObj && typeof labelObj === 'object') {
    if (Array.isArray(labelObj.fr) && labelObj.fr[0]) return String(labelObj.fr[0]).trim();
    if (typeof labelObj.fr === 'string') return labelObj.fr.trim();
  }

  return null;
}

/**
 * Extrait la description textuelle d'un lieu.
 */
function extractDescription(rec: Record<string, unknown>): { shortDesc: string; fullDesc?: string } {
  let shortDesc = '';
  let fullDesc: string | undefined;

  if (typeof rec.description === 'string') {
    shortDesc = cleanPlaceDescription(rec.description);
  }

  if (Array.isArray(rec.hasDescription) && rec.hasDescription.length > 0) {
    const descObj = rec.hasDescription[0] as Record<string, unknown>;
    const shortVal = descObj.shortDescription as Record<string, unknown> | string | undefined;
    if (typeof shortVal === 'string') {
      shortDesc = cleanPlaceDescription(shortVal);
    } else if (shortVal && Array.isArray(shortVal.fr) && shortVal.fr[0]) {
      shortDesc = cleanPlaceDescription(String(shortVal.fr[0]));
    }

    const fullVal = (descObj['dc:description'] || descObj.description) as Record<string, unknown> | string | undefined;
    if (typeof fullVal === 'string') {
      fullDesc = cleanPlaceDescription(fullVal);
    } else if (fullVal && Array.isArray(fullVal.fr) && fullVal.fr[0]) {
      fullDesc = cleanPlaceDescription(String(fullVal.fr[0]));
    }
  }

  return { shortDesc, fullDesc };
}

/**
 * Extrait la commune d'un lieu.
 */
function extractCommune(rec: Record<string, unknown>): string {
  if (typeof rec.commune === 'string' && rec.commune.trim()) return rec.commune.trim();

  if (Array.isArray(rec.isLocatedAt) && rec.isLocatedAt.length > 0) {
    const loc = rec.isLocatedAt[0] as Record<string, unknown>;
    const address = (loc?.['schema:address'] || loc?.address) as unknown;
    if (Array.isArray(address) && address[0]) {
      const city = address[0]['schema:addressLocality'] || address[0].addressLocality;
      if (typeof city === 'string' && city.trim()) return city.trim();
    } else if (address && typeof address === 'object') {
      const city = (address as Record<string, unknown>)['schema:addressLocality'] || (address as Record<string, unknown>).addressLocality;
      if (typeof city === 'string' && city.trim()) return city.trim();
    }
  }

  return 'Golfe du Morbihan';
}

/**
 * Associe une catégorie métier interne en fonction des types DATAtourisme.
 */
function resolveCategory(types: string[]): PartialPlace['category'] {
  const lower = types.map((t) => t.toLowerCase());
  if (lower.some((t) => t.includes('beach') || t.includes('cove'))) {
    return 'BEACH';
  }
  if (lower.some((t) => t.includes('viewpoint') || t.includes('panorama'))) {
    return 'VIEWPOINT';
  }
  if (lower.some((t) => t.includes('trail') || t.includes('touringroute') || t.includes('walkingtour'))) {
    return 'TRAIL';
  }
  if (lower.some((t) => t.includes('tastingprovider') || t.includes('localproduce') || t.includes('foodestablishment'))) {
    return 'GASTRONOMY';
  }
  if (lower.some((t) => t.includes('harbour') || t.includes('marina') || t.includes('watersportscentre'))) {
    return 'NAUTICAL';
  }
  return 'HERITAGE';
}

/**
 * Transforme un enregistrement DATAtourisme en objet lieu partiel prêt pour l'ingestion ou le merge.
 * Retourne null si l'enregistrement ne respecte pas les critères d'acceptation ou manque de coordonnées.
 */
export function mapDatatourismeToPlace(record: unknown): PartialPlace | null {
  if (!filterDatatourismeRecord(record)) return null;
  const rec = record as Record<string, unknown>;

  const coords = extractCoordinates(rec);
  if (!coords) return null;

  const rawName = extractLabel(rec);
  if (!rawName) return null;
  const name = cleanPlaceDescription(rawName);

  const types = extractRecordTypes(rec);
  const category = resolveCategory(types);

  const commune = extractCommune(rec);
  const communeSlug = slugify(commune);

  const { shortDesc, fullDesc } = extractDescription(rec);
  const finalShortDesc = shortDesc || `${name}, site remarquable situé à ${commune}.`;

  const externalId = (typeof rec['@id'] === 'string' ? rec['@id'] : typeof rec.id === 'string' ? rec.id : undefined);
  const slug = (typeof rec.slug === 'string' && rec.slug.trim()) ? rec.slug.trim() : slugify(`${name}-${commune}`);
  const sector = resolveSectorByCoords(coords.lat, coords.lng);

  // Règles contextuelles par défaut selon la typologie du lieu
  const contextualRules: PartialPlace['contextualRules'] = {
    tideConstraint: category === 'BEACH' ? 'HIGH_TIDE_ONLY' : 'ALL_TIDES',
    shelteredFromWindDirections: category === 'BEACH' ? ['N', 'NE'] : undefined,
    dogsAllowedSummer: category !== 'BEACH',
    strollerFriendly: category !== 'TRAIL',
    rainFriendly: category === 'HERITAGE' || category === 'GASTRONOMY',
  };

  return {
    externalId,
    slug,
    name,
    shortDescription: finalShortDesc.slice(0, 300),
    fullDescription: fullDesc,
    category,
    commune,
    communeSlug,
    sector,
    latitude: coords.lat,
    longitude: coords.lng,
    contextualRules,
    sourceType: 'DATATOURISME',
  };
}
