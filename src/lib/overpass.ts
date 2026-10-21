import { db as defaultDb } from '../db/index.js';
import { places, amenities } from '../db/schema.js';
import type { OverpassElement, OverpassResponse, OsmSyncReport } from './types/osm.js';
import type { NewPlace, NewAmenity } from '../db/schema.js';

export const MORBIHAN_BBOX = '47.45,-3.25,47.75,-2.60';

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

/**
 * Construit la requête Overpass QL optimisée pour le Morbihan littoral.
 * @param bbox Boîte englobante au format minLat,minLon,maxLat,maxLon
 */
export function buildOverpassQuery(bbox = MORBIHAN_BBOX): string {
  return `[out:json][timeout:30];
(
  node["leisure"="slipway"](${bbox});
  way["leisure"="slipway"](${bbox});
  node["amenity"="drinking_water"](${bbox});
  node["amenity"="toilets"](${bbox});
  way["amenity"="toilets"](${bbox});
  node["leisure"="picnic_table"](${bbox});
  node["amenity"="bicycle_parking"](${bbox});
  node["amenity"="shower"](${bbox});
  node["emergency"="defibrillator"](${bbox});
  node["shop"="bakery"](${bbox});
);
out center tags;`;
}

/**
 * Déduit le type d'équipement normalisé à partir des tags OSM.
 * @param tags Dictionnaire des attributs OSM de l'élément
 */
function mapOsmTagToAmenityType(tags: Record<string, string>): NewAmenity['type'] {
  if (tags.amenity === 'drinking_water') return 'DRINKING_WATER';
  if (tags.amenity === 'toilets') return 'TOILETS';
  if (tags.leisure === 'picnic_table') return 'PICNIC_TABLE';
  if (tags.amenity === 'bicycle_parking') return 'BICYCLE_PARKING';
  if (tags.amenity === 'shower') return 'BEACH_SHOWER';
  if (tags.emergency === 'defibrillator') return 'DEFIBRILLATOR';
  if (tags.shop === 'bakery') return 'BAKERY';
  return 'OTHER';
}

/**
 * Partitionne les éléments OSM en cales (places) et commodités (amenities).
 * @param elements Liste d'éléments bruts retournés par Overpass
 */
export function routeOsmElements(elements: OverpassElement[]): {
  slipways: NewPlace[];
  amenities: NewAmenity[];
} {
  const slipways: NewPlace[] = [];
  const amenitiesList: NewAmenity[] = [];

  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;

    const tags = el.tags ?? {};

    // Cale de mise à l'eau -> places
    if (tags.leisure === 'slipway') {
      const extId = `osm:${el.type}:${el.id}`;
      const name = tags.name || `Cale de mise à l'eau (${el.id})`;
      const isHighTide = tags.tidal === 'yes' || tags.tide === 'high';

      slipways.push({
        externalId: extId,
        slug: `cale-${el.id}`,
        name,
        shortDescription: tags.description || "Cale de mise à l'eau répertoriée sur OpenStreetMap.",
        category: 'NAUTICAL',
        commune: tags['addr:city'] || 'Golfe du Morbihan',
        communeSlug: 'golfe-du-morbihan',
        sector: 'ARRADON',
        latitude: lat,
        longitude: lon,
        contextualRules: {
          tideConstraint: isHighTide ? 'HIGH_TIDE_ONLY' : 'ALL_TIDES',
          dogsAllowedSummer: true,
          strollerFriendly: true,
          rainFriendly: false,
        },
      });
    } else {
      // Autres équipements pratiques -> amenities
      const osmId = `${el.type}:${el.id}`;
      const type = mapOsmTagToAmenityType(tags);

      amenitiesList.push({
        osmId,
        type,
        name: tags.name || null,
        latitude: lat,
        longitude: lon,
        properties: tags,
      });
    }
  }

  return { slipways, amenities: amenitiesList };
}

/**
 * Exécute la requête Overpass avec fallback automatique sur miroir.
 * @param query Requête Overpass QL
 */
export async function fetchOverpassElements(query = buildOverpassQuery()): Promise<OverpassElement[]> {
  let lastError: Error | null = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(35000),
      });

      if (res.ok) {
        const json = (await res.json()) as OverpassResponse;
        return json.elements ?? [];
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error('All Overpass mirrors failed');
}

/**
 * Synchronise les données OSM en base avec upsert idempotent.
 * @param dbClient Client Drizzle optionnel pour injection de dépendance en test
 */
export async function syncOsmData(dbClient: any = defaultDb): Promise<OsmSyncReport> {
  const report: OsmSyncReport = {
    success: true,
    slipwaysUpserted: 0,
    amenitiesUpserted: 0,
    totalParsed: 0,
    errors: [],
  };

  try {
    const rawElements = await fetchOverpassElements();
    report.totalParsed = rawElements.length;

    const { slipways, amenities: amenityItems } = routeOsmElements(rawElements);

    // Upsert des cales dans places
    for (const slip of slipways) {
      try {
        await dbClient
          .insert(places)
          .values(slip)
          .onConflictDoUpdate({
            target: places.externalId,
            set: {
              name: slip.name,
              latitude: slip.latitude,
              longitude: slip.longitude,
              updatedAt: new Date(),
            },
          });
        report.slipwaysUpserted++;
      } catch (err) {
        report.errors.push(`Slipway ${slip.externalId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Upsert des équipements dans amenities
    for (const item of amenityItems) {
      try {
        await dbClient
          .insert(amenities)
          .values(item)
          .onConflictDoUpdate({
            target: amenities.osmId,
            set: {
              name: item.name,
              latitude: item.latitude,
              longitude: item.longitude,
              properties: item.properties,
              updatedAt: new Date(),
            },
          });
        report.amenitiesUpserted++;
      } catch (err) {
        report.errors.push(`Amenity ${item.osmId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch (err) {
    report.success = false;
    report.errors.push(`Overpass fetch failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return report;
}
