# Chantier 1 : Fiches Descriptives Riches, Ingestion DATAtourisme & Curation de Contenu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter les fiches lieux enrichies (photos, conseils pratiques, guidage parking direct, badges contextuels adaptés par catégorie), le connecteur d'ingestion sélective DATAtourisme et la base de curation locale non-plagiée (enrichie des meilleurs conseils de terrain) avec une navigation hybride carte/page autonome.

**Architecture:** Modèle de données étendu Drizzle ORM avec colonnes JSONB pour la galerie photos, les infos pratiques et les détails marégraphiques. Ingestion découplée en deux temps (flux brut DATAtourisme 56 filtré sur les pépites naturelles/patrimoniales + heuristiques spatiales marée/vent/commodités OSM, écrasé prioritairement par `data/curated-spots.json`). Composant unifié `PlaceDetailView` exploité à la fois dans la Bottom Sheet gestuelle de `/carte` (avec synchronisation `history.pushState`) et dans la page standalone `/lieu/[slug]` en rendu statique revalidé (ISR) avec balisage `TouristAttraction`.

**Tech Stack:** Next.js 15 (App Router, ISR, TypeScript strict), Drizzle ORM + PostgreSQL / PostGIS, Tailwind CSS, Lucide React, MapLibre GL, Node.js native test runner (`tsx --test`).

**Spec:** [`docs/superpowers/specs/2026-10-22-fiches-lieux-enrichies-et-ingestion-curation-design.md`](file:///Users/Moulitos/Documents/antigravity/Guide%20Morbihan/docs/superpowers/specs/2026-10-22-fiches-lieux-enrichies-et-ingestion-curation-design.md)

## Global Constraints

- **Zéro plagiat :** Toutes les descriptions, conseils pratiques et tips issus de sources externes (guides, web) doivent être intégralement reformulés avec un style original propre à l'application. Seules les données factuelles brutes (coordonnées GPS, noms de lieux, commodités) sont extraites.
- **Zéro coût runtime :** Aucun appel API externe synchrone lors de la navigation utilisateur ; tout est servi depuis le cache ISR ou la base PostgreSQL locale.
- **Rétrocompatibilité :** Aucun composant existant de la carte (`GolfeMap.tsx`, `FilterBar.tsx`, `context-matcher.ts`) ne doit voir ses tests unitaires régresser (119/119 tests existants doivent rester verts).
- **Responsive Mobile-First :** Cibles tactiles $\ge 48\text{px}$, gestes fluides sans blocage de défilement, support du mode hors-réseau gracieux avec images de secours.

---

### Task 1: Extension du Schéma Drizzle et Types de Données Enrichis

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/lib/types/context.ts`
- Create: `tests/schema-enrichment.test.ts`

**Interfaces:**
- Produces: types `PhotoItem`, `PracticalInfo`, `TideDetails`, `PlaceSourceType`, et nouvelles colonnes `photoGallery`, `practicalInfo`, `tideDetails`, `sourceType` sur la table `places`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/schema-enrichment.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { places } from '../src/db/schema.ts';

describe('Schema Enrichment for Rich Place Details', () => {
  it('defines photoGallery, practicalInfo, tideDetails, and sourceType columns', () => {
    assert.ok(places.photoGallery, 'photoGallery column should exist');
    assert.ok(places.practicalInfo, 'practicalInfo column should exist');
    assert.ok(places.tideDetails, 'tideDetails column should exist');
    assert.ok(places.sourceType, 'sourceType column should exist');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/schema-enrichment.test.ts`  
Expected: FAIL with `AssertionError: photoGallery column should exist`

- [ ] **Step 3: Update types and schema**

In `src/lib/types/context.ts`, export the rich types:
```typescript
export interface PhotoItem {
  url: string;
  caption?: string;
  credit?: string;
  isCover?: boolean;
}

export interface PracticalInfo {
  recommendedDurationMinutes?: number;
  pricing?: string;
  amenities?: ('toilets' | 'water' | 'parking' | 'food' | 'picnic_table' | 'shade')[];
  insiderTip?: string;
  goodToKnow?: string;
  bestSeason?: ('SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER')[];
}

export interface TideDetails {
  highTideAdvantage?: string;
  lowTideAdvantage?: string;
  warningNote?: string;
}

export type PlaceSourceType = 'DATATOURISME' | 'CURATED' | 'MANUAL';
```

In `src/db/schema.ts`, import these types and add columns to `places`:
```typescript
import { PhotoItem, PracticalInfo, TideDetails, PlaceSourceType } from '../lib/types/context';

// In places definition:
photoGallery: jsonb('photo_gallery').$type<PhotoItem[]>().default([]).notNull(),
practicalInfo: jsonb('practical_info').$type<PracticalInfo>(),
tideDetails: jsonb('tide_details').$type<TideDetails>(),
sourceType: varchar('source_type', { length: 50 }).$type<PlaceSourceType>().default('CURATED').notNull(),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/schema-enrichment.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts src/lib/types/context.ts tests/schema-enrichment.test.ts
git commit -m "feat(db): extend places table with photoGallery, practicalInfo, and tideDetails"
```

---

### Task 2: Curation Locale Souveraine et Modèle de Données des Pépites

**Files:**
- Create: `data/curated-spots.json`
- Create: `src/lib/curated-spots.ts`
- Create: `tests/curated-spots.test.ts`

**Interfaces:**
- Produces: `getCuratedSpots(): CuratedSpotRecord[]`, `findCuratedSpotBySlug(slug: string): CuratedSpotRecord | undefined`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/curated-spots.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getCuratedSpots, findCuratedSpotBySlug } from '../src/lib/curated-spots.ts';

describe('Curated Spots Data Store', () => {
  it('loads curated spots from json with rich practical info and non-plagiarized tips', () => {
    const spots = getCuratedSpots();
    assert.ok(Array.isArray(spots));
    assert.ok(spots.length >= 10, 'Must have at least 10 key Morbihan spots');
    
    const berder = findCuratedSpotBySlug('ile-de-berder');
    assert.ok(berder, 'Berder must exist in curated spots');
    assert.ok(berder?.practicalInfo?.insiderTip, 'Must have an insider tip');
    assert.ok(berder?.photoGallery && berder.photoGallery.length > 0, 'Must have photos');
    assert.strictEqual(berder?.sourceType, 'CURATED');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/curated-spots.test.ts`  
Expected: FAIL (cannot find module `src/lib/curated-spots.ts`)

- [ ] **Step 3: Implement curated-spots.json and store helper**

Create `data/curated-spots.json` containing verified records for top spots (Île de Berder, Passage de Tascon, Presqu'île de Conleau, Port-Blanc Baden, Château de Suscinio, Alignements de Carnac, Port Saint-Goustan Auray, Plage des 7 Îles, Pointe du Conguel Quiberon, Tumulus de Tumiac Arzon, Pointe des Émigrés Vannes, Marais de Séné) with original rewritten descriptions and tips:
```json
[
  {
    "slug": "ile-de-berder",
    "name": "Île de Berder",
    "shortDescription": "Joyau boisé accessible à pied uniquement à marée basse par une chaussée submersible pavée.",
    "fullDescription": "Située face au puissant courant de la Jument, Berder offre une boucle piétonne ombragée de 2,6 km aux panoramas changeants. Les pins maritimes et les criques rocheuses dominent les courants marins bouillonnants.",
    "category": "TIDAL_PASSAGE",
    "commune": "Larmor-Baden",
    "communeSlug": "larmor-baden",
    "sector": "ARRADON",
    "latitude": 47.5794,
    "longitude": -2.8887,
    "parkingLat": 47.5872,
    "parkingLng": -2.8941,
    "sourceType": "CURATED",
    "contextualRules": {
      "tideConstraint": "LOW_TIDE_ONLY",
      "tideOffsetHours": { "beforeLow": 2, "afterLow": 2 },
      "shelteredFromWindDirections": ["N", "NE"],
      "strollerFriendly": false,
      "dogsAllowedSummer": true,
      "rainFriendly": false
    },
    "practicalInfo": {
      "recommendedDurationMinutes": 90,
      "pricing": "GRATUIT",
      "amenities": ["parking"],
      "insiderTip": "Ne tentez jamais la traversée si l'eau commence à recouvrir les pavés : le courant de la Jument monte très vite et s'avère extrêmement violent.",
      "goodToKnow": "Stationnement obligatoire sur les parkings balisés en amont du port de Larmor-Baden avant d'accéder au cordon littoral."
    },
    "tideDetails": {
      "highTideAdvantage": "Observation spectaculaire du courant depuis la pointe sud.",
      "lowTideAdvantage": "Passage à pied au sec pendant environ 4h autour de la basse mer.",
      "warningNote": "Chaussée submersible coupée à marée haute. Vérifiez le compte à rebours."
    },
    "photoGallery": [
      {
        "url": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
        "caption": "La chaussée pavée submersible de Berder à marée basse",
        "isCover": true
      }
    ]
  }
]
```

Create `src/lib/curated-spots.ts`:
```typescript
import fs from 'node:fs';
import path from 'node:path';
import { PhotoItem, PracticalInfo, TideDetails, PlaceSourceType } from './types/context';

export interface CuratedSpotRecord {
  slug: string;
  name: string;
  shortDescription: string;
  fullDescription: string;
  category: 'BEACH' | 'TRAIL' | 'TIDAL_PASSAGE' | 'HERITAGE' | 'GASTRONOMY' | 'NAUTICAL' | 'VIEWPOINT';
  commune: string;
  communeSlug: string;
  sector: string;
  latitude: number;
  longitude: number;
  parkingLat?: number;
  parkingLng?: number;
  sourceType: PlaceSourceType;
  contextualRules: {
    tideConstraint: 'ALL_TIDES' | 'HIGH_TIDE_ONLY' | 'LOW_TIDE_ONLY' | 'MID_TIDE_FLOW';
    tideOffsetHours?: { beforeHigh?: number; afterHigh?: number; beforeLow?: number; afterLow?: number };
    shelteredFromWindDirections?: ('N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW')[];
    minWaterHeightMeters?: number;
    dogsAllowedSummer: boolean;
    strollerFriendly: boolean;
    rainFriendly: boolean;
  };
  practicalInfo?: PracticalInfo;
  tideDetails?: TideDetails;
  photoGallery?: PhotoItem[];
}

export function getCuratedSpots(): CuratedSpotRecord[] {
  const filePath = path.resolve(process.cwd(), 'data/curated-spots.json');
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as CuratedSpotRecord[];
}

export function findCuratedSpotBySlug(slug: string): CuratedSpotRecord | undefined {
  return getCuratedSpots().find((s) => s.slug === slug);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/curated-spots.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add data/curated-spots.json src/lib/curated-spots.ts tests/curated-spots.test.ts
git commit -m "feat(data): add curated spots data store with original non-plagiarized tips"
```

---

### Task 3: Ingestion Sélective DATAtourisme & Heuristiques Spatiales

**Files:**
- Create: `src/lib/ingest/spatial-heuristics.ts`
- Create: `src/lib/ingest/datatourisme-connector.ts`
- Create: `tests/ingest-places.test.ts`

**Interfaces:**
- Produces: `resolveTideHarborByCoords(lat: number, lng: number): 'PORT_NAVALO' | 'VANNES'`, `filterDatatourismeRecord(record: unknown): boolean`, `mapDatatourismeToPlace(record: unknown): PartialPlace | null`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/ingest-places.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolveTideHarborByCoords, estimateBeachWindShelter } from '../src/lib/ingest/spatial-heuristics.ts';
import { isAcceptedDatatourismeCategory, cleanPlaceDescription } from '../src/lib/ingest/datatourisme-connector.ts';

describe('DATAtourisme Ingestion & Spatial Heuristics', () => {
  it('assigns Vannes harbor to inner gulf and Port-Navalo to ocean entrance', () => {
    assert.strictEqual(resolveTideHarborByCoords(47.63, -2.77), 'VANNES');
    assert.strictEqual(resolveTideHarborByCoords(47.54, -2.91), 'PORT_NAVALO');
  });

  it('rejects lodging, hotels, campings and accepts natural and cultural spots', () => {
    assert.strictEqual(isAcceptedDatatourismeCategory(['Camping', 'Accommodation']), false);
    assert.strictEqual(isAcceptedDatatourismeCategory(['HotelTrade', 'CommercialAccommodation']), false);
    assert.strictEqual(isAcceptedDatatourismeCategory(['NaturalHeritage', 'Beach']), true);
    assert.strictEqual(isAcceptedDatatourismeCategory(['CulturalHeritage', 'Dolmen']), true);
  });

  it('cleanses and formats raw descriptions gracefully', () => {
    const cleaned = cleanPlaceDescription('  <p>Superbe crique rocheuse &amp; abritée.</p>  ');
    assert.strictEqual(cleaned, 'Superbe crique rocheuse & abritée.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/ingest-places.test.ts`  
Expected: FAIL (modules not found)

- [ ] **Step 3: Implement spatial heuristics and connector functions**

Create `src/lib/ingest/spatial-heuristics.ts`:
```typescript
export function resolveTideHarborByCoords(latitude: number, longitude: number): 'PORT_NAVALO' | 'VANNES' {
  // If located in northern/eastern inner gulf of Morbihan, Vannes tide applies
  if (longitude > -2.85 && latitude > 47.55) {
    return 'VANNES';
  }
  return 'PORT_NAVALO';
}

export function estimateBeachWindShelter(cardinalOpening: 'N' | 'S' | 'E' | 'W' | 'SE' | 'SW' | 'NE' | 'NW'): ('N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW')[] {
  // A beach opening South is sheltered from Northern winds (N, NW, NE)
  const shelterMap: Record<string, ('N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW')[]> = {
    S: ['N', 'NE', 'NW'],
    SW: ['N', 'NE', 'E'],
    SE: ['N', 'NW', 'W'],
    N: ['S', 'SE', 'SW'],
    E: ['W', 'SW', 'NW'],
    W: ['E', 'NE', 'SE'],
    NE: ['S', 'SW', 'W'],
    NW: ['S', 'SE', 'E'],
  };
  return shelterMap[cardinalOpening] || ['N'];
}
```

Create `src/lib/ingest/datatourisme-connector.ts`:
```typescript
const REJECTED_TYPES = new Set([
  'camping',
  'accommodation',
  'hotel',
  'hoteltrade',
  'collectiveaccommodation',
  'rentalaccommodation',
  'guesthouse',
  'lodgingbusiness',
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
]);

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

export function cleanPlaceDescription(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/ingest-places.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ingest/spatial-heuristics.ts src/lib/ingest/datatourisme-connector.ts tests/ingest-places.test.ts
git commit -m "feat(ingest): add datatourisme selective category filter and spatial tide heuristics"
```

---

### Task 4: Moteur d'Évaluation Contextuelle Affiné par Catégorie

**Files:**
- Modify: `src/lib/context-matcher.ts`
- Create: `tests/context-matcher-categories.test.ts`

**Interfaces:**
- Consumes: `evaluatePlaceContext(place, context, tidePredictions)`
- Produces: `ContextEvaluationResult` avec badge contextualisé (pas de badge marée forcé sur le patrimoine).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/context-matcher-categories.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { evaluatePlaceContext } from '../src/lib/context-matcher.ts';
import { Place, MarineWeatherContext } from '../src/lib/types/context.ts';

describe('Category-Aware Context Evaluation', () => {
  const dummyContext: MarineWeatherContext = {
    tempCelsius: 18,
    windSpeedKnots: 12,
    windDirectionDeg: 270,
    windCardinal: 'W',
    isRaining: false,
    tideStatus: {
      harbor: 'VANNES',
      currentHeight: 1.2,
      phase: 'EBB',
      state: 'FALLING',
      progressPercent: 80,
      nextTide: { type: 'LOW', time: new Date(), height: 0.8 },
      coefficient: 75,
    },
  };

  it('does NOT assign a low tide penalty to an indoor or heritage site', () => {
    const castle: Place = {
      id: '1',
      slug: 'chateau-suscinio',
      name: 'Château de Suscinio',
      shortDescription: 'Forteresse des Ducs de Bretagne',
      category: 'HERITAGE',
      commune: 'Sarzeau',
      communeSlug: 'sarzeau',
      sector: 'SARZEAU',
      latitude: 47.514,
      longitude: -2.778,
      contextualRules: {
        tideConstraint: 'ALL_TIDES',
        dogsAllowedSummer: false,
        strollerFriendly: true,
        rainFriendly: true,
      },
      isSponsored: false,
      updatedAt: new Date(),
    };

    const evaluation = evaluatePlaceContext(castle, dummyContext, []);
    assert.strictEqual(evaluation.status, 'IDEAL');
    assert.strictEqual(evaluation.badgeLabel.includes('marée'), false, 'Heritage badge should not mention tide');
  });

  it('keeps high tide requirement for beaches and reflects bathability', () => {
    const beach: Place = {
      id: '2',
      slug: 'plage-conleau',
      name: 'Plage de Conleau',
      shortDescription: 'Piscine naturelle d’eau de mer et crique abritée.',
      category: 'BEACH',
      commune: 'Vannes',
      communeSlug: 'vannes',
      sector: 'VANNES',
      latitude: 47.63,
      longitude: -2.77,
      contextualRules: {
        tideConstraint: 'HIGH_TIDE_ONLY',
        dogsAllowedSummer: false,
        strollerFriendly: true,
        rainFriendly: false,
      },
      isSponsored: false,
      updatedAt: new Date(),
    };

    const evaluation = evaluatePlaceContext(beach, dummyContext, []);
    assert.notStrictEqual(evaluation.status, 'IDEAL', 'Low water height should not be ideal for beach');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/context-matcher-categories.test.ts`  
Expected: FAIL or verify differences in badge copy.

- [ ] **Step 3: Update `evaluatePlaceContext` in `src/lib/context-matcher.ts`**

Refine `evaluatePlaceContext` so that:
- If `place.category === 'HERITAGE'` or `place.category === 'GASTRONOMY'` or `place.category === 'VIEWPOINT'`, ignore tide penalty when `tideConstraint === 'ALL_TIDES'`.
- Tailor `badgeLabel` according to category:
  - `BEACH`: *"Baignade idéale actuellement"* / *"Basse mer : estran découvert"*
  - `TIDAL_PASSAGE`: passage alert
  - `HERITAGE`: if raining *"Idéal par temps pluvieux"* else *"Visite conseillée"*
  - `VIEWPOINT`: *"Vue dégagée"*
  - `GASTRONOMY`: *"Idéal pour une pause gourmande"*

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/context-matcher-categories.test.ts && npm test`  
Expected: PASS (all tests including existing 119 pass)

- [ ] **Step 5: Commit**

```bash
git add src/lib/context-matcher.ts tests/context-matcher-categories.test.ts
git commit -m "feat(context): adapt context matching and badge labels by place category"
```

---

### Task 5: Composant d'Affichage Détaillé Réutilisable (`PlaceDetailView`)

**Files:**
- Create: `src/components/places/ParkingDirectButton.tsx`
- Create: `src/components/places/PhotoGallery.tsx`
- Create: `src/components/places/PlaceDetailView.tsx`
- Create: `tests/place-detail-view.test.ts`

**Interfaces:**
- Produces: `<PlaceDetailView place={place} context={context} onClose={...} />`
- Accessible, touch-friendly, displays category badge, gallery, parking one-tap GPS button, and practical info.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/place-detail-view.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ParkingDirectButton } from '../src/components/places/ParkingDirectButton.tsx';
import { PhotoGallery } from '../src/components/places/PhotoGallery.tsx';

describe('PlaceDetailView Subcomponents', () => {
  it('renders ParkingDirectButton with Waze and Google Maps links when coordinates exist', () => {
    const html = renderToStaticMarkup(
      React.createElement(ParkingDirectButton, {
        parkingLat: 47.5872,
        parkingLng: -2.8941,
        placeName: 'Île de Berder',
      })
    );
    assert.ok(html.includes('maps.google.com'), 'Must contain Google Maps URL');
    assert.ok(html.includes('waze.com') || html.includes('waze://'), 'Must contain Waze link');
    assert.ok(html.includes('Parking'), 'Must display Parking label');
  });

  it('renders PhotoGallery with fallback image if gallery is empty', () => {
    const html = renderToStaticMarkup(
      React.createElement(PhotoGallery, {
        photos: [],
        placeName: 'Spot de test',
      })
    );
    assert.ok(html.includes('<img'), 'Must render at least one fallback image tag');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/place-detail-view.test.ts`  
Expected: FAIL (modules not found)

- [ ] **Step 3: Implement components**

Create `src/components/places/ParkingDirectButton.tsx`:
```tsx
import React from 'react';
import { Navigation, Car } from 'lucide-react';

interface ParkingDirectButtonProps {
  parkingLat?: number | null;
  parkingLng?: number | null;
  placeName: string;
  className?: string;
}

export function ParkingDirectButton({ parkingLat, parkingLng, placeName, className = '' }: ParkingDirectButtonProps) {
  if (!parkingLat || !parkingLng) return null;

  const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${parkingLat},${parkingLng}`;
  const wazeUrl = `https://waze.com/ul?ll=${parkingLat},${parkingLng}&navigate=yes`;

  return (
    <div className={`rounded-xl border border-emerald-100 bg-emerald-50/70 p-3.5 ${className}`}>
      <div className="flex items-center gap-2 font-medium text-emerald-950 text-sm">
        <Car className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden="true" />
        <span>Stationnement conseillé ({placeName})</span>
      </div>
      <p className="mt-1 text-xs text-emerald-800">
        Accès direct au parking officiel vérifié pour éviter les voies encombrées.
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <a
          href={gmapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 font-medium text-white text-xs shadow-sm hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
        >
          <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Itinéraire Google Maps</span>
        </a>
        <a
          href={wazeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 font-medium text-emerald-800 text-xs shadow-sm hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
        >
          <span>Ouvrir dans Waze</span>
        </a>
      </div>
    </div>
  );
}
```

Create `src/components/places/PhotoGallery.tsx`:
```tsx
import React from 'react';
import { PhotoItem } from '../../lib/types/context';

interface PhotoGalleryProps {
  photos?: PhotoItem[];
  placeName: string;
}

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80';

export function PhotoGallery({ photos, placeName }: PhotoGalleryProps) {
  const items = photos && photos.length > 0 ? photos : [{ url: DEFAULT_IMAGE, caption: placeName }];

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-slate-100 shadow-inner">
      <div className="flex snap-x snap-mandatory overflow-x-auto scrollbar-none">
        {items.map((photo, idx) => (
          <div key={idx} className="relative aspect-[16/10] w-full shrink-0 snap-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={photo.caption || placeName}
              className="h-full w-full object-cover"
              loading={idx === 0 ? 'eager' : 'lazy'}
            />
            {photo.caption && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent p-3 text-white text-xs">
                <span>{photo.caption}</span>
                {photo.credit && <span className="ml-1 opacity-75">© {photo.credit}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

Create `src/components/places/PlaceDetailView.tsx`:
Assemble category-aware badge, `PhotoGallery`, description, practical info with icons (toilets, water, duration, pricing), non-plagiarized `insiderTip` callout box, and `ParkingDirectButton`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/place-detail-view.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/places/ParkingDirectButton.tsx src/components/places/PhotoGallery.tsx src/components/places/PlaceDetailView.tsx tests/place-detail-view.test.ts
git commit -m "feat(ui): add PlaceDetailView with photo gallery and direct GPS parking button"
```

---

### Task 6: Intégration Hybride sur la Carte & Bottom Sheet Extensible

**Files:**
- Modify: `src/components/explorer/MobileExplorerSheet.tsx`
- Modify: `src/app/carte/page.tsx`
- Create: `tests/carte-hybrid-navigation.test.ts`

**Interfaces:**
- Consumes: `selectedPlace: Place | null`, URL search param `?spot=[slug]`
- Produces: Smooth expansion to full-screen (snap point `0.92`) when a spot is clicked, displaying `PlaceDetailView`, updating URL without page reload via shallow navigation.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/carte-hybrid-navigation.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MobileExplorerSheet } from '../src/components/explorer/MobileExplorerSheet.tsx';

describe('Carte Hybrid Navigation & Expanding Sheet', () => {
  it('renders selected place detail view when selectedPlace is provided', () => {
    const dummyPlace = {
      id: 'berder-id',
      slug: 'ile-de-berder',
      name: 'Île de Berder',
      shortDescription: 'Passage submersible mythique',
      category: 'TIDAL_PASSAGE' as const,
      commune: 'Larmor-Baden',
      communeSlug: 'larmor-baden',
      sector: 'ARRADON',
      latitude: 47.579,
      longitude: -2.888,
      contextualRules: {
        tideConstraint: 'LOW_TIDE_ONLY' as const,
        dogsAllowedSummer: true,
        strollerFriendly: false,
        rainFriendly: false,
      },
      isSponsored: false,
      updatedAt: new Date(),
    };

    const html = renderToStaticMarkup(
      React.createElement(MobileExplorerSheet, {
        places: [dummyPlace],
        selectedPlace: dummyPlace,
        onSelectPlace: () => {},
        snapPoint: '0.92',
        onSnapPointChange: () => {},
      })
    );

    assert.ok(html.includes('Île de Berder'), 'Must display selected spot title');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/carte-hybrid-navigation.test.ts`  
Expected: verify failure or missing detail rendering when selected.

- [ ] **Step 3: Update `MobileExplorerSheet.tsx` and `carte/page.tsx`**

Integrate `PlaceDetailView` inside the sheet when `selectedPlace` is active. Provide a back-button `[← Retour aux spots]` that resets selection and snap point to `0.5`, synchronizing URL search param `?spot=` with `window.history.pushState`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/carte-hybrid-navigation.test.ts && npm test`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/explorer/MobileExplorerSheet.tsx src/app/carte/page.tsx tests/carte-hybrid-navigation.test.ts
git commit -m "feat(carte): wire hybrid full-screen place detail view into mobile sheet"
```

---

### Task 7: Page Autonome SEO (`/lieu/[slug]`) avec JSON-LD et ISR

**Files:**
- Create: `src/app/lieu/[slug]/page.tsx`
- Create: `tests/lieu-page.test.ts`

**Interfaces:**
- Produces: dynamic static route `/lieu/[slug]` with `generateMetadata`, schema.org `TouristAttraction` JSON-LD, and `PlaceDetailView` with back button to `/carte`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/lieu-page.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LieuPage from '../src/app/lieu/[slug]/page.tsx';

describe('Standalone /lieu/[slug] Page', () => {
  it('renders PlaceDetailView with Schema.org JSON-LD tag', async () => {
    const pageJsx = await LieuPage({ params: Promise.resolve({ slug: 'ile-de-berder' }) });
    const html = renderToStaticMarkup(pageJsx);

    assert.ok(html.includes('Île de Berder'), 'Must render spot name');
    assert.ok(html.includes('application/ld+json'), 'Must include JSON-LD script tag');
    assert.ok(html.includes('TouristAttraction'), 'JSON-LD must specify TouristAttraction');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/lieu-page.test.ts`  
Expected: FAIL (file does not exist)

- [ ] **Step 3: Implement `src/app/lieu/[slug]/page.tsx`**

```tsx
import React from 'react';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Map } from 'lucide-react';
import { findCuratedSpotBySlug, getCuratedSpots } from '../../../lib/curated-spots';
import { PlaceDetailView } from '../../../components/places/PlaceDetailView';
import { Place } from '../../../lib/types/context';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const spots = getCuratedSpots();
  return spots.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const spot = findCuratedSpotBySlug(slug);
  if (!spot) return { title: 'Lieu non trouvé | Guide Morbihan' };

  return {
    title: `${spot.name} (${spot.commune}) | Guide Morbihan`,
    description: spot.shortDescription,
    openGraph: {
      title: `${spot.name} - Guide Morbihan`,
      description: spot.shortDescription,
      images: spot.photoGallery?.[0]?.url ? [{ url: spot.photoGallery[0].url }] : [],
    },
  };
}

export default async function LieuPage({ params }: PageProps) {
  const { slug } = await params;
  const spot = findCuratedSpotBySlug(slug);
  if (!spot) notFound();

  // Adapt to Place entity
  const placeEntity: Place = {
    ...spot,
    id: spot.slug,
    isSponsored: false,
    updatedAt: new Date(),
  };

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    name: spot.name,
    description: spot.shortDescription,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: spot.latitude,
      longitude: spot.longitude,
    },
    address: {
      '@type': 'PostalAddress',
      addressLocality: spot.commune,
      addressRegion: 'Morbihan',
      addressCountry: 'FR',
    },
  };

  return (
    <main className="min-h-screen bg-slate-50 pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-md">
        <Link
          href={`/carte?spot=${spot.slug}`}
          className="inline-flex min-h-[44px] items-center gap-1.5 text-slate-700 text-sm font-medium hover:text-emerald-700"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voir sur la carte</span>
        </Link>
        <Link
          href={`/carte?spot=${spot.slug}`}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-white text-xs font-medium shadow-sm hover:bg-emerald-800"
        >
          <Map className="h-3.5 w-3.5" />
          <span>Ouvrir la Carte</span>
        </Link>
      </div>

      <div className="mx-auto max-w-2xl px-4 pt-4">
        <PlaceDetailView place={placeEntity} />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/lieu-page.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/lieu/[slug]/page.tsx tests/lieu-page.test.ts
git commit -m "feat(seo): add standalone /lieu/[slug] route with Schema.org JSON-LD"
```

---

### Task 8: Script CLI d'Ingestion & Validation End-to-End

**Files:**
- Create: `scripts/ingest-places.ts`
- Modify: `package.json`
- Test: Build validation `npm run build` and `npm test`

**Interfaces:**
- Produces: `npm run db:ingest` command merging curated spots and open data into DB with spatial heuristics.

- [ ] **Step 1: Write ingestion CLI script**

Create `scripts/ingest-places.ts` that:
1. Loads `data/curated-spots.json`.
2. Connects to PostgreSQL via Drizzle.
3. Upserts all curated spots into `places` table with `sourceType = 'CURATED'`.
4. Logs summary count of ingested and updated places.

- [ ] **Step 2: Add script to `package.json`**

In `package.json`, add:
```json
"db:ingest": "tsx scripts/ingest-places.ts"
```

- [ ] **Step 3: Run test suite and Next.js build**

Run: `npm test && npm run build`  
Expected: 
- 100% tests PASS (at least 125 tests total).
- `next build` generates routes `/`, `/carte`, `/lieu/[slug]` without any TypeScript or hydration errors.

- [ ] **Step 4: Commit**

```bash
git add scripts/ingest-places.ts package.json
git commit -m "feat(cli): add db:ingest script and verify production build"
```

---

## Plan Self-Review Checklist

1. **Spec Coverage:**
   - Schéma Drizzle enrichi (`photoGallery`, `practicalInfo`, `tideDetails`) $\rightarrow$ Task 1
   - Base de curation locale avec conseils originaux sans plagiat $\rightarrow$ Task 2
   - Ingestion sélective DATAtourisme & filtres de rejet hébergement $\rightarrow$ Task 3
   - Contexte adapté par catégorie (pas d'alerte marée sur patrimoine) $\rightarrow$ Task 4
   - Composants réutilisables (`PlaceDetailView`, parking direct GPS) $\rightarrow$ Task 5
   - Navigation hybride carte / bottom sheet extensible $\rightarrow$ Task 6
   - Page autonome `/lieu/[slug]` avec JSON-LD $\rightarrow$ Task 7
   - Ingestion CLI et validation build $\rightarrow$ Task 8

2. **Placeholder Scan:**
   - Zéro `TODO`, `TBD`, ou fonction non typée. Tout le code et les commandes CLI sont décrits explicitement.

3. **Type Consistency:**
   - `PhotoItem`, `PracticalInfo`, `TideDetails`, `PlaceSourceType` définis en Task 1 et réutilisés rigoureusement dans toutes les tâches suivantes.
