# Bloc 3 — Pipelines d'Ingestion Open Data & Routes Cron Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter l'infrastructure d'alimentation asynchrone Open Data du Golfe du Morbihan : le connecteur Open-Meteo pour les 6 secteurs côtiers, le connecteur Overpass OpenStreetMap avec routage hybride (cales nautiques vers `places`, équipements pratiques vers `amenities`), le parseur GPX pur avec lissage altimétrique d'hystérésis (3 m), la route sécurisée `/api/cron/sync` protégée par `CRON_SECRET` et les scripts CLI dédiés.

**Architecture:** Architecture modulaire et pure en TypeScript strict sans framework lourd. Utilisation de `fetch` natif, de `@tmcw/togeojson` et `@xmldom/xmldom` pour l'analyse GPX, d'algorithmes géodésiques autonomes (Haversine, anti-bruit GPS) et de requêtes Drizzle ORM avec upsert idempotent. Aucun appel externe n'est déclenché par l'utilisateur final.

**Tech Stack:** Next.js 15 (Route Handlers App Router), TypeScript 5, Drizzle ORM, PostgreSQL / PostGIS, `@tmcw/togeojson`, `@xmldom/xmldom`, Node.js test runner (`tsx --test`).

**Spec:** [docs/superpowers/specs/2026-10-21-bloc-3-pipelines-open-data-et-cron-design.md](file:///Users/Moulitos/Documents/antigravity/Guide%20Morbihan/docs/superpowers/specs/2026-10-21-bloc-3-pipelines-open-data-et-cron-design.md)

## Global Constraints

- Standalone et zéro lock-in : aucun SDK propriétaire Vercel ou Supabase dans la couche de données.
- TypeScript en mode strict : zéro `any`, interfaces explicites pour chaque échange de données.
- Pas de dépendance géospatiale lourde : zéro `@turf/turf` monorepo (calculs Haversine et cardinaux codés en fonctions pures dans `src/lib/utils/geo.ts`).
- Résilience aux pannes : en cas d'indisponibilité ou timeout d'une API tierce, conservation absolue des données précédentes en base sans écrasement.
- 6 secteurs côtiers obligatoires : `VANNES`, `ARRADON`, `LOCMARIAQUER`, `SARZEAU`, `QUIBERON`, `ETEL`.
- Authentification par jeton Bearer sur `/api/cron/sync` avec retour `401 Unauthorized` si secret invalide.

---

### Task 1: Schéma Drizzle & Dépendances pour la table `amenities`

**Files:**
- Modify: `package.json`
- Modify: `src/db/schema.ts`
- Test: `tests/schema-amenities.test.ts`

**Interfaces:**
- Produces:
  - `amenityTypeEnum`: Énumération PostgreSQL (`DRINKING_WATER`, `TOILETS`, `PICNIC_TABLE`, `BICYCLE_PARKING`, `BEACH_SHOWER`, `DEFIBRILLATOR`, `BAKERY`, `OTHER`)
  - `amenities`: Table Drizzle ORM avec index spatial (`latitude`, `longitude`) et d'équipement (`type`)
  - Types `Amenity` et `NewAmenity`

- [ ] **Step 1: Installer les dépendances GPX et DOM**

Run:
```bash
npm install @tmcw/togeojson@^6.0.0 @xmldom/xmldom@^0.8.10
npm install -D @types/xmldom
```

- [ ] **Step 2: Écrire le test d'intégrité du schéma pour `amenities`**

Créer `tests/schema-amenities.test.ts` :
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { amenities, amenityTypeEnum } from '../src/db/schema.js';

test('schema includes amenities table with valid enum values and indexes', () => {
  assert.ok(amenities, 'Table amenities should be defined');
  assert.ok(amenityTypeEnum, 'Enum amenityTypeEnum should be defined');
  
  const expectedValues = [
    'DRINKING_WATER',
    'TOILETS',
    'PICNIC_TABLE',
    'BICYCLE_PARKING',
    'BEACH_SHOWER',
    'DEFIBRILLATOR',
    'BAKERY',
    'OTHER',
  ];
  assert.deepEqual(amenityTypeEnum.enumValues, expectedValues);
  
  // Vérification de la présence des colonnes indispensables
  assert.ok(amenities.osmId, 'osmId column must exist');
  assert.ok(amenities.type, 'type column must exist');
  assert.ok(amenities.latitude, 'latitude column must exist');
  assert.ok(amenities.longitude, 'longitude column must exist');
  assert.ok(amenities.properties, 'properties column must exist');
});
```

- [ ] **Step 3: Exécuter le test pour vérifier l'échec initial**

Run: `npm test -- tests/schema-amenities.test.ts`
Expected: FAIL avec `amenities is not defined` ou `amenityTypeEnum is not defined`.

- [ ] **Step 4: Ajouter `amenityTypeEnum` et la table `amenities` dans `src/db/schema.ts`**

Ajouter à la fin de `src/db/schema.ts` :
```typescript
// Énumération des équipements utilitaires
export const amenityTypeEnum = pgEnum('amenity_type', [
  'DRINKING_WATER',    // Fontaines d'eau potable
  'TOILETS',           // Toilettes publiques
  'PICNIC_TABLE',      // Tables de pique-nique
  'BICYCLE_PARKING',   // Arceaux et abris vélos
  'BEACH_SHOWER',      // Douches de plage
  'DEFIBRILLATOR',     // Défibrillateurs DAE
  'BAKERY',            // Boulangeries sur les sentiers
  'OTHER',             // Extensions futures
]);

// Table des équipements pratiques
export const amenities = pgTable(
  'amenities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    osmId: varchar('osm_id', { length: 64 }).notNull().unique(),
    type: amenityTypeEnum('type').notNull(),
    name: varchar('name', { length: 255 }),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    properties: jsonb('properties').$type<Record<string, unknown>>().default({}).notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    coordsIdx: index('idx_amenities_coords').on(table.latitude, table.longitude),
    typeIdx: index('idx_amenities_type').on(table.type),
  })
);

export type Amenity = typeof amenities.$inferSelect;
export type NewAmenity = typeof amenities.$inferInsert;
```

- [ ] **Step 5: Exécuter le test pour valider le succès**

Run: `npm test -- tests/schema-amenities.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/db/schema.ts tests/schema-amenities.test.ts
git commit -m "feat: add amenities table and enum to Drizzle schema with GPX dependencies"
```

---

### Task 2: Fonctions Géodésiques & Altimétriques Pures (`src/lib/utils/geo.ts`)

**Files:**
- Create: `src/lib/utils/geo.ts`
- Test: `tests/geo-utils.test.ts`

**Interfaces:**
- Produces:
  - `haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number`
  - `degreesToCardinal(deg: number): 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'`
  - `calculateElevationGainWithHysteresis(elevations: number[], thresholdMeters?: number): { gainM: number, lossM: number, minM: number, maxM: number }`
  - `estimateTrailDurationMinutes(distanceKm: number, elevationGainM: number): number`

- [ ] **Step 1: Écrire les tests unitaires géodésiques et altimétriques**

Créer `tests/geo-utils.test.ts` :
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  haversineDistanceKm,
  degreesToCardinal,
  calculateElevationGainWithHysteresis,
  estimateTrailDurationMinutes,
} from '../src/lib/utils/geo.js';

test('haversineDistanceKm calculates accurate distance between known points', () => {
  // Distance entre Vannes (Port) et Port-Navalo : ~15.2 km à vol d'oiseau
  const dist = haversineDistanceKm(47.6433, -2.7667, 47.5486, -2.9142);
  assert.ok(dist > 14.5 && dist < 16.0, `Expected ~15.2km, got ${dist}`);
  
  // Distance nulle pour un point identique
  assert.equal(haversineDistanceKm(47.5, -2.8, 47.5, -2.8), 0);
});

test('degreesToCardinal converts angles correctly into 8 cardinal directions', () => {
  assert.equal(degreesToCardinal(0), 'N');
  assert.equal(degreesToCardinal(15), 'N');
  assert.equal(degreesToCardinal(350), 'N');
  assert.equal(degreesToCardinal(45), 'NE');
  assert.equal(degreesToCardinal(90), 'E');
  assert.equal(degreesToCardinal(135), 'SE');
  assert.equal(degreesToCardinal(180), 'S');
  assert.equal(degreesToCardinal(225), 'SW');
  assert.equal(degreesToCardinal(270), 'W');
  assert.equal(degreesToCardinal(315), 'NW');
});

test('calculateElevationGainWithHysteresis filters out small GPS noise', () => {
  // Parcours littoral avec micro-bruit altimétrique GPS (+/- 1.5m)
  const noisyElevations = [5, 6.2, 4.8, 5.5, 6.1, 5.2, 5.0];
  const result = calculateElevationGainWithHysteresis(noisyElevations, 3.0);
  assert.equal(result.gainM, 0, 'Small vertical GPS noise must yield 0m D+');
  assert.equal(result.lossM, 0, 'Small vertical GPS noise must yield 0m D-');
  assert.equal(result.minM, 4.8);
  assert.equal(result.maxM, 6.2);

  // Vraie colline : départ 5m -> montée à 25m -> descente à 10m
  const realHills = [5, 10, 18, 25, 20, 14, 10];
  const hillResult = calculateElevationGainWithHysteresis(realHills, 3.0);
  assert.equal(hillResult.gainM, 20, 'Expected 20m D+');
  assert.equal(hillResult.lossM, 15, 'Expected 15m D-');
});

test('calculateElevationGainWithHysteresis handles empty or 2D tracks', () => {
  const result = calculateElevationGainWithHysteresis([], 3.0);
  assert.equal(result.gainM, 0);
  assert.equal(result.lossM, 0);
});

test('estimateTrailDurationMinutes follows standard hiking calculation', () => {
  // 10 km à plat (4 km/h) = 150 minutes
  assert.equal(estimateTrailDurationMinutes(10, 0), 150);
  // 10 km avec 300m D+ = 150 min + 60 min = 210 minutes
  assert.equal(estimateTrailDurationMinutes(10, 300), 210);
});
```

- [ ] **Step 2: Exécuter le test pour vérifier l'échec initial**

Run: `npm test -- tests/geo-utils.test.ts`
Expected: FAIL avec `Cannot find module '../src/lib/utils/geo.js'`

- [ ] **Step 3: Implémenter `src/lib/utils/geo.ts`**

Créer `src/lib/utils/geo.ts` :
```typescript
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

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

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
```

- [ ] **Step 4: Exécuter le test pour valider le succès**

Run: `npm test -- tests/geo-utils.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/geo.ts tests/geo-utils.test.ts
git commit -m "feat: add pure geodesic and elevation hysteresis utilities"
```

---

### Task 3: Connecteur Open-Meteo AROME pour les 6 Secteurs Côtiers (`src/lib/open-meteo.ts`)

**Files:**
- Create: `src/lib/types/weather.ts`
- Create: `src/lib/open-meteo.ts`
- Create: `scripts/sync-weather.ts`
- Test: `tests/open-meteo.test.ts`

**Interfaces:**
- Consumes:
  - `degreesToCardinal` de `src/lib/utils/geo.ts`
  - `weatherSnapshots` de `src/db/schema.ts`
  - `db` de `src/db/index.ts`
- Produces:
  - `COASTAL_SECTORS`: Configuration des 6 secteurs (`VANNES`, `ARRADON`, `LOCMARIAQUER`, `SARZEAU`, `QUIBERON`, `ETEL`)
  - `mapOpenMeteoResponseToSnapshot(sector, rawData)`: Fonction pure
  - `fetchSectorWeather(sectorConfig)`: Requête HTTP avec fallback
  - `syncWeatherSnapshots(dbClient?)`: Procédure d'upsert globale avec reporting d'erreurs

- [ ] **Step 1: Créer `src/lib/types/weather.ts`**

```typescript
import type { CardinalDirection } from '../utils/geo.js';

export type CoastalSectorKey =
  | 'VANNES'
  | 'ARRADON'
  | 'LOCMARIAQUER'
  | 'SARZEAU'
  | 'QUIBERON'
  | 'ETEL';

export interface SectorConfig {
  sector: CoastalSectorKey;
  name: string;
  latitude: number;
  longitude: number;
}

export interface OpenMeteoCurrentResponse {
  latitude: number;
  longitude: number;
  current: {
    time: string;
    interval: number;
    temperature_2m: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    wind_gusts_10m?: number;
  };
}

export interface TransformedWeatherSnapshot {
  sector: CoastalSectorKey;
  tempCelsius: number;
  windSpeedKnots: number;
  windDirectionDeg: number;
  windCardinal: CardinalDirection;
  weatherCode: number;
  isRaining: boolean;
  updatedAt: Date;
}

export interface WeatherSyncReport {
  success: boolean;
  sectorsUpdated: number;
  sectorsFailed: number;
  errors: { sector: CoastalSectorKey; error: string }[];
}
```

- [ ] **Step 2: Écrire les tests unitaires Open-Meteo**

Créer `tests/open-meteo.test.ts` :
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COASTAL_SECTORS,
  mapOpenMeteoResponseToSnapshot,
} from '../src/lib/open-meteo.js';
import type { OpenMeteoCurrentResponse } from '../src/lib/types/weather.js';

test('COASTAL_SECTORS contains all 6 required strategic zones', () => {
  const expectedKeys = ['VANNES', 'ARRADON', 'LOCMARIAQUER', 'SARZEAU', 'QUIBERON', 'ETEL'];
  assert.deepEqual(Object.keys(COASTAL_SECTORS).sort(), expectedKeys.sort());
  assert.equal(COASTAL_SECTORS.LOCMARIAQUER.sector, 'LOCMARIAQUER');
  assert.equal(COASTAL_SECTORS.ETEL.sector, 'ETEL');
});

test('mapOpenMeteoResponseToSnapshot correctly parses weather data and rain codes', () => {
  const mockApiData: OpenMeteoCurrentResponse = {
    latitude: 47.6586,
    longitude: -2.7599,
    current: {
      time: '2026-10-21T14:00:00Z',
      interval: 900,
      temperature_2m: 19.4,
      precipitation: 0.0,
      weather_code: 3, // Nuageux sans pluie
      wind_speed_10m: 12.5,
      wind_direction_10m: 240, // Ouest / Sud-Ouest -> SW
      wind_gusts_10m: 18.2,
    },
  };

  const snapshot = mapOpenMeteoResponseToSnapshot('VANNES', mockApiData);

  assert.equal(snapshot.sector, 'VANNES');
  assert.equal(snapshot.tempCelsius, 19.4);
  assert.equal(snapshot.windSpeedKnots, 12.5);
  assert.equal(snapshot.windDirectionDeg, 240);
  assert.equal(snapshot.windCardinal, 'SW');
  assert.equal(snapshot.weatherCode, 3);
  assert.equal(snapshot.isRaining, false);
});

test('mapOpenMeteoResponseToSnapshot detects rain when precipitation or WMO code triggers it', () => {
  // Cas avec WMO 61 (pluie légère)
  const rainyData: OpenMeteoCurrentResponse = {
    latitude: 47.4839,
    longitude: -3.1206,
    current: {
      time: '2026-10-21T14:00:00Z',
      interval: 900,
      temperature_2m: 15.0,
      precipitation: 1.2,
      weather_code: 61,
      wind_speed_10m: 22.0,
      wind_direction_10m: 290, // WNW -> W
    },
  };

  const snapshot = mapOpenMeteoResponseToSnapshot('QUIBERON', rainyData);
  assert.equal(snapshot.isRaining, true);
  assert.equal(snapshot.windCardinal, 'W');
});
```

- [ ] **Step 3: Exécuter le test pour vérifier l'échec initial**

Run: `npm test -- tests/open-meteo.test.ts`
Expected: FAIL avec `Cannot find module '../src/lib/open-meteo.js'`

- [ ] **Step 4: Implémenter `src/lib/open-meteo.ts`**

Créer `src/lib/open-meteo.ts` :
```typescript
import { db as defaultDb } from '../db/index.js';
import { weatherSnapshots } from '../db/schema.js';
import { degreesToCardinal } from './utils/geo.js';
import type {
  CoastalSectorKey,
  SectorConfig,
  OpenMeteoCurrentResponse,
  TransformedWeatherSnapshot,
  WeatherSyncReport,
} from './types/weather.js';

export const COASTAL_SECTORS: Record<CoastalSectorKey, SectorConfig> = {
  VANNES: {
    sector: 'VANNES',
    name: 'Fond de Golfe (Vannes / Séné)',
    latitude: 47.6586,
    longitude: -2.7599,
  },
  ARRADON: {
    sector: 'ARRADON',
    name: 'Golfe Intérieur (Arradon / Îles / Baden)',
    latitude: 47.6258,
    longitude: -2.8277,
  },
  LOCMARIAQUER: {
    sector: 'LOCMARIAQUER',
    name: 'Entrée de Golfe Ouest & Baie de Quiberon',
    latitude: 47.5695,
    longitude: -2.9443,
  },
  SARZEAU: {
    sector: 'SARZEAU',
    name: "Presqu'île de Rhuys (Sarzeau / Port-Navalo)",
    latitude: 47.5278,
    longitude: -2.7694,
  },
  QUIBERON: {
    sector: 'QUIBERON',
    name: "Presqu'île de Quiberon & Océan",
    latitude: 47.4839,
    longitude: -3.1206,
  },
  ETEL: {
    sector: 'ETEL',
    name: "Ria d'Étel & Côte Sauvage Nord",
    latitude: 47.6575,
    longitude: -3.2003,
  },
};

/**
 * Codes WMO indiquant des précipitations (bruine, pluie, neige, averses, orages).
 */
const RAIN_WMO_CODES = new Set([
  51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99,
]);

/**
 * Transforme la réponse brute Open-Meteo en snapshot normalisé.
 */
export function mapOpenMeteoResponseToSnapshot(
  sector: CoastalSectorKey,
  data: OpenMeteoCurrentResponse
): TransformedWeatherSnapshot {
  const current = data.current;
  const isRaining = current.precipitation > 0.1 || RAIN_WMO_CODES.has(current.weather_code);
  const windCardinal = degreesToCardinal(current.wind_direction_10m);

  return {
    sector,
    tempCelsius: Math.round(current.temperature_2m * 10) / 10,
    windSpeedKnots: Math.round(current.wind_speed_10m * 10) / 10,
    windDirectionDeg: Math.round(current.wind_direction_10m),
    windCardinal,
    weatherCode: current.weather_code,
    isRaining,
    updatedAt: new Date(),
  };
}

/**
 * Récupère les prévisions actuelles pour un secteur via l'API Open-Meteo (modèle AROME).
 */
export async function fetchSectorWeather(
  config: SectorConfig
): Promise<TransformedWeatherSnapshot> {
  const params = new URLSearchParams({
    latitude: config.latitude.toString(),
    longitude: config.longitude.toString(),
    current:
      'temperature_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    wind_speed_unit: 'kn',
    models: 'meteofrance_arome_france_hd,meteofrance_arome_france',
  });

  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo error (${response.status}): ${response.statusText}`);
  }

  const raw = (await response.json()) as OpenMeteoCurrentResponse;
  return mapOpenMeteoResponseToSnapshot(config.sector, raw);
}

/**
 * Synchronise les 6 secteurs côtiers en base de données de manière résiliente.
 */
export async function syncWeatherSnapshots(
  dbClient = defaultDb
): Promise<WeatherSyncReport> {
  const report: WeatherSyncReport = {
    success: true,
    sectorsUpdated: 0,
    sectorsFailed: 0,
    errors: [],
  };

  const sectors = Object.values(COASTAL_SECTORS);

  await Promise.all(
    sectors.map(async (cfg) => {
      try {
        const snapshot = await fetchSectorWeather(cfg);
        await dbClient
          .insert(weatherSnapshots)
          .values(snapshot)
          .onConflictDoUpdate({
            target: weatherSnapshots.sector,
            set: {
              tempCelsius: snapshot.tempCelsius,
              windSpeedKnots: snapshot.windSpeedKnots,
              windDirectionDeg: snapshot.windDirectionDeg,
              windCardinal: snapshot.windCardinal,
              weatherCode: snapshot.weatherCode,
              isRaining: snapshot.isRaining,
              updatedAt: snapshot.updatedAt,
            },
          });
        report.sectorsUpdated++;
      } catch (err) {
        report.sectorsFailed++;
        report.errors.push({
          sector: cfg.sector,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })
  );

  report.success = report.sectorsFailed === 0;
  return report;
}
```

- [ ] **Step 5: Créer le script CLI `scripts/sync-weather.ts`**

```typescript
import { syncWeatherSnapshots } from '../src/lib/open-meteo.js';

async function main() {
  console.log('--- Synchronisation Météo Open-Meteo AROME (6 secteurs) ---');
  const start = Date.now();
  const report = await syncWeatherSnapshots();
  const duration = Date.now() - start;

  console.log(`Statut : ${report.success ? 'SUCCÈS' : 'AVERTISSEMENT / ERREUR PARTIELLE'}`);
  console.log(`Secteurs mis à jour : ${report.sectorsUpdated} / 6`);
  console.log(`Durée : ${duration}ms`);

  if (report.errors.length > 0) {
    console.error('Erreurs rencontrées :');
    for (const e of report.errors) {
      console.error(`- [${e.sector}] : ${e.error}`);
    }
  }

  process.exit(report.success ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal sync-weather error:', err);
  process.exit(1);
});
```

- [ ] **Step 6: Exécuter le test pour valider le succès**

Run: `npm test -- tests/open-meteo.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/types/weather.ts src/lib/open-meteo.ts scripts/sync-weather.ts tests/open-meteo.test.ts
git commit -m "feat: add Open-Meteo connector with 6 coastal sectors, AROME model and resilient upsert"
```

---

### Task 4: Parseur GPX Géodésique & Profil Altimétrique (`src/lib/gpx-parser.ts`)

**Files:**
- Create: `src/lib/types/gpx.ts`
- Create: `src/lib/gpx-parser.ts`
- Test: `tests/gpx-parser.test.ts`

**Interfaces:**
- Consumes:
  - `@xmldom/xmldom` (`DOMParser`)
  - `@tmcw/togeojson` (`gpx`)
  - `haversineDistanceKm`, `calculateElevationGainWithHysteresis`, `estimateTrailDurationMinutes` de `src/lib/utils/geo.ts`
- Produces:
  - `parseGpxTrack(gpxXmlString: string, options?: { maxProfilePoints?: number }): ParsedGpxResult`

- [ ] **Step 1: Créer `src/lib/types/gpx.ts`**

```typescript
export interface ElevationPoint {
  distKm: number;
  altM: number;
}

export interface ParsedGpxResult {
  track: GeoJSON.Feature<GeoJSON.LineString>;
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  minElevationM: number;
  maxElevationM: number;
  estimatedDurationMinutes: number;
  elevationProfile: ElevationPoint[];
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
}
```

- [ ] **Step 2: Écrire les tests unitaires du parseur GPX**

Créer `tests/gpx-parser.test.ts` :
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGpxTrack } from '../src/lib/gpx-parser.js';

// GPX minimaliste pour test : 3 points avec coordonnées et altitudes
const VALID_GPX_XML = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Antigravity">
  <trk>
    <name>Sentier des Douaniers Arradon</name>
    <trkseg>
      <trkpt lat="47.6258" lon="-2.8277"><ele>5.0</ele></trkpt>
      <trkpt lat="47.6290" lon="-2.8310"><ele>12.0</ele></trkpt>
      <trkpt lat="47.6320" lon="-2.8350"><ele>7.0</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

const FLAT_COASTAL_NOISY_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="PhoneGPS">
  <trk>
    <name>Tour de Berder</name>
    <trkseg>
      <trkpt lat="47.5780" lon="-2.8870"><ele>3.0</ele></trkpt>
      <trkpt lat="47.5790" lon="-2.8880"><ele>4.2</ele></trkpt>
      <trkpt lat="47.5800" lon="-2.8890"><ele>2.8</ele></trkpt>
      <trkpt lat="47.5810" lon="-2.8900"><ele>3.5</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

const GPX_2D_NO_ELEVATION = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <trk>
    <name>Tracé plat 2D</name>
    <trkseg>
      <trkpt lat="47.5000" lon="-2.8000"></trkpt>
      <trkpt lat="47.5100" lon="-2.8100"></trkpt>
    </trkseg>
  </trk>
</gpx>`;

test('parseGpxTrack accurately parses valid 3D GPX track', () => {
  const result = parseGpxTrack(VALID_GPX_XML);

  assert.ok(result.track, 'LineString Feature must be produced');
  assert.equal(result.track.geometry.type, 'LineString');
  assert.equal(result.track.geometry.coordinates.length, 3);
  assert.ok(result.distanceKm > 0.5 && result.distanceKm < 1.5, `Distance was ${result.distanceKm}km`);
  assert.equal(result.elevationGainM, 7); // 5m -> 12m = +7m
  assert.equal(result.elevationLossM, 5); // 12m -> 7m = -5m
  assert.equal(result.minElevationM, 5);
  assert.equal(result.maxElevationM, 12);
  assert.ok(result.estimatedDurationMinutes > 0);
  assert.equal(result.elevationProfile.length, 3);
});

test('parseGpxTrack eliminates micro-noise on flat coastal tracks', () => {
  const result = parseGpxTrack(FLAT_COASTAL_NOISY_GPX);
  assert.equal(result.elevationGainM, 0, 'Noisy variations <= 1.4m should yield 0m D+');
  assert.equal(result.elevationLossM, 0);
});

test('parseGpxTrack gracefully handles 2D GPX tracks with 0 elevation', () => {
  const result = parseGpxTrack(GPX_2D_NO_ELEVATION);
  assert.equal(result.elevationGainM, 0);
  assert.equal(result.elevationLossM, 0);
  assert.equal(result.minElevationM, 0);
  assert.equal(result.maxElevationM, 0);
  assert.ok(result.distanceKm > 1.0);
});

test('parseGpxTrack throws clear error on empty or invalid XML', () => {
  assert.throws(() => parseGpxTrack(''), /Empty or invalid GPX/);
  assert.throws(() => parseGpxTrack('<notgpx>hello</notgpx>'), /No track found/);
});
```

- [ ] **Step 3: Exécuter le test pour vérifier l'échec initial**

Run: `npm test -- tests/gpx-parser.test.ts`
Expected: FAIL avec `Cannot find module '../src/lib/gpx-parser.js'`

- [ ] **Step 4: Implémenter `src/lib/gpx-parser.ts`**

Créer `src/lib/gpx-parser.ts` :
```typescript
import { DOMParser } from '@xmldom/xmldom';
import * as toGeoJSON from '@tmcw/togeojson';
import {
  haversineDistanceKm,
  calculateElevationGainWithHysteresis,
  estimateTrailDurationMinutes,
} from './utils/geo.js';
import type { ElevationPoint, ParsedGpxResult } from './types/gpx.js';

export interface ParseGpxOptions {
  maxProfilePoints?: number;
  elevationHysteresisMeters?: number;
}

/**
 * Parse un fichier XML GPX et retourne un objet GeoJSON enrichi avec distance et profil altimétrique.
 */
export function parseGpxTrack(
  gpxXmlString: string,
  options: ParseGpxOptions = {}
): ParsedGpxResult {
  if (!gpxXmlString || typeof gpxXmlString !== 'string' || gpxXmlString.trim().length === 0) {
    throw new Error('Empty or invalid GPX content provided');
  }

  const dom = new DOMParser({
    errorHandler: {
      warning: () => {},
      error: (msg) => {
        throw new Error(`GPX XML syntax error: ${msg}`);
      },
      fatalError: (msg) => {
        throw new Error(`GPX XML fatal parsing error: ${msg}`);
      },
    },
  }).parseFromString(gpxXmlString, 'text/xml');

  const geojson = toGeoJSON.gpx(dom);

  // Recherche de la première géométrie LineString ou MultiLineString
  let lineCoordinates: [number, number, number?][] = [];

  for (const feature of geojson.features) {
    if (feature.geometry.type === 'LineString') {
      lineCoordinates = feature.geometry.coordinates as [number, number, number?][];
      break;
    } else if (feature.geometry.type === 'MultiLineString') {
      // Concaténation des segments
      lineCoordinates = (feature.geometry.coordinates as [number, number, number?][][]).flat();
      break;
    }
  }

  if (lineCoordinates.length < 2) {
    throw new Error('No track or route with at least 2 points found in GPX');
  }

  // Calcul des distances cumulées et extraction des altitudes
  let totalDistanceKm = 0;
  const rawDistances: number[] = [0];
  const rawElevations: number[] = [];

  let minLat = lineCoordinates[0][1];
  let maxLat = lineCoordinates[0][1];
  let minLng = lineCoordinates[0][0];
  let maxLng = lineCoordinates[0][0];

  const firstEle = lineCoordinates[0][2];
  const hasElevation = typeof firstEle === 'number';

  if (hasElevation) {
    rawElevations.push(firstEle);
  }

  for (let i = 1; i < lineCoordinates.length; i++) {
    const prev = lineCoordinates[i - 1];
    const curr = lineCoordinates[i];

    const segDist = haversineDistanceKm(prev[1], prev[0], curr[1], curr[0]);
    totalDistanceKm += segDist;
    rawDistances.push(totalDistanceKm);

    if (hasElevation) {
      rawElevations.push(typeof curr[2] === 'number' ? curr[2] : rawElevations[rawElevations.length - 1] ?? 0);
    }

    if (curr[1] < minLat) minLat = curr[1];
    if (curr[1] > maxLat) maxLat = curr[1];
    if (curr[0] < minLng) minLng = curr[0];
    if (curr[0] > maxLng) maxLng = curr[0];
  }

  // Analyse du dénivelé
  const hysteresis = options.elevationHysteresisMeters ?? 3.0;
  const eleAnalysis = hasElevation
    ? calculateElevationGainWithHysteresis(rawElevations, hysteresis)
    : { gainM: 0, lossM: 0, minM: 0, maxM: 0 };

  // Sous-échantillonnage du profil altimétrique (max 150 points par défaut)
  const maxPoints = options.maxProfilePoints ?? 150;
  const elevationProfile: ElevationPoint[] = [];

  if (hasElevation && rawElevations.length > 0) {
    const step = Math.max(1, Math.floor(rawElevations.length / maxPoints));
    for (let i = 0; i < rawElevations.length; i += step) {
      elevationProfile.push({
        distKm: Math.round(rawDistances[i] * 100) / 100,
        altM: Math.round(rawElevations[i] * 10) / 10,
      });
    }
    // Dernier point garanti
    const lastIdx = rawElevations.length - 1;
    if (elevationProfile[elevationProfile.length - 1].distKm !== Math.round(rawDistances[lastIdx] * 100) / 100) {
      elevationProfile.push({
        distKm: Math.round(rawDistances[lastIdx] * 100) / 100,
        altM: Math.round(rawElevations[lastIdx] * 10) / 10,
      });
    }
  }

  const trackFeature: GeoJSON.Feature<GeoJSON.LineString> = {
    type: 'Feature',
    properties: {
      name: dom.getElementsByTagName('name')?.[0]?.textContent ?? 'Trace GPX',
    },
    geometry: {
      type: 'LineString',
      coordinates: lineCoordinates,
    },
  };

  const finalDistanceKm = Math.round(totalDistanceKm * 100) / 100;
  const estimatedDurationMinutes = estimateTrailDurationMinutes(finalDistanceKm, eleAnalysis.gainM);

  return {
    track: trackFeature,
    distanceKm: finalDistanceKm,
    elevationGainM: eleAnalysis.gainM,
    elevationLossM: eleAnalysis.lossM,
    minElevationM: eleAnalysis.minM,
    maxElevationM: eleAnalysis.maxM,
    estimatedDurationMinutes,
    elevationProfile,
    bounds: { minLat, maxLat, minLng, maxLng },
  };
}
```

- [ ] **Step 5: Exécuter le test pour valider le succès**

Run: `npm test -- tests/gpx-parser.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/types/gpx.ts src/lib/gpx-parser.ts tests/gpx-parser.test.ts
git commit -m "feat: add robust GPX parser with elevation hysteresis filter and profile sampling"
```

---

### Task 5: Connecteur Overpass OpenStreetMap & Routage Hybride (`src/lib/overpass.ts`)

**Files:**
- Create: `src/lib/types/osm.ts`
- Create: `src/lib/overpass.ts`
- Create: `scripts/sync-osm.ts`
- Test: `tests/overpass.test.ts`

**Interfaces:**
- Consumes:
  - `places`, `amenities`, `amenityTypeEnum` de `src/db/schema.ts`
  - `db` de `src/db/index.ts`
- Produces:
  - `buildOverpassQuery()`: Requête QL avec boîte englobante du Morbihan
  - `fetchOverpassElements(query?)`: Requête HTTP avec fallback sur miroir
  - `routeOsmElements(elements)`: Répartition cales (`places`) et équipements (`amenities`)
  - `syncOsmData(dbClient?)`: Procédure d'upsert globale avec reporting

- [ ] **Step 1: Créer `src/lib/types/osm.ts`**

```typescript
export interface OverpassElement {
  type: 'node' | 'way';
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: Record<string, string>;
}

export interface OverpassResponse {
  version: number;
  generator: string;
  elements: OverpassElement[];
}

export interface OsmSyncReport {
  success: boolean;
  slipwaysUpserted: number;
  amenitiesUpserted: number;
  totalParsed: number;
  errors: string[];
}
```

- [ ] **Step 2: Écrire les tests unitaires du connecteur Overpass**

Créer `tests/overpass.test.ts` :
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOverpassQuery, routeOsmElements } from '../src/lib/overpass.js';
import type { OverpassElement } from '../src/lib/types/osm.js';

test('buildOverpassQuery includes correct bounding box and amenity tags', () => {
  const query = buildOverpassQuery();
  assert.ok(query.includes('leisure"="slipway"'));
  assert.ok(query.includes('amenity"="drinking_water"'));
  assert.ok(query.includes('amenity"="toilets"'));
  assert.ok(query.includes('leisure"="picnic_table"'));
  assert.ok(query.includes('amenity"="bicycle_parking"'));
  assert.ok(query.includes('47.45,-3.25,47.75,-2.60'));
});

test('routeOsmElements partitions slipways into places and amenities into amenities table', () => {
  const mockElements: OverpassElement[] = [
    // 1. Cale de mise à l'eau (node)
    {
      type: 'node',
      id: 1001,
      lat: 47.6001,
      lon: -2.8501,
      tags: { leisure: 'slipway', name: 'Cale de Toulindac', tidal: 'yes' },
    },
    // 2. Fontaine d'eau potable
    {
      type: 'node',
      id: 2001,
      lat: 47.6010,
      lon: -2.8510,
      tags: { amenity: 'drinking_water', name: 'Fontaine du Port' },
    },
    // 3. Toilettes publiques (way avec centre)
    {
      type: 'way',
      id: 3001,
      center: { lat: 47.6020, lon: -2.8520 },
      tags: { amenity: 'toilets', wheelchair: 'yes', fee: 'no' },
    },
    // 4. Table de pique-nique
    {
      type: 'node',
      id: 4001,
      lat: 47.6030,
      lon: -2.8530,
      tags: { leisure: 'picnic_table' },
    },
  ];

  const routed = routeOsmElements(mockElements);

  assert.equal(routed.slipways.length, 1);
  assert.equal(routed.slipways[0].externalId, 'osm:node:1001');
  assert.equal(routed.slipways[0].category, 'NAUTICAL');
  assert.equal(routed.slipways[0].contextualRules.tideConstraint, 'HIGH_TIDE_ONLY');

  assert.equal(routed.amenities.length, 3);
  assert.equal(routed.amenities[0].type, 'DRINKING_WATER');
  assert.equal(routed.amenities[1].type, 'TOILETS');
  assert.equal(routed.amenities[1].osmId, 'way:3001');
  assert.equal(routed.amenities[2].type, 'PICNIC_TABLE');
});
```

- [ ] **Step 3: Exécuter le test pour vérifier l'échec initial**

Run: `npm test -- tests/overpass.test.ts`
Expected: FAIL avec `Cannot find module '../src/lib/overpass.js'`

- [ ] **Step 4: Implémenter `src/lib/overpass.ts`**

Créer `src/lib/overpass.ts` :
```typescript
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
        shortDescription: tags.description || 'Cale de mise à l'eau répertoriée sur OpenStreetMap.',
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
 */
export async function syncOsmData(dbClient = defaultDb): Promise<OsmSyncReport> {
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
```

- [ ] **Step 5: Créer le script CLI `scripts/sync-osm.ts`**

```typescript
import { syncOsmData } from '../src/lib/overpass.js';

async function main() {
  console.log('--- Synchronisation OpenStreetMap Overpass (Cales & Équipements) ---');
  const start = Date.now();
  const report = await syncOsmData();
  const duration = Date.now() - start;

  console.log(`Statut : ${report.success ? 'SUCCÈS' : 'ÉCHEC OU ERREUR PARTIELLE'}`);
  console.log(`Éléments analysés : ${report.totalParsed}`);
  console.log(`Cales nautiques enregistrées : ${report.slipwaysUpserted}`);
  console.log(`Équipements de plein air enregistrés : ${report.amenitiesUpserted}`);
  console.log(`Durée : ${duration}ms`);

  if (report.errors.length > 0) {
    console.error(`Erreurs (${report.errors.length}) :`, report.errors.slice(0, 5));
  }

  process.exit(report.success ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal sync-osm error:', err);
  process.exit(1);
});
```

- [ ] **Step 6: Exécuter le test pour valider le succès**

Run: `npm test -- tests/overpass.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/types/osm.ts src/lib/overpass.ts scripts/sync-osm.ts tests/overpass.test.ts
git commit -m "feat: add Overpass OSM connector with hybrid routing for slipways and outdoor amenities"
```

---

### Task 6: Route Sécurisée `/api/cron/sync` & Scripts NPM

**Files:**
- Create: `src/app/api/cron/sync/route.ts`
- Modify: `package.json`
- Test: `tests/cron-sync.test.ts`

**Interfaces:**
- Consumes:
  - `syncWeatherSnapshots` de `src/lib/open-meteo.ts`
  - `syncOsmData` de `src/lib/overpass.ts`
- Produces:
  - `GET /api/cron/sync` et `POST /api/cron/sync` sécurisés par `CRON_SECRET`
  - Scripts `npm run sync:weather` et `npm run sync:osm`

- [ ] **Step 1: Écrire les tests d'intégration de la route Cron**

Créer `tests/cron-sync.test.ts` :
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { GET } from '../src/app/api/cron/sync/route.js';

test('GET /api/cron/sync returns 401 Unauthorized when Bearer token is missing', async () => {
  process.env.CRON_SECRET = 'test-secret-token-123';
  const req = new Request('http://localhost:3000/api/cron/sync');
  const res = await GET(req);

  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.error, 'Unauthorized: Invalid or missing cron secret');
});

test('GET /api/cron/sync returns 401 when Bearer token is incorrect', async () => {
  process.env.CRON_SECRET = 'test-secret-token-123';
  const req = new Request('http://localhost:3000/api/cron/sync', {
    headers: { Authorization: 'Bearer wrong-secret' },
  });
  const res = await GET(req);

  assert.equal(res.status, 401);
});

test('GET /api/cron/sync accepts valid Bearer token and triggers job', async () => {
  process.env.CRON_SECRET = 'test-secret-token-123';
  
  // Test avec job inconnu ou paramétrage spécifique
  const req = new Request('http://localhost:3000/api/cron/sync?job=none', {
    headers: { Authorization: 'Bearer test-secret-token-123' },
  });
  const res = await GET(req);

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.timestamp);
});
```

- [ ] **Step 2: Exécuter le test pour vérifier l'échec initial**

Run: `npm test -- tests/cron-sync.test.ts`
Expected: FAIL avec `Cannot find module '../src/app/api/cron/sync/route.js'`

- [ ] **Step 3: Implémenter `src/app/api/cron/sync/route.ts`**

Créer `src/app/api/cron/sync/route.ts` :
```typescript
import { NextResponse } from 'next/server';
import { syncWeatherSnapshots } from '@/lib/open-meteo';
import { syncOsmData } from '@/lib/overpass';

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Si CRON_SECRET n'est pas configuré, refus systématique en production
    return false;
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token === secret) return true;
  }

  const url = new URL(request.url);
  const queryToken = url.searchParams.get('token');
  if (queryToken && queryToken === secret) {
    return true;
  }

  return false;
}

export async function handleSync(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing cron secret' },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const job = url.searchParams.get('job') || 'all';
  const startTime = Date.now();

  const results: Record<string, unknown> = {};
  let globalSuccess = true;

  if (job === 'weather' || job === 'all') {
    const weatherReport = await syncWeatherSnapshots();
    results.weather = weatherReport;
    if (!weatherReport.success) globalSuccess = false;
  }

  if (job === 'osm' || job === 'all') {
    const osmReport = await syncOsmData();
    results.osm = osmReport;
    if (!osmReport.success) globalSuccess = false;
  }

  const durationMs = Date.now() - startTime;
  const status = globalSuccess ? 200 : 207;

  return NextResponse.json(
    {
      success: globalSuccess,
      timestamp: new Date().toISOString(),
      durationMs,
      jobs: results,
    },
    { status }
  );
}

export async function GET(request: Request) {
  return handleSync(request);
}

export async function POST(request: Request) {
  return handleSync(request);
}
```

- [ ] **Step 4: Mettre à jour `package.json` avec les scripts CLI**

Ajouter dans la section `"scripts"` de `package.json` :
```json
"sync:weather": "tsx scripts/sync-weather.ts",
"sync:osm": "tsx scripts/sync-osm.ts"
```

- [ ] **Step 5: Exécuter tous les tests du projet pour valider le succès global**

Run: `npm test`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron/sync/route.ts package.json tests/cron-sync.test.ts
git commit -m "feat: implement secure /api/cron/sync route with Bearer auth and CLI npm scripts"
```
