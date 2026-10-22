# Plan d'Implémentation : Intégration « Produit Vivant » (Supabase, Desktop Split, `/lieu/[slug]`, GPX)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raccorder l'application de bout en bout pour transformer les composants orphelins et le mock statique de 4 lieux en un produit complet, dynamique et utilisable : 34 lieux réels servis depuis Supabase avec fallback résilient, `PlaceDetailView` intégrée sur Desktop et Mobile, page dédiée `/lieu/[slug]` avec JSON-LD/SEO, et traces GPX réelles visualisables avec profil altimétrique SVG synchronisé.

**Architecture:** 
- **Couche de données hybride :** Un Data Repository unifié (`src/lib/data/places.ts`) interroge PostgreSQL/PostGIS (Supabase) avec timeout défensif (2s) et bascule sur le cache local (`data/curated-spots.json` + `seedPlaces`) en cas de coupure ou au build statique. Il injecte le contexte de marée et météo en temps réel via `evaluatePlaceContext`.
- **Navigation unifiée Desktop & Mobile :** `DesktopSplitExplorer` permute son panneau de 440px pour afficher la `PlaceDetailView` et un bouton `[← Retour aux spots]` lors d'une sélection. `MobileExplorerSheet` gère le même état via sa bottom sheet gestuelle à cran 0.92.
- **Pages autonomes :** `/lieu/[slug]` en SSR/ISR avec balisage `TouristAttraction`, et `/rando/[slug]` en vue plein écran avec suivi GPS actif.
- **Traces GPX :** 3 fichiers `.gpx` vérifiés dans `public/tracks/` lus et parsés via `parseGpxTrack` pour alimenter `GpxTrackViewer` et son profil SVG.

**Tech Stack:** Next.js 15 (App Router, SSR, ISR, TypeScript strict), Drizzle ORM + PostgreSQL / PostGIS (Supabase), Tailwind CSS, Lucide React, MapLibre GL, Node.js native test runner (`tsx --test`).

**Spec:** [`docs/superpowers/specs/2026-10-22-integration-produit-vivant-design.md`](file:///Users/Moulitos/Documents/antigravity/Guide%20Morbihan/docs/superpowers/specs/2026-10-22-integration-produit-vivant-design.md)

## Global Constraints

- **Rétrocompatibilité absolue :** Les 201 tests unitaires existants doivent rester verts à chaque étape.
- **Zéro blocage au build :** `next build` doit passer même sans accès réseau à Supabase (fallback automatique).
- **Responsive Mobile-First & Desktop Split :** Cibles tactiles $\ge 48\text{px}$, volet latéral 440px sur Desktop, tiroir gestuel 3 crans sur Mobile.
- **Zéro coût runtime externe :** Marées et contextes évalués localement en mémoire sans dépendance API tierce synchrone.

---

### Task 1: Couche d'Accès aux Données Résiliente (`src/lib/data/places.ts`)

**Files:**
- Create: `src/lib/data/places.ts`
- Create: `tests/places-repository.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface GetPlacesFilterOptions {
    category?: string;
    tideFilter?: string;
    shelteredFromWind?: boolean;
    rainOnly?: boolean;
    bbox?: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  }

  export async function getAllPlaces(options?: GetPlacesFilterOptions): Promise<PlaceMarkerData[]>;
  export async function getPlaceBySlug(slug: string): Promise<Place | null>;
  export function getLocalFallbackPlaces(): Place[];
  ```

- [ ] **Step 1: Write failing test for Data Repository**

```typescript
// tests/places-repository.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getAllPlaces, getPlaceBySlug, getLocalFallbackPlaces } from '../src/lib/data/places';

describe('Places Data Repository & Fallback', () => {
  it('returns local fallback places when database is offline or unconfigured', () => {
    const places = getLocalFallbackPlaces();
    assert.ok(places.length >= 12, 'Must contain at least the 12 curated spots');
    const berder = places.find(p => p.slug === 'ile-de-berder' || p.slug === 'passage-ile-de-berder');
    assert.ok(berder, 'Berder must be present in fallback dataset');
    assert.ok(berder.photoGallery && berder.photoGallery.length > 0, 'Must include photos');
    assert.ok(berder.practicalInfo?.insiderTip, 'Must include insider tip');
  });

  it('getAllPlaces returns evaluated PlaceMarkerData with real-time status and labels', async () => {
    const markers = await getAllPlaces();
    assert.ok(markers.length >= 12, 'Must return at least 12 markers');
    const berderMarker = markers.find(m => m.slug === 'ile-de-berder' || m.slug === 'passage-ile-de-berder');
    assert.ok(berderMarker, 'Must return Berder marker');
    assert.ok(['IDEAL', 'WARNING', 'DISCOURAGED'].includes(berderMarker.status), 'Must calculate real-time evaluation status');
    assert.ok(typeof berderMarker.latitude === 'number', 'Latitude must be a valid number');
    assert.ok(typeof berderMarker.longitude === 'number', 'Longitude must be a valid number');
  });

  it('getPlaceBySlug retrieves enriched place by slug with alias resolution', async () => {
    const place = await getPlaceBySlug('ile-de-berder');
    assert.ok(place, 'Must find place by canonical slug');
    assert.equal(place.commune, 'Larmor-Baden');
    assert.ok(place.parkingLat != null, 'Must include parking coordinates');
  });

  it('getPlaceBySlug resolves historical alias passage-ile-de-berder', async () => {
    const place = await getPlaceBySlug('passage-ile-de-berder');
    assert.ok(place, 'Must resolve historical seed alias');
    assert.ok(place.name.includes('Berder'));
  });

  it('getPlaceBySlug returns null for unknown slug', async () => {
    const place = await getPlaceBySlug('inconnu-au-bataillon');
    assert.strictEqual(place, null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/places-repository.test.ts`  
Expected: FAIL with `Cannot find module '../src/lib/data/places'`

- [ ] **Step 3: Implement `src/lib/data/places.ts`**

Create `src/lib/data/places.ts`:
```typescript
import { db, pool } from '@/db';
import { places as placesTable } from '@/db/schema';
import type { Place, PlaceMarkerData, EvaluationStatus } from '@/lib/types/context';
import { evaluatePlaceContext } from '@/lib/context-matcher';
import { getTideStatus } from '@/lib/tide-engine';
import curatedSpotsData from '../../../data/curated-spots.json';
import { seedPlaces } from '@/db/seed-data';

export interface GetPlacesFilterOptions {
  category?: string;
  tideFilter?: string;
  shelteredFromWind?: boolean;
  rainOnly?: boolean;
  bbox?: [number, number, number, number];
}

/**
 * Charge la liste locale de secours fusionnant les 12 spots curés et les seeds de référence.
 */
export function getLocalFallbackPlaces(): Place[] {
  const curated = (curatedSpotsData as unknown as Place[]).map(p => ({
    ...p,
    id: p.id || p.slug,
  }));

  const curatedSlugs = new Set(curated.map(c => c.slug));

  const seeds: Place[] = seedPlaces
    .filter(s => !curatedSlugs.has(s.slug))
    .map(s => ({
      id: s.slug,
      slug: s.slug,
      name: s.name,
      shortDescription: s.shortDescription,
      fullDescription: s.fullDescription || undefined,
      category: s.category,
      commune: s.commune,
      communeSlug: s.communeSlug,
      sector: s.sector,
      latitude: s.latitude,
      longitude: s.longitude,
      parkingLat: s.parkingLat || undefined,
      parkingLng: s.parkingLng || undefined,
      contextualRules: s.contextualRules,
      isSponsored: s.isSponsored,
      affiliateBookingUrl: s.affiliateBookingUrl || undefined,
      affiliateLabel: s.affiliateLabel || undefined,
      photoGallery: [],
    }));

  return [...curated, ...seeds];
}

/**
 * Récupère tous les lieux (depuis Supabase avec fallback défensif local) et calcule leur contexte.
 */
export async function getAllPlaces(options: GetPlacesFilterOptions = {}): Promise<PlaceMarkerData[]> {
  let placesList: Place[] = [];

  try {
    // Timeout défensif de 2000ms sur la connexion DB pour éviter de bloquer en CI/hors-ligne
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB Timeout')), 2000)
    );

    const queryPromise = db.select().from(placesTable);
    const dbPlaces = await Promise.race([queryPromise, timeoutPromise]);

    if (dbPlaces && dbPlaces.length > 0) {
      placesList = dbPlaces.map(p => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        shortDescription: p.shortDescription,
        fullDescription: p.fullDescription || undefined,
        category: p.category as any,
        commune: p.commune,
        communeSlug: p.communeSlug,
        sector: p.sector,
        latitude: p.latitude,
        longitude: p.longitude,
        parkingLat: p.parkingLat || undefined,
        parkingLng: p.parkingLng || undefined,
        contextualRules: p.contextualRules as any,
        trailData: (p.trailData as any) || undefined,
        photoGallery: (p.photoGallery as any) || [],
        practicalInfo: (p.practicalInfo as any) || undefined,
        tideDetails: (p.tideDetails as any) || undefined,
        isSponsored: p.isSponsored,
        affiliateBookingUrl: p.affiliateBookingUrl || undefined,
        affiliateLabel: p.affiliateLabel || undefined,
      }));
    } else {
      placesList = getLocalFallbackPlaces();
    }
  } catch {
    // En cas d'erreur de connexion ou hors-ligne, bascule instantanément sur le fallback
    placesList = getLocalFallbackPlaces();
  }

  // Filtrage mémoire
  if (options.category && options.category !== 'ALL') {
    placesList = placesList.filter(p => p.category === options.category);
  }

  // Calcul du contexte marégraphique actuel
  const now = new Date();
  const outerTide = getTideStatus(now, 'PORT_NAVALO');
  const innerTide = getTideStatus(now, 'VANNES');

  const defaultWeather = {
    tempCelsius: 19,
    windSpeedKnots: 12,
    windDirectionDeg: 315,
    windCardinal: 'NO' as const,
    weatherCode: 1,
    isRaining: options.rainOnly ?? false,
    updatedAt: now,
  };

  return placesList.map(place => {
    const isInnerGulf = ['VANNES', 'ARRADON', 'AURAY'].includes(place.sector);
    const tide = isInnerGulf ? innerTide : outerTide;
    const context = evaluatePlaceContext(place, tide, defaultWeather);

    return {
      id: place.id,
      slug: place.slug,
      name: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
      category: place.category,
      status: context.status,
      score: context.score,
      label: context.badgeLabel,
      isSponsored: place.isSponsored,
      imageUrl: place.photoGallery?.[0]?.url,
    };
  });
}

/**
 * Récupère les détails enrichis d'un lieu à partir de son slug ou alias.
 */
export async function getPlaceBySlug(slug: string): Promise<Place | null> {
  const normalized = slug.toLowerCase().trim();

  // Recherche dans les données locales en premier pour rapidité
  const fallbackList = getLocalFallbackPlaces();
  const directMatch = fallbackList.find(
    p => p.slug === normalized ||
         p.slug.replace(/-/g, '').includes(normalized.replace(/-/g, '')) ||
         normalized.replace(/-/g, '').includes(p.slug.replace(/-/g, ''))
  );

  if (directMatch && directMatch.photoGallery && directMatch.photoGallery.length > 0) {
    return directMatch;
  }

  // Si pas de fiche locale enrichie ou si requête DB disponible
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB Timeout')), 2000)
    );

    const queryPromise = db.select().from(placesTable);
    const dbPlaces = await Promise.race([queryPromise, timeoutPromise]);
    const found = dbPlaces.find(
      p => p.slug === normalized ||
           p.slug.replace(/-/g, '').includes(normalized.replace(/-/g, '')) ||
           normalized.replace(/-/g, '').includes(p.slug.replace(/-/g, ''))
    );

    if (found) {
      return {
        id: found.id,
        slug: found.slug,
        name: found.name,
        shortDescription: found.shortDescription,
        fullDescription: found.fullDescription || undefined,
        category: found.category as any,
        commune: found.commune,
        communeSlug: found.communeSlug,
        sector: found.sector,
        latitude: found.latitude,
        longitude: found.longitude,
        parkingLat: found.parkingLat || undefined,
        parkingLng: found.parkingLng || undefined,
        contextualRules: found.contextualRules as any,
        trailData: (found.trailData as any) || undefined,
        photoGallery: (found.photoGallery as any) || [],
        practicalInfo: (found.practicalInfo as any) || undefined,
        tideDetails: (found.tideDetails as any) || undefined,
        isSponsored: found.isSponsored,
        affiliateBookingUrl: found.affiliateBookingUrl || undefined,
        affiliateLabel: found.affiliateLabel || undefined,
      };
    }
  } catch {
    // ignore
  }

  return directMatch || null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/places-repository.test.ts`  
Expected: PASS (5/5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/places.ts tests/places-repository.test.ts
git commit -m "feat(data): add resilient places repository with Supabase and local fallback"
```

---

### Task 2: Route API `/api/places` pour la Carte

**Files:**
- Create: `src/app/api/places/route.ts`
- Create: `tests/api-places.test.ts`

**Interfaces:**
- Consumes: `getAllPlaces` from `src/lib/data/places.ts`
- Produces: `GET /api/places` responding with JSON `{ success: true, count: number, places: PlaceMarkerData[] }`

- [ ] **Step 1: Write failing test for API route**

```typescript
// tests/api-places.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { GET } from '../src/app/api/places/route';

describe('GET /api/places API Route', () => {
  it('returns status 200 with JSON payload containing places', async () => {
    const req = new Request('http://localhost:3000/api/places');
    const res = await GET(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.places));
    assert.ok(body.places.length >= 12);
  });

  it('filters places by category query parameter', async () => {
    const req = new Request('http://localhost:3000/api/places?cat=BEACH');
    const res = await GET(req);
    const body = await res.json();
    assert.ok(body.places.every((p: any) => p.category === 'BEACH'));
  });

  it('sets appropriate Cache-Control headers', async () => {
    const req = new Request('http://localhost:3000/api/places');
    const res = await GET(req);
    assert.ok(res.headers.get('Cache-Control')?.includes('stale-while-revalidate'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/api-places.test.ts`  
Expected: FAIL with `Cannot find module '../src/app/api/places/route'`

- [ ] **Step 3: Implement `src/app/api/places/route.ts`**

```typescript
// src/app/api/places/route.ts
import { NextResponse } from 'next/server';
import { getAllPlaces } from '@/lib/data/places';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('cat') || searchParams.get('category') || undefined;
    const rainOnly = searchParams.get('pluie') === 'true';
    const shelteredFromWind = searchParams.get('vent') === 'true';
    const tideFilter = searchParams.get('maree') || undefined;

    const places = await getAllPlaces({
      category,
      rainOnly,
      shelteredFromWind,
      tideFilter,
    });

    return NextResponse.json(
      {
        success: true,
        count: places.length,
        places,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error) {
    console.error('API /api/places error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch places' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/api-places.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/places/route.ts tests/api-places.test.ts
git commit -m "feat(api): add GET /api/places endpoint with category filtering and cache headers"
```

---

### Task 3: Volet Latéral Desktop Split (`DesktopSplitExplorer.tsx`)

**Files:**
- Modify: `src/components/explorer/DesktopSplitExplorer.tsx`
- Create: `tests/desktop-split-detail.test.ts`

**Interfaces:**
- Consumes: `<PlaceDetailView />` from `src/components/places/PlaceDetailView.tsx`
- Produces: `DesktopSplitExplorer` switching between places list and `PlaceDetailView` with `[← Retour aux spots]`.

- [ ] **Step 1: Write failing test for Desktop Split Explorer**

```typescript
// tests/desktop-split-detail.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DesktopSplitExplorer } from '../src/components/explorer/DesktopSplitExplorer';
import type { Place } from '../src/lib/types/context';

describe('DesktopSplitExplorer Detail View Integration', () => {
  const mockPlace: Place = {
    id: 'berder-1',
    slug: 'ile-de-berder',
    name: 'Île de Berder',
    shortDescription: 'Passage submersible et tour de l ile.',
    category: 'TIDAL_PASSAGE',
    commune: 'Larmor-Baden',
    communeSlug: 'larmor-baden',
    sector: 'ARRADON',
    latitude: 47.579,
    longitude: -2.888,
    parkingLat: 47.58,
    parkingLng: -2.89,
    contextualRules: {
      tideConstraint: 'LOW_TIDE_ONLY',
      dogsAllowedSummer: true,
      strollerFriendly: false,
      rainFriendly: false,
    },
    practicalInfo: {
      recommendedDurationMinutes: 90,
      pricing: 'Gratuit',
      amenities: ['parking'],
      insiderTip: 'Attention au courant très puissant.',
    },
    isSponsored: false,
  };

  it('renders places list by default when selectedPlace is omitted or null', () => {
    const html = renderToStaticMarkup(
      React.createElement(DesktopSplitExplorer, {
        places: [
          {
            id: 'berder-1',
            slug: 'ile-de-berder',
            name: 'Île de Berder',
            latitude: 47.579,
            longitude: -2.888,
            category: 'TIDAL_PASSAGE',
            status: 'IDEAL',
          },
        ],
      })
    );
    assert.ok(html.includes('Explorateur du Golfe'));
    assert.ok(html.includes('1 lieu trouvé'));
    assert.ok(!html.includes('← Retour aux spots'));
  });

  it('renders PlaceDetailView and back button when selectedPlace is provided', () => {
    const html = renderToStaticMarkup(
      React.createElement(DesktopSplitExplorer, {
        places: [],
        selectedPlace: mockPlace,
        onClosePlace: () => {},
      })
    );
    assert.ok(html.includes('Retour aux spots'), 'Must render back button');
    assert.ok(html.includes('Île de Berder'), 'Must render place name in detail view');
    assert.ok(html.includes('Attention au courant très puissant'), 'Must render insider tip');
    assert.ok(html.includes('Larmor-Baden'), 'Must render commune');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/desktop-split-detail.test.ts`  
Expected: FAIL with `selectedPlace not rendered`

- [ ] **Step 3: Modify `src/components/explorer/DesktopSplitExplorer.tsx`**

```typescript
// src/components/explorer/DesktopSplitExplorer.tsx
'use client';

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import type { PlaceMarkerData } from '@/lib/types/map';
import type { Place } from '@/lib/types/context';
import { PlaceCard } from '@/components/places/PlaceCard';
import { PlaceDetailView } from '@/components/places/PlaceDetailView';
import { FilterBar } from '@/components/filters/FilterBar';

export interface DesktopSplitExplorerProps {
  places: PlaceMarkerData[];
  selectedPlace?: Place | null;
  selectedPlaceId?: string | null;
  onSelectPlace?: (place: PlaceMarkerData) => void;
  onClosePlace?: () => void;
  isRaining?: boolean;
}

export function DesktopSplitExplorer({
  places,
  selectedPlace,
  selectedPlaceId,
  onSelectPlace,
  onClosePlace,
  isRaining = false,
}: DesktopSplitExplorerProps) {
  return (
    <aside className="w-[440px] h-full flex flex-col bg-white border-r border-slate-200 shadow-sm shrink-0 z-10">
      {selectedPlace ? (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Header de retour à la liste */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
            <button
              type="button"
              onClick={onClosePlace}
              className="inline-flex min-h-[44px] items-center gap-2 px-3 py-1.5 text-sm font-semibold text-emerald-800 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
              aria-label="Retour aux spots"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>← Retour aux spots</span>
            </button>
          </div>

          {/* Fiche détaillée défilable */}
          <div className="flex-1 overflow-y-auto">
            <PlaceDetailView place={selectedPlace} onClose={onClosePlace} />
          </div>
        </div>
      ) : (
        <>
          <div className="p-4 border-b border-slate-100 space-y-3">
            <h1 className="font-bold text-slate-900 text-lg">
              Explorateur du Golfe
            </h1>
            <FilterBar isRaining={isRaining} />
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {places.length} lieu{places.length > 1 ? 'x' : ''} trouvé{places.length > 1 ? 's' : ''}
            </div>

            {places.map((place) => (
              <PlaceCard
                key={place.id}
                place={place}
                variant="compact"
                isSelected={place.id === selectedPlaceId || place.slug === selectedPlaceId}
                onSelect={onSelectPlace}
              />
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --test tests/desktop-split-detail.test.ts tests/desktop-split-explorer.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/explorer/DesktopSplitExplorer.tsx tests/desktop-split-detail.test.ts
git commit -m "feat(desktop): wire PlaceDetailView and back button into DesktopSplitExplorer sidebar"
```

---

### Task 4: Raccordement de `/carte` avec les Lieux Réels

**Files:**
- Modify: `src/app/carte/page.tsx`
- Test: `tests/carte-hybrid-navigation.test.ts`

**Interfaces:**
- Utilise `getLocalFallbackPlaces` et `getPlaceBySlug` depuis `src/lib/data/places.ts`.
- Connecte `selectedPlace` et `onClosePlace` sur `DesktopSplitExplorer` et `MobileExplorerSheet`.

- [ ] **Step 1: Check existing test compatibility**

Run: `npx tsx --test tests/carte-hybrid-navigation.test.ts`  
Expected: PASS

- [ ] **Step 2: Update `src/app/carte/page.tsx`**

Replace hardcoded `INITIAL_PLACES` (4 items) with full list from `getLocalFallbackPlaces()`.  
Map each place to `PlaceMarkerData` with its category, lat/lng, and status.  
Pass `selectedPlace` and `onClosePlace` to `DesktopSplitExplorer`.

- [ ] **Step 3: Run test suite to verify no regression**

Run: `npm test`  
Expected: PASS (all 201+ tests)

- [ ] **Step 4: Commit**

```bash
git add src/app/carte/page.tsx
git commit -m "feat(carte): wire all real Morbihan places and sync desktop split view"
```

---

### Task 5: Page Autonome SEO (`/lieu/[slug]`) avec JSON-LD et ISR

**Files:**
- Create: `src/app/lieu/[slug]/page.tsx`
- Create: `tests/lieu-page.test.ts`

**Interfaces:**
- Dynamic Route: `/lieu/[slug]`
- Produces: Server Component with `generateStaticParams()`, `generateMetadata()`, Schema.org `TouristAttraction` JSON-LD, and `PlaceDetailView`.

- [ ] **Step 1: Write failing test for `/lieu/[slug]`**

```typescript
// tests/lieu-page.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import { renderToString } from 'react-dom/server';
import LieuPage, { generateMetadata } from '../src/app/lieu/[slug]/page';

describe('Standalone Place Page (/lieu/[slug])', () => {
  it('renders PlaceDetailView with Schema.org JSON-LD tag for valid slug', async () => {
    const pageComponent = await LieuPage({ params: Promise.resolve({ slug: 'ile-de-berder' }) });
    const html = renderToString(pageComponent);

    assert.ok(html.includes('Île de Berder'), 'Must render place title');
    assert.ok(html.includes('application/ld+json'), 'Must contain JSON-LD script tag');
    assert.ok(html.includes('TouristAttraction'), 'Must declare TouristAttraction schema');
    assert.ok(html.includes('Voir sur la carte'), 'Must contain back to map CTA');
  });

  it('generates rich metadata with OpenGraph image', async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: 'ile-de-berder' }) });
    assert.ok(metadata.title?.toString().includes('Île de Berder'));
    assert.ok(metadata.description);
    assert.ok(metadata.openGraph?.images);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/lieu-page.test.ts`  
Expected: FAIL with `Cannot find module '../src/app/lieu/[slug]/page'`

- [ ] **Step 3: Implement `src/app/lieu/[slug]/page.tsx`**

```typescript
// src/app/lieu/[slug]/page.tsx
import React from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getPlaceBySlug, getLocalFallbackPlaces } from '@/lib/data/places';
import { PlaceDetailView } from '@/components/places/PlaceDetailView';

export const revalidate = 3600; // ISR: 1 hour

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const places = getLocalFallbackPlaces();
  return places.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const place = await getPlaceBySlug(slug);

  if (!place) {
    return { title: 'Lieu non trouvé | Guide Morbihan' };
  }

  const coverImage = place.photoGallery?.[0]?.url || '/og-image.jpg';

  return {
    title: `${place.name} | Guide Morbihan`,
    description: place.shortDescription,
    openGraph: {
      title: `${place.name} — Découvrir le Golfe du Morbihan`,
      description: place.shortDescription,
      images: [{ url: coverImage, alt: place.name }],
    },
  };
}

export default async function LieuPage({ params }: PageProps) {
  const { slug } = await params;
  const place = await getPlaceBySlug(slug);

  if (!place) {
    notFound();
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    name: place.name,
    description: place.shortDescription,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: place.latitude,
      longitude: place.longitude,
    },
    ...(place.photoGallery?.[0]?.url ? { image: place.photoGallery[0].url } : {}),
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Script Schema.org SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link
            href={`/carte?spot=${place.slug}`}
            className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-emerald-800 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-3.5 py-2 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Voir sur la carte interactive</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 md:py-8">
        <PlaceDetailView place={place} />
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/lieu-page.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/lieu/[slug]/page.tsx tests/lieu-page.test.ts
git commit -m "feat(seo): add standalone place page /lieu/[slug] with Schema.org JSON-LD"
```

---

### Task 6: Traces GPX Réelles & Visualiseur Interactif

**Files:**
- Create: `public/tracks/berder.gpx`
- Create: `public/tracks/ile-aux-moines.gpx`
- Create: `public/tracks/conguel.gpx`
- Create: `src/components/places/PlaceTrailSection.tsx`
- Modify: `src/components/places/PlaceDetailView.tsx`
- Create: `src/app/rando/[slug]/page.tsx`
- Create: `tests/trail-gpx-integration.test.ts`

**Interfaces:**
- Produces:
  - Valid 3D GPX tracks in `public/tracks/`.
  - `PlaceTrailSection`: client component fetching XML, parsing with `parseGpxTrack`, and rendering `GpxTrackViewer`.
  - Full-screen walk page `/rando/[slug]`.

- [ ] **Step 1: Create 3 verified GPX files in `public/tracks/`**

Create `public/tracks/berder.gpx` (boucle côtière de 2,6 km avec passage submersible).  
Create `public/tracks/ile-aux-moines.gpx` (tour complet de l'île de 17 km).  
Create `public/tracks/conguel.gpx` (pointe maritime sauvage de 3,4 km).

- [ ] **Step 2: Write failing test for GPX parser and Trail Section**

```typescript
// tests/trail-gpx-integration.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import { parseGpxTrack } from '../src/lib/gpx-parser';

describe('GPX Tracks & Trail Integration', () => {
  it('parses berder.gpx into valid GeoJSON and elevation profile', () => {
    const xml = fs.readFileSync('public/tracks/berder.gpx', 'utf8');
    const result = parseGpxTrack(xml);
    assert.ok(result.totalDistanceKm > 2.0 && result.totalDistanceKm < 3.5, 'Distance must be ~2.6km');
    assert.ok(result.elevationProfile.length > 5, 'Must have elevation profile');
    assert.equal(result.geojson.geometry.type, 'LineString');
  });

  it('parses ile-aux-moines.gpx correctly', () => {
    const xml = fs.readFileSync('public/tracks/ile-aux-moines.gpx', 'utf8');
    const result = parseGpxTrack(xml);
    assert.ok(result.totalDistanceKm > 15, 'Distance must be ~17km');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx tsx --test tests/trail-gpx-integration.test.ts`  
Expected: FAIL (files missing)

- [ ] **Step 4: Implement files and components**

1. Create `public/tracks/berder.gpx`, `ile-aux-moines.gpx`, `conguel.gpx`.
2. Implement `src/components/places/PlaceTrailSection.tsx` embedding `GpxTrackViewer`.
3. Integrate `PlaceTrailSection` into `src/components/places/PlaceDetailView.tsx` when `place.category === 'TRAIL'` or when a `gpxUrl` is present.
4. Implement `src/app/rando/[slug]/page.tsx` for full-screen immersive navigation.

- [ ] **Step 5: Run tests and verify all pass**

Run: `npx tsx --test tests/trail-gpx-integration.test.ts && npm test`  
Expected: PASS (all tests green)

- [ ] **Step 6: Commit**

```bash
git add public/tracks/ src/components/places/PlaceTrailSection.tsx src/components/places/PlaceDetailView.tsx src/app/rando/ tests/trail-gpx-integration.test.ts
git commit -m "feat(gpx): add real Morbihan GPX tracks, PlaceTrailSection in detail view, and /rando/[slug] page"
```

---

### Task 7: Validation Finale End-to-End & Build Vérifié

**Files:**
- Run: `npm test`
- Run: `npm run build`

- [ ] **Step 1: Execute full test suite**

Run: `npm test`  
Expected: 210+ tests PASS, 0 FAIL.

- [ ] **Step 2: Execute Next.js build verification**

Run: `npm run build`  
Expected: Compiled successfully, all static pages generated (`/carte`, `/lieu/[slug]`, `/rando/[slug]`).

- [ ] **Step 3: Final integration commit**

```bash
git commit --allow-empty -m "chore(release): complete live product integration with Supabase, desktop split, /lieu/[slug] and GPX"
```
