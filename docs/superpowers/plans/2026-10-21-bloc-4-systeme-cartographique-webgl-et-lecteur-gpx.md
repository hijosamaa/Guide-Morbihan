# Bloc 4 — Système Cartographique WebGL & Lecteur GPX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Développer le système cartographique WebGL souverain (`GolfeMap.tsx`) basé sur MapLibre GL JS et OpenFreeMap, avec des marqueurs HTML contextuels dynamiques stylisés en Tailwind par statut (Vert/Orange/Gris/Doré), et le lecteur de traces GPX (`GpxTrackViewer.tsx`) synchronisé de façon bidirectionnelle avec un profil altimétrique SVG interactif.

**Architecture:** Moteur cartographique MapLibre GL JS natif encapsulé dans des composants client Next.js 15 (`'use client'`). Profil altimétrique réactif en SVG pur mathématique (zéro bibliothèque tierce de charting). Wrappers dynamiques SSR (`next/dynamic` avec `ssr: false` et squelette de chargement Tailwind). Tests unitaires et d'isolation exécutés via `node:test` et `renderToString`.

**Tech Stack:** Next.js 15, React 19, MapLibre GL JS (v5), Tailwind CSS, Lucide React, TypeScript strict, `node:test` via `tsx`.

**Spec:** [docs/superpowers/specs/2026-10-21-bloc-4-systeme-cartographique-webgl-et-lecteur-gpx-design.md](file:///Users/Moulitos/Documents/antigravity/Guide%20Morbihan/docs/superpowers/specs/2026-10-21-bloc-4-systeme-cartographique-webgl-et-lecteur-gpx-design.md)

## Global Constraints

- Aucun appel vers des API cartographiques propriétaires payantes (Mapbox, Google Maps).
- Utilisation exclusive des tuiles vectorielles libres OpenFreeMap (`styles/liberty`) avec repli résilient sur tuiles raster OSM.
- Éradication totale des erreurs d'hydratation serveur (`window is not defined`) grâce aux wrappers `DynamicMapWrappers.tsx`.
- Tous les éléments d'interface (contrôles, marqueurs, pins, profil SVG) doivent être intégralement modifiables via des classes utilitaires Tailwind CSS.
- Synchronisation fluide du profil altimétrique et de la trace sans saccade à 60 FPS sur mobile.
- Nettoyage rigoureux du cycle de vie WebGL (`map.remove()`, annulation des render tasks, libération du contexte GPU).
- Tests exécutables via `npm test` (`tsx --test tests/**/*.test.ts`).

---

### Task 1: Installation de `maplibre-gl`, Types & Constantes de Configuration

**Files:**
- Modify: `package.json`
- Create: `src/lib/types/map.ts`
- Create: `src/lib/map-config.ts`
- Test: `tests/map-config.test.ts`

**Interfaces:**
- Produces: Types `PlaceMarkerData`, `MapViewportBounds`, `ElevationPoint`, `GolfeMapProps`, `GpxTrackViewerProps`, `MarkerStyleTokens`.
- Produces: Constantes `GOLFE_MAP_CONFIG`, `STATUS_STYLE_CONFIG`.

- [ ] **Step 1: Write test for configuration and types**

Create `tests/map-config.test.ts`:
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { GOLFE_MAP_CONFIG, STATUS_STYLE_CONFIG } from '../src/lib/map-config';
import type { PlaceMarkerData, MapViewportBounds, ElevationPoint } from '../src/lib/types/map';

test('GOLFE_MAP_CONFIG defines appropriate bounds and center for Golfe du Morbihan', () => {
  assert.equal(typeof GOLFE_MAP_CONFIG.defaultCenter[0], 'number');
  assert.equal(typeof GOLFE_MAP_CONFIG.defaultCenter[1], 'number');
  // Longitude West in Morbihan is negative
  assert.ok(GOLFE_MAP_CONFIG.defaultCenter[0] < -2.5 && GOLFE_MAP_CONFIG.defaultCenter[0] > -3.0);
  assert.ok(GOLFE_MAP_CONFIG.defaultCenter[1] > 47.4 && GOLFE_MAP_CONFIG.defaultCenter[1] < 47.7);

  // Bounds contain the center
  const [sw, ne] = GOLFE_MAP_CONFIG.maxBounds;
  assert.ok(sw[0] < GOLFE_MAP_CONFIG.defaultCenter[0]);
  assert.ok(ne[0] > GOLFE_MAP_CONFIG.defaultCenter[0]);
  assert.ok(sw[1] < GOLFE_MAP_CONFIG.defaultCenter[1]);
  assert.ok(ne[1] > GOLFE_MAP_CONFIG.defaultCenter[1]);

  // OpenFreeMap style URL
  assert.ok(GOLFE_MAP_CONFIG.styles.liberty.includes('openfreemap.org'));
});

test('STATUS_STYLE_CONFIG contains Tailwind classes for all context statuses', () => {
  const statuses = ['IDEAL', 'WARNING', 'DISCOURAGED', 'SPONSORED'];
  for (const status of statuses) {
    const config = STATUS_STYLE_CONFIG[status];
    assert.ok(config, `Missing status style for ${status}`);
    assert.ok(typeof config.badgeClass === 'string');
    assert.ok(typeof config.ringClass === 'string');
  }

  assert.ok(STATUS_STYLE_CONFIG.IDEAL.badgeClass.includes('emerald'));
  assert.ok(STATUS_STYLE_CONFIG.WARNING.badgeClass.includes('amber'));
  assert.ok(STATUS_STYLE_CONFIG.DISCOURAGED.badgeClass.includes('slate'));
  assert.ok(STATUS_STYLE_CONFIG.SPONSORED.badgeClass.includes('yellow') || STATUS_STYLE_CONFIG.SPONSORED.badgeClass.includes('amber'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/map-config.test.ts`
Expected: FAIL (Cannot find module `../src/lib/map-config`)

- [ ] **Step 3: Install `maplibre-gl` and implement types and configuration**

Run installation command:
```bash
npm install maplibre-gl@^5.1.0
```

Create `src/lib/types/map.ts`:
```typescript
import type { EvaluationStatus } from './context';

export interface PlaceMarkerData {
  id: string;
  slug: string;
  name: string;
  latitude: number;
  longitude: number;
  category: string;
  status: EvaluationStatus;
  isSponsored?: boolean;
  score?: number;
  label?: string;
}

export interface MapViewportBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface ElevationPoint {
  distanceKm: number;
  elevationM: number;
  lat: number;
  lon: number;
}

export interface MarkerStyleTokens {
  badgeClass: string;
  dotClass: string;
  ringClass: string;
  iconName?: string;
}

export interface GolfeMapProps {
  places?: PlaceMarkerData[];
  selectedPlaceId?: string | null;
  onSelectPlace?: (place: PlaceMarkerData) => void;
  onBoundsChange?: (placesInView: PlaceMarkerData[], bounds: MapViewportBounds) => void;
  initialCenter?: [number, number];
  initialZoom?: number;
  interactive?: boolean;
  className?: string;
  showControls?: boolean;
  enableUserLocation?: boolean;
}

export interface GpxTrackViewerProps {
  geojson: GeoJSON.Feature<GeoJSON.LineString>;
  elevationProfile: ElevationPoint[];
  totalDistanceKm: number;
  elevationGainM: number;
  elevationLossM?: number;
  title?: string;
  className?: string;
  showStats?: boolean;
}
```

Create `src/lib/map-config.ts`:
```typescript
import type { MarkerStyleTokens } from './types/map';

export const GOLFE_MAP_CONFIG = {
  defaultCenter: [-2.7800, 47.5850] as [number, number],
  defaultZoom: 10.5,
  minZoom: 9.0,
  maxZoom: 18.0,

  maxBounds: [
    [-3.3000, 47.2500], // Sud-Ouest
    [-2.3500, 47.8800], // Nord-Est
  ] as [[number, number], [number, number]],

  styles: {
    liberty: 'https://tiles.openfreemap.org/styles/liberty',
    bright: 'https://tiles.openfreemap.org/styles/bright',
    fallbackRaster: {
      version: 8 as const,
      sources: {
        'osm-tiles': {
          type: 'raster' as const,
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap Contributors',
        },
      },
      layers: [
        {
          id: 'osm-tiles-layer',
          type: 'raster' as const,
          source: 'osm-tiles',
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
  },
};

export const STATUS_STYLE_CONFIG: Record<string, MarkerStyleTokens> = {
  IDEAL: {
    badgeClass: 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-white',
    dotClass: 'bg-emerald-400',
    ringClass: 'ring-emerald-500',
  },
  WARNING: {
    badgeClass: 'bg-amber-500 text-white shadow-md shadow-amber-500/30 ring-2 ring-white',
    dotClass: 'bg-amber-300',
    ringClass: 'ring-amber-400',
  },
  DISCOURAGED: {
    badgeClass: 'bg-slate-400 text-slate-100 opacity-75 ring-1 ring-white/60',
    dotClass: 'bg-slate-300',
    ringClass: 'ring-slate-400',
  },
  SPONSORED: {
    badgeClass: 'bg-gradient-to-tr from-amber-500 to-yellow-400 text-amber-950 font-bold ring-2 ring-yellow-200 shadow-lg shadow-amber-400/40',
    dotClass: 'bg-amber-200',
    ringClass: 'ring-yellow-400',
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/map-config.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/types/map.ts src/lib/map-config.ts tests/map-config.test.ts
git commit -m "feat(bloc-4): install maplibre-gl and configure map settings and status styles"
```

---

### Task 2: Utilitaires Géodésiques, Boîte Englobante & Mise à l'Échelle SVG (`map-utils.ts`)

**Files:**
- Create: `src/lib/map-utils.ts`
- Test: `tests/map-utils.test.ts`

**Interfaces:**
- Consumes: Types `ElevationPoint`, `MapViewportBounds`, `MarkerStyleTokens`, `PlaceMarkerData` from `src/lib/types/map.ts`.
- Produces: Fonctions `calculateBoundingBox`, `findNearestElevationPoint`, `calculateElevationScales`, `estimateHikingDuration`, `isPointInBounds`, `getMarkerStyleTokens`.

- [ ] **Step 1: Write test for map utils**

Create `tests/map-utils.test.ts`:
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBoundingBox,
  findNearestElevationPoint,
  calculateElevationScales,
  estimateHikingDuration,
  isPointInBounds,
  getMarkerStyleTokens,
} from '../src/lib/map-utils';
import type { ElevationPoint, MapViewportBounds } from '../src/lib/types/map';

test('calculateBoundingBox computes correct [[minLon, minLat], [maxLon, maxLat]]', () => {
  const coords: [number, number][] = [
    [-2.80, 47.50],
    [-2.70, 47.60],
    [-2.85, 47.55],
  ];
  const bbox = calculateBoundingBox(coords);
  assert.deepEqual(bbox, [
    [-2.85, 47.50],
    [-2.70, 47.60],
  ]);

  // Fallback on empty coordinates
  const fallback = calculateBoundingBox([]);
  assert.equal(fallback.length, 2);
});

test('findNearestElevationPoint identifies closest point by distance', () => {
  const points: ElevationPoint[] = [
    { distanceKm: 0.0, elevationM: 5, lat: 47.5, lon: -2.8 },
    { distanceKm: 1.5, elevationM: 12, lat: 47.51, lon: -2.81 },
    { distanceKm: 3.0, elevationM: 8, lat: 47.52, lon: -2.82 },
  ];

  const closest = findNearestElevationPoint(points, 1.4);
  assert.equal(closest.distanceKm, 1.5);
  assert.equal(closest.elevationM, 12);
});

test('calculateElevationScales handles regular and flat profiles without zero division', () => {
  const points: ElevationPoint[] = [
    { distanceKm: 0.0, elevationM: 10, lat: 47.5, lon: -2.8 },
    { distanceKm: 5.0, elevationM: 30, lat: 47.55, lon: -2.85 },
  ];

  const scales = calculateElevationScales(points, 800, 160);
  assert.equal(scales.minElevation, 10);
  assert.equal(scales.maxElevation, 30);
  assert.ok(scales.pathLine.startsWith('M'));
  assert.ok(scales.pathArea.endsWith('Z'));

  // Test flat profile (min == max)
  const flatPoints: ElevationPoint[] = [
    { distanceKm: 0.0, elevationM: 5, lat: 47.5, lon: -2.8 },
    { distanceKm: 2.0, elevationM: 5, lat: 47.52, lon: -2.82 },
  ];
  const flatScales = calculateElevationScales(flatPoints, 800, 160);
  assert.ok(!Number.isNaN(flatScales.minElevation));
  assert.ok(!flatScales.pathLine.includes('NaN'));
});

test('estimateHikingDuration calculates duration accurately with FFRandonnee formula', () => {
  // 4 km at 0m D+ -> 1 hour
  const res1 = estimateHikingDuration(4, 0);
  assert.equal(res1.hours, 1);
  assert.equal(res1.minutes, 0);
  assert.equal(res1.formatted, '1h00');

  // 8 km at 300m D+ -> 2h + 1h = 3 hours
  const res2 = estimateHikingDuration(8, 300);
  assert.equal(res2.hours, 3);
  assert.equal(res2.minutes, 0);
  assert.equal(res2.formatted, '3h00');
});

test('isPointInBounds correctly checks coordinate inclusion', () => {
  const bounds: MapViewportBounds = {
    north: 47.7,
    south: 47.5,
    east: -2.7,
    west: -2.9,
  };
  assert.ok(isPointInBounds(47.6, -2.8, bounds));
  assert.ok(!isPointInBounds(47.8, -2.8, bounds));
  assert.ok(!isPointInBounds(47.6, -2.6, bounds));
});

test('getMarkerStyleTokens resolves sponsored and status styling', () => {
  const sponsored = getMarkerStyleTokens('IDEAL', true);
  assert.ok(sponsored.badgeClass.includes('yellow') || sponsored.badgeClass.includes('amber'));

  const normal = getMarkerStyleTokens('WARNING', false);
  assert.ok(normal.badgeClass.includes('amber'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/map-utils.test.ts`
Expected: FAIL (Cannot find module `../src/lib/map-utils`)

- [ ] **Step 3: Implement `src/lib/map-utils.ts`**

Create `src/lib/map-utils.ts`:
```typescript
import { GOLFE_MAP_CONFIG, STATUS_STYLE_CONFIG } from './map-config';
import type { ElevationPoint, MapViewportBounds, MarkerStyleTokens } from './types/map';
import type { EvaluationStatus } from './types/context';

export function calculateBoundingBox(coordinates: [number, number][]): [[number, number], [number, number]] {
  if (!coordinates || coordinates.length === 0) {
    return GOLFE_MAP_CONFIG.maxBounds;
  }

  let minLon = coordinates[0][0];
  let maxLon = coordinates[0][0];
  let minLat = coordinates[0][1];
  let maxLat = coordinates[0][1];

  for (let i = 1; i < coordinates.length; i++) {
    const [lon, lat] = coordinates[i];
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ];
}

export function findNearestElevationPoint(points: ElevationPoint[], targetDistanceKm: number): ElevationPoint {
  if (!points || points.length === 0) {
    return { distanceKm: 0, elevationM: 0, lat: 0, lon: 0 };
  }

  let nearest = points[0];
  let minDiff = Math.abs(points[0].distanceKm - targetDistanceKm);

  for (let i = 1; i < points.length; i++) {
    const diff = Math.abs(points[i].distanceKm - targetDistanceKm);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = points[i];
    }
  }

  return nearest;
}

export interface ElevationScalesResult {
  minElevation: number;
  maxElevation: number;
  totalDistanceKm: number;
  pathLine: string;
  pathArea: string;
  pointsCoordinates: Array<{ x: number; y: number; point: ElevationPoint }>;
}

export function calculateElevationScales(
  points: ElevationPoint[],
  svgWidth = 800,
  svgHeight = 160
): ElevationScalesResult {
  if (!points || points.length === 0) {
    return {
      minElevation: 0,
      maxElevation: 0,
      totalDistanceKm: 0,
      pathLine: `M 0 ${svgHeight} L ${svgWidth} ${svgHeight}`,
      pathArea: `M 0 ${svgHeight} L ${svgWidth} ${svgHeight} Z`,
      pointsCoordinates: [],
    };
  }

  let minEle = points[0].elevationM;
  let maxEle = points[0].elevationM;
  const maxDist = Math.max(0.1, points[points.length - 1].distanceKm);

  for (const pt of points) {
    if (pt.elevationM < minEle) minEle = pt.elevationM;
    if (pt.elevationM > maxEle) maxEle = pt.elevationM;
  }

  // Prevent divide by zero if profile is perfectly flat
  const eleSpan = Math.max(5, maxEle - minEle);
  const paddingTop = 20;
  const paddingBottom = 20;
  const usableHeight = svgHeight - paddingTop - paddingBottom;

  const pointsCoordinates = points.map((pt) => {
    const x = (pt.distanceKm / maxDist) * svgWidth;
    const normalizedY = (pt.elevationM - minEle) / eleSpan;
    const y = svgHeight - paddingBottom - normalizedY * usableHeight;
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)), point: pt };
  });

  const lineCommands = pointsCoordinates.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  const areaCommand = `${lineCommands} L ${svgWidth} ${svgHeight} L 0 ${svgHeight} Z`;

  return {
    minElevation: minEle,
    maxElevation: maxEle,
    totalDistanceKm: maxDist,
    pathLine: lineCommands,
    pathArea: areaCommand,
    pointsCoordinates,
  };
}

export function estimateHikingDuration(
  distanceKm: number,
  elevationGainM: number
): { hours: number; minutes: number; formatted: string } {
  // Norme FFRandonnée : 4 km/h à plat + 1h pour 300m D+
  const flatHours = distanceKm / 4.0;
  const elevationHours = Math.max(0, elevationGainM) / 300.0;
  const totalHoursDec = flatHours + elevationHours;

  const hours = Math.floor(totalHoursDec);
  const minutes = Math.round((totalHoursDec - hours) * 60);

  // Normalise 60 minutes
  const adjustedHours = minutes === 60 ? hours + 1 : hours;
  const adjustedMinutes = minutes === 60 ? 0 : minutes;

  const formatted = `${adjustedHours}h${adjustedMinutes.toString().padStart(2, '0')}`;
  return { hours: adjustedHours, minutes: adjustedMinutes, formatted };
}

export function isPointInBounds(lat: number, lon: number, bounds: MapViewportBounds): boolean {
  return lat >= bounds.south && lat <= bounds.north && lon >= bounds.west && lon <= bounds.east;
}

export function getMarkerStyleTokens(status: EvaluationStatus, isSponsored = false): MarkerStyleTokens {
  if (isSponsored) {
    return STATUS_STYLE_CONFIG.SPONSORED;
  }
  return STATUS_STYLE_CONFIG[status] || STATUS_STYLE_CONFIG.DISCOURAGED;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/map-utils.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/map-utils.ts tests/map-utils.test.ts
git commit -m "feat(bloc-4): implement bounding box, elevation scaling and hiking duration utilities"
```

---

### Task 3: Fabrique DOM des Marqueurs Contextuels Stylisés (`MapMarkers.ts`) & Contrôles Flottants (`MapControls.tsx`)

**Files:**
- Create: `src/components/map/MapMarkers.ts`
- Create: `src/components/map/MapControls.tsx`
- Test: `tests/map-markers.test.ts`

**Interfaces:**
- Consumes: `PlaceMarkerData`, `getMarkerStyleTokens` from `src/lib/types/map.ts` and `src/lib/map-utils.ts`.
- Produces: `createPlaceMarkerElement(place, isSelected, onClick)`, `MapControls` component.

- [ ] **Step 1: Write test for marker creation and controls rendering**

Create `tests/map-markers.test.ts`:
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { createMarkerDescriptor } from '../src/components/map/MapMarkers';
import { MapControls } from '../src/components/map/MapControls';
import type { PlaceMarkerData } from '../src/lib/types/map';

const samplePlace: PlaceMarkerData = {
  id: 'place-1',
  slug: 'plage-conleau',
  name: 'Plage de Conleau',
  latitude: 47.63,
  longitude: -2.77,
  category: 'BEACH',
  status: 'IDEAL',
  score: 85,
};

test('createMarkerDescriptor produces valid accessible attributes and styles', () => {
  const descriptor = createMarkerDescriptor(samplePlace, false);
  assert.equal(descriptor.role, 'button');
  assert.equal(descriptor.tabIndex, 0);
  assert.ok(descriptor.ariaLabel.includes('Plage de Conleau'));
  assert.ok(descriptor.ariaLabel.includes('Idéal'));
  assert.ok(descriptor.className.includes('bg-emerald-600'));

  // Test selected state
  const selectedDescriptor = createMarkerDescriptor(samplePlace, true);
  assert.ok(selectedDescriptor.className.includes('ring-sky-500'));
});

test('MapControls renders buttons with appropriate aria labels and Tailwind classes', () => {
  const html = renderToString(
    React.createElement(MapControls, {
      onZoomIn: () => {},
      onZoomOut: () => {},
      onResetCenter: () => {},
      onLocateUser: () => {},
      isLocating: false,
    })
  );

  assert.ok(html.includes('Zoom avant'));
  assert.ok(html.includes('Zoom arrière'));
  assert.ok(html.includes('Recentrer'));
  assert.ok(html.includes('Autour de moi'));
  assert.ok(html.includes('rounded-full'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/map-markers.test.ts`
Expected: FAIL (Cannot find module `../src/components/map/MapMarkers`)

- [ ] **Step 3: Implement `MapMarkers.ts` and `MapControls.tsx`**

Create `src/components/map/MapMarkers.ts`:
```typescript
import { getMarkerStyleTokens } from '@/lib/map-utils';
import type { PlaceMarkerData } from '@/lib/types/map';

export interface MarkerDescriptor {
  role: string;
  tabIndex: number;
  ariaLabel: string;
  className: string;
  title: string;
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'IDEAL':
      return 'Idéal aux marées actuelles';
    case 'WARNING':
      return 'Vigilance marée ou météo';
    case 'DISCOURAGED':
      return 'Déconseillé actuellement';
    case 'SPONSORED':
      return 'Recommandation partenaire';
    default:
      return status;
  }
}

export function createMarkerDescriptor(place: PlaceMarkerData, isSelected = false): MarkerDescriptor {
  const tokens = getMarkerStyleTokens(place.status, place.isSponsored);
  const statusLabel = getStatusLabel(place.isSponsored ? 'SPONSORED' : place.status);

  const baseClasses =
    'relative cursor-pointer transition-all duration-200 transform select-none rounded-full flex items-center justify-center p-2 focus:outline-none';
  const selectionClasses = isSelected
    ? 'scale-125 z-50 ring-4 ring-sky-500 shadow-xl'
    : 'hover:scale-110 shadow-md';

  const fullClasses = `${baseClasses} ${tokens.badgeClass} ${selectionClasses}`;

  return {
    role: 'button',
    tabIndex: 0,
    ariaLabel: `${place.name} — Statut : ${statusLabel}`,
    title: place.name,
    className: fullClasses,
  };
}

/**
 * Creates an actual DOM Element to pass into maplibregl.Marker({ element })
 */
export function createPlaceMarkerElement(
  place: PlaceMarkerData,
  isSelected: boolean,
  onClick: (place: PlaceMarkerData) => void
): HTMLDivElement {
  const descriptor = createMarkerDescriptor(place, isSelected);

  const el = document.createElement('div');
  el.className = descriptor.className;
  el.setAttribute('role', descriptor.role);
  el.setAttribute('tabindex', descriptor.tabIndex.toString());
  el.setAttribute('aria-label', descriptor.ariaLabel);
  el.title = descriptor.title;

  // Inner pin icon or dot
  const dot = document.createElement('span');
  dot.className = 'w-3 h-3 rounded-full bg-white shadow-sm block';
  el.appendChild(dot);

  const trigger = (e: Event) => {
    e.stopPropagation();
    onClick(place);
  };

  el.addEventListener('click', trigger);
  el.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      trigger(e);
    }
  });

  return el;
}
```

Create `src/components/map/MapControls.tsx`:
```typescript
'use client';

import React from 'react';
import { Plus, Minus, Compass, Navigation } from 'lucide-react';

export interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetCenter: () => void;
  onLocateUser?: () => void;
  isLocating?: boolean;
  className?: string;
}

export function MapControls({
  onZoomIn,
  onZoomOut,
  onResetCenter,
  onLocateUser,
  isLocating = false,
  className = '',
}: MapControlsProps) {
  return (
    <div
      className={`absolute right-4 bottom-8 flex flex-col gap-2 z-10 ${className}`}
      role="toolbar"
      aria-label="Contrôles de la carte"
    >
      {onLocateUser && (
        <button
          type="button"
          onClick={onLocateUser}
          disabled={isLocating}
          className="w-10 h-10 rounded-full bg-white/95 backdrop-blur-sm text-slate-700 shadow-md flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
          aria-label="Autour de moi"
          title="Autour de moi"
        >
          <Navigation className={`w-4 h-4 ${isLocating ? 'animate-spin text-sky-600' : ''}`} />
        </button>
      )}

      <button
        type="button"
        onClick={onResetCenter}
        className="w-10 h-10 rounded-full bg-white/95 backdrop-blur-sm text-slate-700 shadow-md flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-sky-500"
        aria-label="Recentrer sur le Golfe"
        title="Recentrer sur le Golfe"
      >
        <Compass className="w-5 h-5 text-slate-700" />
      </button>

      <div className="flex flex-col bg-white/95 backdrop-blur-sm rounded-full shadow-md overflow-hidden divide-y divide-slate-100">
        <button
          type="button"
          onClick={onZoomIn}
          className="w-10 h-10 text-slate-700 flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-sky-500"
          aria-label="Zoom avant"
          title="Zoom avant"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onZoomOut}
          className="w-10 h-10 text-slate-700 flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-sky-500"
          aria-label="Zoom arrière"
          title="Zoom arrière"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/map-markers.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/map/MapMarkers.ts src/components/map/MapControls.tsx tests/map-markers.test.ts
git commit -m "feat(bloc-4): implement dynamic context markers and floating map controls"
```

---

### Task 4: Profil Altimétrique SVG Interactif Réactif (`ElevationProfileSvg.tsx`)

**Files:**
- Create: `src/components/map/ElevationProfileSvg.tsx`
- Test: `tests/elevation-profile-svg.test.ts`

**Interfaces:**
- Consumes: `ElevationPoint`, `calculateElevationScales`, `findNearestElevationPoint` from `src/lib/types/map.ts` and `src/lib/map-utils.ts`.
- Produces: `ElevationProfileSvg` component with `onHoverPoint?: (point: ElevationPoint | null) => void`.

- [ ] **Step 1: Write test for SVG elevation profile**

Create `tests/elevation-profile-svg.test.ts`:
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { ElevationProfileSvg } from '../src/components/map/ElevationProfileSvg';
import type { ElevationPoint } from '../src/lib/types/map';

const sampleProfile: ElevationPoint[] = [
  { distanceKm: 0.0, elevationM: 5, lat: 47.58, lon: -2.78 },
  { distanceKm: 2.5, elevationM: 28, lat: 47.59, lon: -2.79 },
  { distanceKm: 5.0, elevationM: 12, lat: 47.60, lon: -2.80 },
];

test('ElevationProfileSvg renders valid SVG structure and header stats', () => {
  const html = renderToString(
    React.createElement(ElevationProfileSvg, {
      points: sampleProfile,
      totalDistanceKm: 5.0,
      elevationGainM: 35,
      showStats: true,
    })
  );

  // SVG structure
  assert.ok(html.includes('<svg'));
  assert.ok(html.includes('viewBox="0 0 800 160"'));
  assert.ok(html.includes('linearGradient'));
  assert.ok(html.includes('id="elevation-gradient"'));

  // Header metrics
  assert.ok(html.includes('5 km') || html.includes('5.0 km'));
  assert.ok(html.includes('+35 m') || html.includes('35 m'));
  assert.ok(html.includes('Alt. max'));
});

test('ElevationProfileSvg handles empty profile gracefully', () => {
  const html = renderToString(
    React.createElement(ElevationProfileSvg, {
      points: [],
      totalDistanceKm: 0,
      elevationGainM: 0,
    })
  );

  assert.ok(html.includes('<svg'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/elevation-profile-svg.test.ts`
Expected: FAIL (Cannot find module `../src/components/map/ElevationProfileSvg`)

- [ ] **Step 3: Implement `ElevationProfileSvg.tsx`**

Create `src/components/map/ElevationProfileSvg.tsx`:
```typescript
'use client';

import React, { useState, useRef, useCallback } from 'react';
import { calculateElevationScales, findNearestElevationPoint, estimateHikingDuration } from '@/lib/map-utils';
import type { ElevationPoint } from '@/lib/types/map';

export interface ElevationProfileSvgProps {
  points: ElevationPoint[];
  totalDistanceKm: number;
  elevationGainM: number;
  elevationLossM?: number;
  showStats?: boolean;
  onHoverPoint?: (point: ElevationPoint | null) => void;
  className?: string;
}

export function ElevationProfileSvg({
  points,
  totalDistanceKm,
  elevationGainM,
  showStats = true,
  onHoverPoint,
  className = '',
}: ElevationProfileSvgProps) {
  const [activePoint, setActivePoint] = useState<ElevationPoint | null>(null);
  const [activeX, setActiveX] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const svgWidth = 800;
  const svgHeight = 160;

  const scales = calculateElevationScales(points, svgWidth, svgHeight);
  const duration = estimateHikingDuration(totalDistanceKm, elevationGainM);

  const handlePointer = useCallback(
    (clientX: number) => {
      if (!svgRef.current || points.length === 0) return;
      const rect = svgRef.current.getBoundingClientRect();
      const relativeX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const targetDist = relativeX * scales.totalDistanceKm;
      const nearest = findNearestElevationPoint(points, targetDist);

      setActivePoint(nearest);
      setActiveX(relativeX * svgWidth);
      if (onHoverPoint) {
        onHoverPoint(nearest);
      }
    },
    [points, scales.totalDistanceKm, onHoverPoint]
  );

  const handlePointerLeave = useCallback(() => {
    setActivePoint(null);
    setActiveX(null);
    if (onHoverPoint) {
      onHoverPoint(null);
    }
  }, [onHoverPoint]);

  return (
    <div className={`flex flex-col bg-white rounded-xl p-4 shadow-sm border border-slate-100 ${className}`}>
      {showStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pb-3 mb-2 border-b border-slate-100 text-xs">
          <div>
            <span className="text-slate-400 block font-medium">Distance</span>
            <span className="text-slate-900 font-bold text-sm">{totalDistanceKm.toFixed(1)} km</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Dénivelé D+</span>
            <span className="text-emerald-600 font-bold text-sm">+{elevationGainM} m</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Alt. max</span>
            <span className="text-slate-900 font-bold text-sm">{scales.maxElevation} m</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Temps estimé</span>
            <span className="text-sky-600 font-bold text-sm">{duration.formatted}</span>
          </div>
        </div>
      )}

      <div className="relative w-full overflow-hidden select-none">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto cursor-crosshair touch-none"
          onPointerMove={(e) => handlePointer(e.clientX)}
          onPointerLeave={handlePointerLeave}
          onTouchMove={(e) => {
            if (e.touches[0]) handlePointer(e.touches[0].clientX);
          }}
          onTouchEnd={handlePointerLeave}
        >
          <defs>
            <linearGradient id="elevation-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          <path d={scales.pathArea} fill="url(#elevation-gradient)" />

          {/* Ridge line */}
          <path d={scales.pathLine} fill="none" stroke="#0284c7" strokeWidth="2.5" strokeLinecap="round" />

          {/* Active scrubbing cursor */}
          {activeX !== null && activePoint && (
            <g>
              <line
                x1={activeX}
                y1={10}
                x2={activeX}
                y2={svgHeight - 10}
                stroke="#0369a1"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
              <circle
                cx={activeX}
                cy={
                  svgHeight -
                  20 -
                  ((activePoint.elevationM - scales.minElevation) /
                    Math.max(5, scales.maxElevation - scales.minElevation)) *
                    (svgHeight - 40)
                }
                r="4.5"
                fill="#0284c7"
                stroke="#ffffff"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>

        {/* Hover info tooltip */}
        {activePoint && activeX !== null && (
          <div
            className="absolute top-1 pointer-events-none transform -translate-x-1/2 bg-slate-900/90 backdrop-blur-sm text-white px-2 py-1 rounded text-[11px] shadow-md whitespace-nowrap"
            style={{ left: `${(activeX / svgWidth) * 100}%` }}
          >
            km {activePoint.distanceKm.toFixed(1)} • {activePoint.elevationM} m
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/elevation-profile-svg.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/map/ElevationProfileSvg.tsx tests/elevation-profile-svg.test.ts
git commit -m "feat(bloc-4): implement interactive SVG elevation profile with scrubbing"
```

---

### Task 5: Composants Cartographiques WebGL (`GolfeMap.tsx` & `GpxTrackViewer.tsx`)

**Files:**
- Create: `src/components/map/GolfeMap.tsx`
- Create: `src/components/map/GpxTrackViewer.tsx`
- Test: `tests/map-components.test.ts`

**Interfaces:**
- Consumes: `maplibre-gl`, `GOLFE_MAP_CONFIG`, `MapControls`, `createPlaceMarkerElement`, `ElevationProfileSvg`.
- Produces: `GolfeMap`, `GpxTrackViewer` React client components.

- [ ] **Step 1: Write test for Map components isolation and props validation**

Create `tests/map-components.test.ts`:
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { GolfeMap } from '../src/components/map/GolfeMap';
import { GpxTrackViewer } from '../src/components/map/GpxTrackViewer';
import type { PlaceMarkerData, ElevationPoint } from '../src/lib/types/map';

const samplePlaces: PlaceMarkerData[] = [
  {
    id: 'place-1',
    slug: 'port-navalo',
    name: 'Port Navalo',
    latitude: 47.55,
    longitude: -2.91,
    category: 'PORT',
    status: 'IDEAL',
  },
];

const sampleGeojson: GeoJSON.Feature<GeoJSON.LineString> = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'LineString',
    coordinates: [
      [-2.78, 47.58],
      [-2.79, 47.59],
    ],
  },
};

const sampleProfile: ElevationPoint[] = [
  { distanceKm: 0.0, elevationM: 5, lat: 47.58, lon: -2.78 },
  { distanceKm: 1.5, elevationM: 15, lat: 47.59, lon: -2.79 },
];

test('GolfeMap renders container div with appropriate aria role and class', () => {
  const html = renderToString(
    React.createElement(GolfeMap, {
      places: samplePlaces,
      className: 'h-96 w-full',
    })
  );

  assert.ok(html.includes('<div'));
  assert.ok(html.includes('role="region"'));
  assert.ok(html.includes('aria-label="Carte interactive'));
});

test('GpxTrackViewer renders map container and elevation profile section', () => {
  const html = renderToString(
    React.createElement(GpxTrackViewer, {
      geojson: sampleGeojson,
      elevationProfile: sampleProfile,
      totalDistanceKm: 1.5,
      elevationGainM: 10,
    })
  );

  assert.ok(html.includes('<div'));
  assert.ok(html.includes('<svg'));
  assert.ok(html.includes('1.5 km'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/map-components.test.ts`
Expected: FAIL (Cannot find module `../src/components/map/GolfeMap`)

- [ ] **Step 3: Implement `GolfeMap.tsx` and `GpxTrackViewer.tsx`**

Create `src/components/map/GolfeMap.tsx`:
```typescript
'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { GOLFE_MAP_CONFIG } from '@/lib/map-config';
import { isPointInBounds } from '@/lib/map-utils';
import { createPlaceMarkerElement } from './MapMarkers';
import { MapControls } from './MapControls';
import type { GolfeMapProps, PlaceMarkerData, MapViewportBounds } from '@/lib/types/map';

export function GolfeMap({
  places = [],
  selectedPlaceId = null,
  onSelectPlace,
  onBoundsChange,
  initialCenter = GOLFE_MAP_CONFIG.defaultCenter,
  initialZoom = GOLFE_MAP_CONFIG.defaultZoom,
  interactive = true,
  className = 'w-full h-full min-h-[400px]',
  showControls = true,
  enableUserLocation = true,
}: GolfeMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: GOLFE_MAP_CONFIG.styles.liberty,
      center: initialCenter,
      zoom: initialZoom,
      minZoom: GOLFE_MAP_CONFIG.minZoom,
      maxZoom: GOLFE_MAP_CONFIG.maxZoom,
      maxBounds: GOLFE_MAP_CONFIG.maxBounds,
      interactive,
      attributionControl: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

    map.on('error', (e) => {
      // Fallback raster if vector style fails
      if (e.error && !map.isStyleLoaded()) {
        try {
          map.setStyle(GOLFE_MAP_CONFIG.styles.fallbackRaster);
        } catch {
          // ignore fallback errors
        }
      }
    });

    // Notify bounds on move / zoom
    const handleMoveEnd = () => {
      if (!onBoundsChange) return;
      const b = map.getBounds();
      const bounds: MapViewportBounds = {
        north: b.getNorth(),
        south: b.getSouth(),
        east: b.getEast(),
        west: b.getWest(),
      };
      const placesInView = places.filter((p) => isPointInBounds(p.latitude, p.longitude, bounds));
      onBoundsChange(placesInView, bounds);
    };

    map.on('moveend', handleMoveEnd);
    mapInstanceRef.current = map;

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
      }
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [initialCenter, initialZoom, interactive, onBoundsChange, places]);

  // Update markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old markers not in new places
    const newPlaceIds = new Set(places.map((p) => p.id));
    markersRef.current.forEach((marker, id) => {
      if (!newPlaceIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // Add or update markers
    places.forEach((place) => {
      const isSelected = place.id === selectedPlaceId;
      const existing = markersRef.current.get(place.id);
      if (existing) {
        existing.remove();
      }

      const el = createPlaceMarkerElement(place, isSelected, (clickedPlace) => {
        if (onSelectPlace) onSelectPlace(clickedPlace);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([place.longitude, place.latitude])
        .addTo(map);

      markersRef.current.set(place.id, marker);
    });
  }, [places, selectedPlaceId, onSelectPlace]);

  // Controls Handlers
  const handleZoomIn = useCallback(() => {
    mapInstanceRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    mapInstanceRef.current?.zoomOut();
  }, []);

  const handleResetCenter = useCallback(() => {
    mapInstanceRef.current?.flyTo({
      center: GOLFE_MAP_CONFIG.defaultCenter,
      zoom: GOLFE_MAP_CONFIG.defaultZoom,
      essential: true,
    });
  }, []);

  const handleLocateUser = useCallback(() => {
    if (!navigator.geolocation || !mapInstanceRef.current) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const map = mapInstanceRef.current;
        if (!map) return;
        const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];

        if (!userMarkerRef.current) {
          const el = document.createElement('div');
          el.className = 'w-4 h-4 bg-sky-500 rounded-full ring-4 ring-white shadow-lg animate-pulse';
          userMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat(coords).addTo(map);
        } else {
          userMarkerRef.current.setLngLat(coords);
        }

        map.flyTo({ center: coords, zoom: 13, essential: true });
      },
      () => {
        setIsLocating(false);
      },
      { timeout: 8000 }
    );
  }, []);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl ${className}`}
      role="region"
      aria-label="Carte interactive du Golfe du Morbihan"
    >
      <div ref={mapContainerRef} className="w-full h-full" />
      {showControls && (
        <MapControls
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetCenter={handleResetCenter}
          onLocateUser={enableUserLocation ? handleLocateUser : undefined}
          isLocating={isLocating}
        />
      )}
    </div>
  );
}
```

Create `src/components/map/GpxTrackViewer.tsx`:
```typescript
'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { GOLFE_MAP_CONFIG } from '@/lib/map-config';
import { calculateBoundingBox } from '@/lib/map-utils';
import { ElevationProfileSvg } from './ElevationProfileSvg';
import type { GpxTrackViewerProps, ElevationPoint } from '@/lib/types/map';

export function GpxTrackViewer({
  geojson,
  elevationProfile,
  totalDistanceKm,
  elevationGainM,
  elevationLossM = 0,
  title,
  className = '',
  showStats = true,
}: GpxTrackViewerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const trackPinMarkerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const coords = (geojson.geometry.coordinates as [number, number][]) || [];
    const bbox = calculateBoundingBox(coords);

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: GOLFE_MAP_CONFIG.styles.liberty,
      center: coords[0] || GOLFE_MAP_CONFIG.defaultCenter,
      zoom: 11,
      attributionControl: false,
    });

    map.on('load', () => {
      // Add track GeoJSON
      map.addSource('gpx-track', {
        type: 'geojson',
        data: geojson,
      });

      // Halo layer for legibility
      map.addLayer({
        id: 'gpx-track-casing',
        type: 'line',
        source: 'gpx-track',
        paint: {
          'line-color': '#ffffff',
          'line-width': 7,
          'line-opacity': 0.85,
        },
      });

      // Main line layer
      map.addLayer({
        id: 'gpx-track-line',
        type: 'line',
        source: 'gpx-track',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#0284c7',
          'line-width': 4,
        },
      });

      // Fit bounds
      if (coords.length > 0) {
        map.fitBounds(bbox, {
          padding: { top: 30, bottom: 30, left: 30, right: 30 },
          maxZoom: 15,
        });
      }

      // Start & Finish markers
      if (coords.length >= 2) {
        const startEl = document.createElement('div');
        startEl.className =
          'w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center ring-2 ring-white shadow-md';
        startEl.textContent = 'D';
        new maplibregl.Marker({ element: startEl }).setLngLat(coords[0]).addTo(map);

        const endEl = document.createElement('div');
        endEl.className =
          'w-6 h-6 rounded-full bg-rose-600 text-white font-bold text-xs flex items-center justify-center ring-2 ring-white shadow-md';
        endEl.textContent = 'A';
        new maplibregl.Marker({ element: endEl }).setLngLat(coords[coords.length - 1]).addTo(map);
      }

      // Synchronized scrubbing marker
      const pinEl = document.createElement('div');
      pinEl.className =
        'w-4 h-4 rounded-full bg-sky-500 ring-2 ring-white shadow-lg pointer-events-none transition-opacity duration-150';
      pinEl.style.opacity = '0';
      const marker = new maplibregl.Marker({ element: pinEl })
        .setLngLat(coords[0] || [0, 0])
        .addTo(map);
      trackPinMarkerRef.current = marker;
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [geojson]);

  const handleHoverPoint = useCallback((point: ElevationPoint | null) => {
    const marker = trackPinMarkerRef.current;
    if (!marker) return;

    const el = marker.getElement();
    if (!point) {
      el.style.opacity = '0';
    } else {
      marker.setLngLat([point.lon, point.lat]);
      el.style.opacity = '1';
    }
  }, []);

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {title && <h3 className="font-semibold text-slate-900 text-base">{title}</h3>}
      <div className="relative w-full h-72 sm:h-80 rounded-2xl overflow-hidden shadow-sm border border-slate-100">
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>
      <ElevationProfileSvg
        points={elevationProfile}
        totalDistanceKm={totalDistanceKm}
        elevationGainM={elevationGainM}
        elevationLossM={elevationLossM}
        showStats={showStats}
        onHoverPoint={handleHoverPoint}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/map-components.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/map/GolfeMap.tsx src/components/map/GpxTrackViewer.tsx tests/map-components.test.ts
git commit -m "feat(bloc-4): implement WebGL GolfeMap and synchronized GpxTrackViewer components"
```

---

### Task 6: Wrappers SSR Sécurisés (`DynamicMapWrappers.tsx`, `MapSkeleton.tsx`) & Index

**Files:**
- Create: `src/components/map/MapSkeleton.tsx`
- Create: `src/components/map/DynamicMapWrappers.tsx`
- Create: `src/components/map/index.ts`
- Test: `tests/dynamic-wrappers.test.ts`

**Interfaces:**
- Consumes: `GolfeMap`, `GpxTrackViewer`.
- Produces: `MapSkeleton`, `DynamicGolfeMap`, `DynamicGpxTrackViewer`, unified barrel export `src/components/map/index.ts`.

- [ ] **Step 1: Write test for Skeleton and Wrappers SSR safety**

Create `tests/dynamic-wrappers.test.ts`:
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { MapSkeleton } from '../src/components/map/MapSkeleton';

test('MapSkeleton renders server-side without window dependency', () => {
  const html = renderToString(
    React.createElement(MapSkeleton, {
      message: 'Chargement du Golfe...',
      height: 'h-64',
    })
  );

  assert.ok(html.includes('Chargement du Golfe...'));
  assert.ok(html.includes('animate-pulse'));
  assert.ok(html.includes('bg-slate-100'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/dynamic-wrappers.test.ts`
Expected: FAIL (Cannot find module `../src/components/map/MapSkeleton`)

- [ ] **Step 3: Implement `MapSkeleton.tsx`, `DynamicMapWrappers.tsx`, and `index.ts`**

Create `src/components/map/MapSkeleton.tsx`:
```typescript
import React from 'react';
import { MapPin } from 'lucide-react';

export interface MapSkeletonProps {
  message?: string;
  height?: string;
  className?: string;
}

export function MapSkeleton({
  message = 'Chargement de la carte interactive...',
  height = 'h-96 min-h-[350px]',
  className = '',
}: MapSkeletonProps) {
  return (
    <div
      className={`w-full ${height} bg-slate-100 rounded-2xl animate-pulse flex flex-col items-center justify-center text-slate-400 gap-3 border border-slate-200/60 ${className}`}
      role="status"
      aria-label={message}
    >
      <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-400">
        <MapPin className="w-6 h-6 animate-bounce" />
      </div>
      <p className="text-xs font-medium text-slate-500 tracking-wide">{message}</p>
    </div>
  );
}
```

Create `src/components/map/DynamicMapWrappers.tsx`:
```typescript
'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import { MapSkeleton } from './MapSkeleton';
import type { GolfeMapProps, GpxTrackViewerProps } from '@/lib/types/map';

export const DynamicGolfeMap = dynamic<GolfeMapProps>(
  () => import('./GolfeMap').then((mod) => mod.GolfeMap),
  {
    ssr: false,
    loading: () => <MapSkeleton message="Chargement de la carte interactive..." />,
  }
);

export const DynamicGpxTrackViewer = dynamic<GpxTrackViewerProps>(
  () => import('./GpxTrackViewer').then((mod) => mod.GpxTrackViewer),
  {
    ssr: false,
    loading: () => <MapSkeleton message="Chargement du tracé de randonnée..." height="h-80" />,
  }
);
```

Create `src/components/map/index.ts`:
```typescript
export * from './GolfeMap';
export * from './GpxTrackViewer';
export * from './ElevationProfileSvg';
export * from './MapControls';
export * from './MapMarkers';
export * from './MapSkeleton';
export * from './DynamicMapWrappers';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/dynamic-wrappers.test.ts`
Expected: PASS

- [ ] **Step 5: Run full test suite and verify build**

Run:
```bash
npm test
npm run build
```
Expected: All tests pass and Next.js standalone build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/map/MapSkeleton.tsx src/components/map/DynamicMapWrappers.tsx src/components/map/index.ts tests/dynamic-wrappers.test.ts
git commit -m "feat(bloc-4): implement SSR dynamic wrappers and skeleton loading states"
```
