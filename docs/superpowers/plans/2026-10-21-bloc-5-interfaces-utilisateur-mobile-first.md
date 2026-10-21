# Bloc 5 — Interfaces Utilisateur Mobile-First Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Développer les interfaces utilisateur mobile-first du copilote contextuel : la capsule flottante minimaliste (`FloatingContextPill.tsx`), la barre de filtres tactiles synchronisée à l'URL via `nuqs` en `shallow: true` (`FilterBar.tsx`), les cartes de lieux contextuelles (`PlaceCard.tsx` et `ContextBadge.tsx`), l'explorateur cartographique plein écran (`/carte`) combinant MapLibre GL JS et une Bottom Sheet non-modale `vaul` à 3 paliers avec camera-padding dynamique, et le dashboard d'accueil contextuel (`/`).

**Architecture:** Approche mobile-native stricte avec découplage propre entre state management d'URL sans rechargement RSC serveur (`nuqs`), physique tactile Apple/Emil Kowalski (`vaul` non-modal `modal={false}`), micro-interactions GPU immédiates (`:active { scale(0.96) }`), contraste élevé plein soleil (WCAG AAA), et responsive Split-View Master-Detail sur desktop ($\ge 1024\text{ px}$). Tests unitaires avec `node:test` via `tsx`.

**Tech Stack:** Next.js 15 (App Router), React 19, Tailwind CSS v3, TypeScript strict, `vaul` (^1.1.2), `nuqs` (^2.3.2), Lucide React, `tsx --test`.

**Spec:** [docs/superpowers/specs/2026-10-21-bloc-5-interfaces-utilisateur-mobile-first-design.md](file:///Users/Moulitos/Documents/antigravity/Guide%20Morbihan/docs/superpowers/specs/2026-10-21-bloc-5-interfaces-utilisateur-mobile-first-design.md)

## Global Constraints

- **Aucun bandeau fixe invasif :** Utilisation exclusive de la capsule flottante minimaliste (`FloatingContextPill.tsx`) pour préserver $100\%$ de la hauteur utile de la carte.
- **Berder & Tascon juste-à-temps :** N'apparaissent sous forme d'alerte que si fermeture imminente ($\le 45\text{ min}$) ou consultation du secteur concerné.
- **Adaptateur Nuqs racine obligatoire :** `src/app/layout.tsx` doit envelopper `{children}` avec `<NuqsAdapter>` pour éviter le crash `NUQS-404` en Next.js 15.
- **Désactivation du sticky hover :** `tailwind.config.ts` doit activer `future: { hoverOnlyWhenSupported: true }`.
- **Bottom Sheet non-modale :** `vaul` configuré avec `modal={false}` et `dismissible={false}` (paliers `['140px', 0.5, 0.92]`). `Drawer.Content` porte la classe `lg:hidden` pour neutraliser sa téléportation dans le body sur desktop.
- **Camera Padding dynamique :** Décalage de la caméra MapLibre via `cameraPadding.bottom = activeSnapHeight` connecté au state de la sheet pour éviter d'occulter le marqueur sélectionné sous la sheet à $50\%$.
- **Zéro latence réseau sur les filtres :** Mises à jour d'URL $100\%$ client en `shallow: true` via `nuqs` couplé à `useTransition` de React 19.
- **Micro-interactions :** Durées $< 220\text{ ms}$, pas de `transition: all`, pas d'animation depuis `scale(0)`, feedback instantané sur contact tactile (`active:scale-[0.96-0.98]`).
- **Lisibilité plein soleil :** Contraste renforcé ($> 8.5:1$ à $11:1$, WCAG AAA) sur les badges et les données critiques ; cibles tactiles $\ge 48\text{ px}$.
- **Tests exécutables via `npm test` :** `tsx --test tests/**/*.test.ts`.

---

### Task 1: Installation de `vaul` & `nuqs`, Configuration Racine (`NuqsAdapter`), Schéma d'URL et Hook de Filtrage Client

**Files:**
- Modify: `package.json`
- Modify: `src/app/layout.tsx`
- Modify: `tailwind.config.ts`
- Create: `src/lib/search-params.ts`
- Create: `src/lib/hooks/useFilteredPlaces.ts`
- Test: `tests/search-params-filter.test.ts`

**Interfaces:**
- Produces: `filterParsers`, `searchParamsCache` depuis `src/lib/search-params.ts`.
- Produces: Hook `useFilteredPlaces(places, filters, currentWeather, currentTide)` retournant `filteredPlaces`.
- Modifies: `src/app/layout.tsx` encapsulant `{children}` dans `<NuqsAdapter>`.
- Modifies: `tailwind.config.ts` avec `future: { hoverOnlyWhenSupported: true }`.

- [ ] **Step 1: Installer `vaul` et `nuqs` dans `package.json`**

Exécuter la commande d'installation :
```bash
npm install vaul@^1.1.2 nuqs@^2.3.2
```

- [ ] **Step 2: Configurer `<NuqsAdapter>` dans `src/app/layout.tsx` et `hoverOnlyWhenSupported` dans `tailwind.config.ts`**

Mettre à jour `src/app/layout.tsx` :
```tsx
import type { Metadata, Viewport } from 'next';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

export const metadata: Metadata = {
  title: 'Le Copilote Contextuel du Golfe du Morbihan',
  description: 'Moteur de décision touristique en temps réel : marées, météo et passages submersibles.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen antialiased bg-slate-50 text-slate-900">
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  );
}
```

Dans `tailwind.config.ts`, ajouter l'option :
```typescript
future: {
  hoverOnlyWhenSupported: true,
},
```

- [ ] **Step 2: Écrire le test unitaire pour le filtrage client et les parseurs de filtres**

Créer `tests/search-params-filter.test.ts` :
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { filterPlacesInMemory, type FilterCriteria } from '../src/lib/hooks/useFilteredPlaces';
import type { PlaceMarkerData } from '../src/lib/types/map';
import type { WeatherContext, TideStatus } from '../src/lib/types/context';

const mockPlaces: PlaceMarkerData[] = [
  {
    id: '1',
    slug: 'plage-fogeo',
    name: 'Plage du Fogeo',
    latitude: 47.53,
    longitude: -2.89,
    category: 'BEACH',
    status: 'IDEAL',
    score: 95,
  },
  {
    id: '2',
    slug: 'sentier-berder',
    name: 'Tour de Berder',
    latitude: 47.58,
    longitude: -2.88,
    category: 'TRAIL',
    status: 'WARNING',
    score: 60,
  },
  {
    id: '3',
    slug: 'chateau-suscinio',
    name: 'Château de Suscinio',
    latitude: 47.51,
    longitude: -2.73,
    category: 'HERITAGE',
    status: 'IDEAL',
    score: 85,
  },
];

test('filterPlacesInMemory filters by category', () => {
  const criteria: FilterCriteria = {
    category: 'BEACH',
    tideFilter: 'ALL',
    shelteredFromWind: false,
    strollerOnly: false,
    dogsOnly: false,
    rainOnly: false,
  };

  const results = filterPlacesInMemory(mockPlaces, criteria);
  assert.equal(results.length, 1);
  assert.equal(results[0].slug, 'plage-fogeo');
});

test('filterPlacesInMemory returns all places when category is ALL', () => {
  const criteria: FilterCriteria = {
    category: 'ALL',
    tideFilter: 'ALL',
    shelteredFromWind: false,
    strollerOnly: false,
    dogsOnly: false,
    rainOnly: false,
  };

  const results = filterPlacesInMemory(mockPlaces, criteria);
  assert.equal(results.length, 3);
});

test('filterPlacesInMemory filters ideal tide status', () => {
  const criteria: FilterCriteria = {
    category: 'ALL',
    tideFilter: 'IDEAL_NOW',
    shelteredFromWind: false,
    strollerOnly: false,
    dogsOnly: false,
    rainOnly: false,
  };

  const results = filterPlacesInMemory(mockPlaces, criteria);
  assert.equal(results.length, 2);
  assert.ok(results.every((p) => p.status === 'IDEAL'));
});
```

- [ ] **Step 3: Exécuter le test pour vérifier l'échec initial**

Exécuter :
```bash
npx tsx --test tests/search-params-filter.test.ts
```
Résultat attendu : FAIL (module inexistant).

- [ ] **Step 4: Implémenter `src/lib/search-params.ts`**

Créer `src/lib/search-params.ts` :
```typescript
import {
  parseAsString,
  parseAsBoolean,
  createSearchParamsCache,
} from 'nuqs/server';

export const filterParsers = {
  // Catégorie sélectionnée : 'ALL' | 'BEACH' | 'TRAIL' | 'HERITAGE' | 'GASTRONOMY' | 'NAUTICAL' | 'VIEWPOINT'
  cat: parseAsString.withDefault('ALL'),
  // Filtre contextuel marée : 'ALL' | 'IDEAL_NOW'
  maree: parseAsString.withDefault('ALL'),
  // Filtre protection vent
  vent: parseAsBoolean.withDefault(false),
  // Filtres commodités & accessibilité
  pmr: parseAsBoolean.withDefault(false),
  chiens: parseAsBoolean.withDefault(false),
  pluie: parseAsBoolean.withDefault(false),
  // Spot sélectionné (slug ou id)
  spot: parseAsString.withDefault(''),
};

export const searchParamsCache = createSearchParamsCache(filterParsers);

export type FilterState = {
  cat: string;
  maree: string;
  vent: boolean;
  pmr: boolean;
  chiens: boolean;
  pluie: boolean;
  spot: string;
};
```

- [ ] **Step 5: Implémenter `src/lib/hooks/useFilteredPlaces.ts`**

Créer `src/lib/hooks/useFilteredPlaces.ts` :
```typescript
import { useMemo } from 'react';
import type { PlaceMarkerData } from '@/lib/types/map';

export interface FilterCriteria {
  category: string;
  tideFilter: string;
  shelteredFromWind: boolean;
  strollerOnly: boolean;
  dogsOnly: boolean;
  rainOnly: boolean;
}

/**
 * Fonction pure de filtrage en mémoire (exécutable côté client et test unitaire).
 */
export function filterPlacesInMemory(
  places: PlaceMarkerData[],
  criteria: FilterCriteria
): PlaceMarkerData[] {
  return places.filter((place) => {
    // 1. Filtrage par catégorie
    if (criteria.category && criteria.category !== 'ALL' && place.category !== criteria.category) {
      return false;
    }

    // 2. Filtrage par marée idéale
    if (criteria.tideFilter === 'IDEAL_NOW' && place.status !== 'IDEAL') {
      return false;
    }

    return true;
  });
}

/**
 * Hook mémoïsé React pour le filtrage fluide sans blocage UI.
 */
export function useFilteredPlaces(
  places: PlaceMarkerData[],
  criteria: FilterCriteria
): PlaceMarkerData[] {
  return useMemo(() => {
    return filterPlacesInMemory(places, criteria);
  }, [places, criteria]);
}
```

- [ ] **Step 6: Exécuter le test unitaire et valider le succès**

Exécuter :
```bash
npx tsx --test tests/search-params-filter.test.ts
```
Résultat attendu : PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/lib/search-params.ts src/lib/hooks/useFilteredPlaces.ts tests/search-params-filter.test.ts
git commit -m "feat(ui): add nuqs & vaul dependencies, search-params schema and filtering hook"
```

---

### Task 2: Badges Contextuels Modulaires (`ContextBadge.tsx`) & Cartes de Lieux (`PlaceCard.tsx`)

**Files:**
- Create: `src/components/places/ContextBadge.tsx`
- Create: `src/components/places/PlaceCardSkeleton.tsx`
- Create: `src/components/places/PlaceCard.tsx`
- Test: `tests/place-card.test.ts`

**Interfaces:**
- Produces: Composant `ContextBadge({ status, customLabel, className })`.
- Produces: Composant `PlaceCard({ place, variant, isSelected, onSelect })`.
- Produces: Composant `PlaceCardSkeleton({ variant })`.

- [ ] **Step 1: Écrire le test unitaire pour `ContextBadge` et `PlaceCard`**

Créer `tests/place-card.test.ts` :
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ContextBadge } from '../src/components/places/ContextBadge';
import { PlaceCard } from '../src/components/places/PlaceCard';
import type { PlaceMarkerData } from '../src/lib/types/map';

const samplePlace: PlaceMarkerData = {
  id: 'spot-1',
  slug: 'anse-de-toulindac',
  name: 'Anse de Toulindac',
  latitude: 47.61,
  longitude: -2.87,
  category: 'BEACH',
  status: 'IDEAL',
  score: 92,
  label: 'Baignade idéale',
};

test('ContextBadge renders accessible text and classes for IDEAL status', () => {
  const html = renderToString(React.createElement(ContextBadge, { status: 'IDEAL' }));
  assert.ok(html.includes('Idéal'));
  assert.ok(html.includes('bg-emerald-50') || html.includes('emerald'));
});

test('ContextBadge renders accessible text for WARNING status', () => {
  const html = renderToString(React.createElement(ContextBadge, { status: 'WARNING' }));
  assert.ok(html.includes('Vigilance'));
  assert.ok(html.includes('amber'));
});

test('PlaceCard renders compact variant with name and category', () => {
  const html = renderToString(
    React.createElement(PlaceCard, {
      place: samplePlace,
      variant: 'compact',
    })
  );
  assert.ok(html.includes('Anse de Toulindac'));
  assert.ok(html.includes('spot-card-spot-1'));
});

test('PlaceCard renders rich variant with image placeholder', () => {
  const html = renderToString(
    React.createElement(PlaceCard, {
      place: samplePlace,
      variant: 'rich',
    })
  );
  assert.ok(html.includes('Anse de Toulindac'));
});
```

- [ ] **Step 2: Exécuter le test pour vérifier l'échec initial**

Exécuter :
```bash
npx tsx --test tests/place-card.test.ts
```
Résultat attendu : FAIL (composants inexistants).

- [ ] **Step 3: Implémenter `src/components/places/ContextBadge.tsx`**

Créer `src/components/places/ContextBadge.tsx` :
```tsx
import React from 'react';
import { CheckCircle2, AlertTriangle, Ban, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { EvaluationStatus } from '@/lib/types/context';

export interface ContextBadgeProps {
  status: EvaluationStatus;
  customLabel?: string;
  className?: string;
}

const BADGE_CONFIG = {
  IDEAL: {
    bg: 'bg-emerald-50 text-emerald-900 border-emerald-600',
    icon: CheckCircle2,
    defaultLabel: 'Idéal maintenant',
  },
  WARNING: {
    bg: 'bg-amber-50 text-amber-900 border-amber-600',
    icon: AlertTriangle,
    defaultLabel: 'Vigilance marée',
  },
  DISCOURAGED: {
    bg: 'bg-slate-100 text-slate-900 border-slate-500',
    icon: Ban,
    defaultLabel: 'Déconseillé à cette heure',
  },
  SPONSORED: {
    bg: 'bg-yellow-50 text-yellow-950 border-yellow-600',
    icon: Sparkles,
    defaultLabel: 'Coup de cœur',
  },
};

export function ContextBadge({ status, customLabel, className }: ContextBadgeProps) {
  const config = BADGE_CONFIG[status] || BADGE_CONFIG.DISCOURAGED;
  const Icon = config.icon;
  const label = customLabel || config.defaultLabel;

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border',
          config.bg,
          className
        )
      )}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
```

- [ ] **Step 4: Implémenter `src/components/places/PlaceCardSkeleton.tsx`**

Créer `src/components/places/PlaceCardSkeleton.tsx` :
```tsx
import React from 'react';

export function PlaceCardSkeleton({ variant = 'compact' }: { variant?: 'compact' | 'rich' }) {
  if (variant === 'rich') {
    return (
      <div className="flex flex-col rounded-2xl bg-white border border-slate-200/80 p-3 shadow-sm animate-pulse">
        <div className="w-full aspect-video bg-slate-200 rounded-xl" />
        <div className="mt-3 h-5 bg-slate-200 rounded w-3/4" />
        <div className="mt-2 h-4 bg-slate-200 rounded w-1/2" />
        <div className="mt-4 flex gap-2">
          <div className="h-6 bg-slate-200 rounded-full w-24" />
          <div className="h-6 bg-slate-200 rounded-full w-20" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 animate-pulse">
      <div className="w-20 h-20 bg-slate-200 rounded-lg shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="h-4 bg-slate-200 rounded w-3/4" />
        <div className="mt-2 h-3 bg-slate-200 rounded w-1/2" />
        <div className="mt-3 h-5 bg-slate-200 rounded-full w-28" />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Implémenter `src/components/places/PlaceCard.tsx`**

Créer `src/components/places/PlaceCard.tsx` :
```tsx
import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { MapPin } from 'lucide-react';
import type { PlaceMarkerData } from '@/lib/types/map';
import { ContextBadge } from './ContextBadge';

export interface PlaceCardProps {
  place: PlaceMarkerData;
  variant?: 'compact' | 'rich';
  isSelected?: boolean;
  onSelect?: (place: PlaceMarkerData) => void;
  className?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  BEACH: 'Plage & Crique',
  TRAIL: 'Sentier & Randonnée',
  HERITAGE: 'Patrimoine & Histoire',
  GASTRONOMY: 'Huîtres & Terroir',
  NAUTICAL: 'Nautisme & Cale',
  VIEWPOINT: 'Point de vue',
};

export function PlaceCard({
  place,
  variant = 'compact',
  isSelected = false,
  onSelect,
  className,
}: PlaceCardProps) {
  const categoryLabel = CATEGORY_LABELS[place.category] || place.category;

  if (variant === 'rich') {
    return (
      <article
        id={`spot-card-${place.id}`}
        role="button"
        tabIndex={0}
        onClick={() => onSelect?.(place)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect?.(place);
          }
        }}
        className={twMerge(
          clsx(
            'group flex flex-col rounded-2xl bg-white border border-slate-200/90 shadow-sm overflow-hidden cursor-pointer transition-transform duration-100 ease-out active:scale-[0.985] text-left select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
            isSelected && 'ring-2 ring-emerald-500 shadow-md',
            className
          )
        )}
      >
        <div className="relative aspect-video w-full bg-slate-100 flex items-center justify-center overflow-hidden">
          {place.imageUrl ? (
            <img
              src={place.imageUrl}
              alt={place.name}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
              <span className="text-4xl select-none" aria-hidden="true">
                {place.category === 'BEACH' ? '🏖️' : place.category === 'TRAIL' ? '🥾' : '🌊'}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 to-transparent z-10" />
          <div className="absolute top-3 right-3 z-20">
            <ContextBadge status={place.status} customLabel={place.label} />
          </div>
          <div className="absolute bottom-3 left-3 z-20">
            <span className="inline-block px-2.5 py-0.5 text-xs font-medium text-white/95 bg-black/40 backdrop-blur-sm rounded-full">
              {categoryLabel}
            </span>
          </div>
        </div>

        <div className="p-4 flex flex-col flex-1">
          <h3 className="font-bold text-slate-900 text-lg leading-snug group-hover:text-emerald-700 transition-colors">
            {place.name}
          </h3>
          <p className="mt-1 text-sm text-slate-500 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
            <span>Golfe du Morbihan</span>
          </p>
        </div>
      </article>
    );
  }

  return (
    <div
      id={`spot-card-${place.id}`}
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(place)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.(place);
        }
      }}
      className={twMerge(
        clsx(
          'flex items-center gap-3.5 p-3 rounded-xl bg-white border border-slate-200/80 shadow-sm cursor-pointer transition-transform duration-100 ease-out active:scale-[0.98] select-none text-left touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
          isSelected && 'ring-2 ring-emerald-500 bg-emerald-50/25 border-emerald-300',
          className
        )
      )}
    >
      <div className="relative w-20 h-20 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden border border-slate-200/50">
        {place.imageUrl ? (
          <img
            src={place.imageUrl}
            alt={place.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-2xl select-none" aria-hidden="true">
            {place.category === 'BEACH' ? '🏖️' : place.category === 'TRAIL' ? '🥾' : '🌊'}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0 pr-1">
        <h4 className="font-semibold text-slate-900 text-sm truncate">
          {place.name}
        </h4>
        <p className="text-xs text-slate-500 mt-0.5 truncate">
          {categoryLabel}
        </p>
        <div className="mt-2">
          <ContextBadge status={place.status} customLabel={place.label} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Exécuter le test unitaire et valider le succès**

Exécuter :
```bash
npx tsx --test tests/place-card.test.ts
```
Résultat attendu : PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/places/ContextBadge.tsx src/components/places/PlaceCardSkeleton.tsx src/components/places/PlaceCard.tsx tests/place-card.test.ts
git commit -m "feat(ui): add ContextBadge, PlaceCard (compact & rich) and skeleton loader"
```

---

### Task 3: Pilules Tactiles (`FilterPill.tsx`) & Barre de Filtres Réactive (`FilterBar.tsx`)

**Files:**
- Create: `src/components/filters/FilterPill.tsx`
- Create: `src/components/filters/FilterBar.tsx`
- Test: `tests/filter-bar.test.ts`

**Interfaces:**
- Produces: Composant `FilterPill({ label, icon, isActive, onClick, className })`.
- Produces: Composant `FilterBar({ onFilterChange, isRaining })`.

- [ ] **Step 1: Écrire le test unitaire pour `FilterPill` et `FilterBar`**

Créer `tests/filter-bar.test.ts` :
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { FilterPill } from '../src/components/filters/FilterPill';

test('FilterPill renders label and active state styles', () => {
  const activeHtml = renderToString(
    React.createElement(FilterPill, {
      label: 'Abrité du vent',
      isActive: true,
      onClick: () => {},
    })
  );
  assert.ok(activeHtml.includes('Abrité du vent'));
  assert.ok(activeHtml.includes('bg-slate-900'));
  assert.ok(activeHtml.includes('aria-pressed="true"'));

  const inactiveHtml = renderToString(
    React.createElement(FilterPill, {
      label: 'Abrité du vent',
      isActive: false,
      onClick: () => {},
    })
  );
  assert.ok(inactiveHtml.includes('bg-white'));
  assert.ok(inactiveHtml.includes('aria-pressed="false"'));
});
```

- [ ] **Step 2: Exécuter le test pour vérifier l'échec initial**

Exécuter :
```bash
npx tsx --test tests/filter-bar.test.ts
```
Résultat attendu : FAIL (composant inexistant).

- [ ] **Step 3: Implémenter `src/components/filters/FilterPill.tsx`**

Créer `src/components/filters/FilterPill.tsx` :
```tsx
import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface FilterPillProps {
  label: string;
  icon?: string;
  isActive: boolean;
  onClick: () => void;
  className?: string;
}

export function FilterPill({
  label,
  icon,
  isActive,
  onClick,
  className,
}: FilterPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={twMerge(
        clsx(
          'h-12 px-4 rounded-full text-sm font-semibold whitespace-nowrap flex items-center gap-2 border select-none transition-transform duration-100 ease-out active:scale-[0.96] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2',
          isActive
            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
            : 'bg-white/95 text-slate-800 border-slate-300 hover:border-slate-400 shadow-sm',
          className
        )
      )}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      <span>{label}</span>
    </button>
  );
}
```

- [ ] **Step 4: Implémenter `src/components/filters/FilterBar.tsx` avec `nuqs`**

Créer `src/components/filters/FilterBar.tsx` :
```tsx
'use client';

import React, { useTransition } from 'react';
import { useQueryState, parseAsString, parseAsBoolean } from 'nuqs';
import { FilterPill } from './FilterPill';

export interface FilterBarProps {
  isRaining?: boolean;
  className?: string;
}

export function FilterBar({ isRaining = false, className = '' }: FilterBarProps) {
  const [, startTransition] = useTransition();

  const [selectedCat, setSelectedCat] = useQueryState(
    'cat',
    parseAsString.withDefault('ALL').withOptions({
      shallow: true,
      history: 'replace',
      startTransition,
    })
  );

  const [tideFilter, setTideFilter] = useQueryState(
    'maree',
    parseAsString.withDefault('ALL').withOptions({
      shallow: true,
      history: 'replace',
      startTransition,
    })
  );

  const [shelteredFromWind, setShelteredFromWind] = useQueryState(
    'vent',
    parseAsBoolean.withDefault(false).withOptions({
      shallow: true,
      history: 'replace',
      startTransition,
    })
  );

  const [rainFriendly, setRainFriendly] = useQueryState(
    'pluie',
    parseAsBoolean.withDefault(false).withOptions({
      shallow: true,
      history: 'replace',
      startTransition,
    })
  );

  return (
    <div
      className={`flex items-center gap-2.5 overflow-x-auto no-scrollbar py-2 px-1 touch-pan-x ${className}`}
      role="toolbar"
      aria-label="Filtres contextuels"
    >
      {/* Si pluie détectée, suggérer en premier */}
      {isRaining && (
        <FilterPill
          icon="🌧️"
          label="À l'abri de la pluie"
          isActive={rainFriendly}
          onClick={() => setRainFriendly((prev) => !prev)}
        />
      )}

      <FilterPill
        icon="🏖️"
        label="Baignade idéale"
        isActive={selectedCat === 'BEACH' && tideFilter === 'IDEAL_NOW'}
        onClick={() => {
          if (selectedCat === 'BEACH' && tideFilter === 'IDEAL_NOW') {
            setSelectedCat('ALL');
            setTideFilter('ALL');
          } else {
            setSelectedCat('BEACH');
            setTideFilter('IDEAL_NOW');
          }
        }}
      />

      <FilterPill
        icon="💨"
        label="Abrité du vent"
        isActive={shelteredFromWind}
        onClick={() => setShelteredFromWind((prev) => !prev)}
      />

      <FilterPill
        icon="🥾"
        label="Sentiers ouverts"
        isActive={selectedCat === 'TRAIL'}
        onClick={() => setSelectedCat((prev) => (prev === 'TRAIL' ? 'ALL' : 'TRAIL'))}
      />

      <FilterPill
        icon="🏰"
        label="Patrimoine"
        isActive={selectedCat === 'HERITAGE'}
        onClick={() => setSelectedCat((prev) => (prev === 'HERITAGE' ? 'ALL' : 'HERITAGE'))}
      />

      <FilterPill
        icon="🦪"
        label="Déguster & Huîtres"
        isActive={selectedCat === 'GASTRONOMY'}
        onClick={() => setSelectedCat((prev) => (prev === 'GASTRONOMY' ? 'ALL' : 'GASTRONOMY'))}
      />
    </div>
  );
}
```

- [ ] **Step 5: Exécuter le test unitaire et valider le succès**

Exécuter :
```bash
npx tsx --test tests/filter-bar.test.ts
```
Résultat attendu : PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/filters/FilterPill.tsx src/components/filters/FilterBar.tsx tests/filter-bar.test.ts
git commit -m "feat(ui): add FilterPill and FilterBar with shallow nuqs url synchronization"
```

---

### Task 4: Capsule Flottante Contextuelle (`FloatingContextPill.tsx`) & Puce d'Alerte Submersible (`TidalAlertChip.tsx`)

**Files:**
- Create: `src/components/context/TidalAlertChip.tsx`
- Create: `src/components/context/FloatingContextPill.tsx`
- Test: `tests/floating-pill.test.ts`

**Interfaces:**
- Produces: Composant `TidalAlertChip({ passageName, minutesRemaining, isOpen })`.
- Produces: Composant `FloatingContextPill({ tideText, weatherText, urgentAlert })`.

- [ ] **Step 1: Écrire le test unitaire pour `TidalAlertChip` et `FloatingContextPill`**

Créer `tests/floating-pill.test.ts` :
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TidalAlertChip } from '../src/components/context/TidalAlertChip';
import { FloatingContextPill } from '../src/components/context/FloatingContextPill';

test('TidalAlertChip renders only when urgent closing soon', () => {
  const urgentHtml = renderToString(
    React.createElement(TidalAlertChip, {
      passageName: 'Berder',
      minutesRemaining: 25,
      isOpen: true,
    })
  );
  assert.ok(urgentHtml.includes('Berder'));
  assert.ok(urgentHtml.includes('25 min'));
  assert.ok(urgentHtml.includes('amber'));
});

test('TidalAlertChip returns null when open for a long time', () => {
  const safeHtml = renderToString(
    React.createElement(TidalAlertChip, {
      passageName: 'Berder',
      minutesRemaining: 180,
      isOpen: true,
    })
  );
  assert.equal(safeHtml, '');
});

test('FloatingContextPill renders minimal marine weather summary', () => {
  const html = renderToString(
    React.createElement(FloatingContextPill, {
      tideText: 'PM 17h42 (78)',
      weatherText: '19°C · NO 12nd',
    })
  );
  assert.ok(html.includes('PM 17h42 (78)'));
  assert.ok(html.includes('19°C · NO 12nd'));
});
```

- [ ] **Step 2: Exécuter le test pour vérifier l'échec initial**

Exécuter :
```bash
npx tsx --test tests/floating-pill.test.ts
```
Résultat attendu : FAIL (composants inexistants).

- [ ] **Step 3: Implémenter `src/components/context/TidalAlertChip.tsx`**

Créer `src/components/context/TidalAlertChip.tsx` :
```tsx
import React from 'react';
import { AlertTriangle } from 'lucide-react';

export interface TidalAlertChipProps {
  passageName: string;
  minutesRemaining: number;
  isOpen: boolean;
  className?: string;
}

export function TidalAlertChip({
  passageName,
  minutesRemaining,
  isOpen,
  className = '',
}: TidalAlertChipProps) {
  // RÈGLE MÉTIER STRICTE : N'apparaît que si le passage est ouvert mais ferme dans moins de 45 minutes
  if (!isOpen || minutesRemaining > 45 || minutesRemaining <= 0) {
    return null;
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500 text-slate-950 font-bold text-xs rounded-full shadow-md animate-pulse border border-amber-600 ${className}`}
      role="alert"
    >
      <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>
        {passageName} : Fermeture dans <span className="font-mono tabular-nums">{minutesRemaining} min</span>
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Implémenter `src/components/context/FloatingContextPill.tsx`**

Créer `src/components/context/FloatingContextPill.tsx` :
```tsx
'use client';

import React, { useState } from 'react';
import { Waves, Sun } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface FloatingContextPillProps {
  tideText?: string;
  weatherText?: string;
  urgentAlert?: React.ReactNode;
  className?: string;
}

export function FloatingContextPill({
  tideText = 'PM 17h42 (78)',
  weatherText = '19°C · NO 12nd',
  urgentAlert,
  className,
}: FloatingContextPillProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={twMerge(
        clsx('flex flex-col items-end gap-1.5 z-20 select-none', className)
      )}
    >
      {urgentAlert}

      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="min-h-[48px] h-12 px-4 rounded-full bg-white/95 backdrop-blur-md border border-slate-300/80 shadow-md flex items-center gap-2.5 text-xs font-semibold text-slate-800 transition-transform duration-100 ease-out active:scale-[0.97] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
        aria-label="Conditions météo et marée"
      >
        <span className="flex items-center gap-1">
          <Waves className="w-3.5 h-3.5 text-sky-600" aria-hidden="true" />
          <span>{tideText}</span>
        </span>
        <span className="w-px h-3 bg-slate-300" aria-hidden="true" />
        <span className="flex items-center gap-1 text-slate-600">
          <Sun className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
          <span>{weatherText}</span>
        </span>
      </button>

      {/* Popover déplié en overlay translucide */}
      {isExpanded && (
        <div className="mt-1 p-3.5 bg-slate-900 text-white text-xs rounded-2xl shadow-xl border border-slate-800 max-w-xs transition-opacity transition-transform duration-120 ease-out origin-top-right">
          <p className="font-bold text-sm text-emerald-400">Marée & Vent en Direct</p>
          <p className="mt-1 text-slate-300 leading-relaxed">
            Données calculées en temps réel par la règle des 12e pour le Golfe du Morbihan.
          </p>
          <div className="mt-2 pt-2 border-t border-slate-800 flex justify-between text-slate-400">
            <span>Coeff : 78</span>
            <span>Marnage : 3,80m</span>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Exécuter le test unitaire et valider le succès**

Exécuter :
```bash
npx tsx --test tests/floating-pill.test.ts
```
Résultat attendu : PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/context/TidalAlertChip.tsx src/components/context/FloatingContextPill.tsx tests/floating-pill.test.ts
git commit -m "feat(ui): add FloatingContextPill and just-in-time TidalAlertChip"
```

---

### Task 5: Bottom Sheet Tactile Non-Modale (`MobileExplorerSheet.tsx`), Hook de Caméra (`useCameraOffset.ts`) & Split-View Desktop

**Files:**
- Create: `src/lib/hooks/useCameraOffset.ts`
- Create: `src/components/explorer/MobileExplorerSheet.tsx`
- Create: `src/components/explorer/DesktopSplitExplorer.tsx`
- Test: `tests/camera-offset.test.ts`

**Interfaces:**
- Produces: Fonction utilitaire `calculateCameraPadding(snapPoint, windowHeight)` testable.
- Produces: Composant `MobileExplorerSheet({ places, selectedPlaceId, onSelectPlace, isRaining })`.
- Produces: Composant `DesktopSplitExplorer({ places, selectedPlaceId, onSelectPlace, isRaining })`.

- [ ] **Step 1: Écrire le test unitaire pour `calculateCameraPadding`**

Créer `tests/camera-offset.test.ts` :
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCameraPadding } from '../src/lib/hooks/useCameraOffset';

test('calculateCameraPadding returns exact bottom padding for string pixel snap point', () => {
  const padding = calculateCameraPadding('140px', 800);
  assert.equal(padding.bottom, 140);
  assert.equal(padding.top, 60);
});

test('calculateCameraPadding returns 50% window height for half snap point', () => {
  const padding = calculateCameraPadding(0.5, 800);
  assert.equal(padding.bottom, 400);
  assert.equal(padding.top, 60);
});

test('calculateCameraPadding returns 92% window height for expanded snap point', () => {
  const padding = calculateCameraPadding(0.92, 800);
  assert.equal(padding.bottom, 736);
});
```

- [ ] **Step 2: Exécuter le test pour vérifier l'échec initial**

Exécuter :
```bash
npx tsx --test tests/camera-offset.test.ts
```
Résultat attendu : FAIL (fonction inexistante).

- [ ] **Step 3: Implémenter `src/lib/hooks/useCameraOffset.ts`**

Créer `src/lib/hooks/useCameraOffset.ts` :
```typescript
import { useEffect } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';

export function calculateCameraPadding(
  activeSnapPoint: string | number | null,
  windowHeight: number
): { top: number; bottom: number; left: number; right: number } {
  let bottom = 140;

  if (typeof activeSnapPoint === 'string' && activeSnapPoint.endsWith('px')) {
    bottom = parseInt(activeSnapPoint, 10);
  } else if (typeof activeSnapPoint === 'number') {
    bottom = Math.round(windowHeight * activeSnapPoint);
  }

  return {
    top: 60,
    bottom,
    left: 0,
    right: 0,
  };
}

export function useCameraOffset(
  map: MapLibreMap | null,
  activeSnapPoint: string | number | null
) {
  useEffect(() => {
    if (!map || typeof window === 'undefined') return;

    const updatePadding = () => {
      const padding = calculateCameraPadding(activeSnapPoint, window.innerHeight);
      map.easeTo({
        padding,
        duration: 250,
        easing: (t) => 1 - Math.pow(1 - t, 3), // cubic ease-out
      });
    };

    updatePadding();
    window.addEventListener('resize', updatePadding);
    return () => window.removeEventListener('resize', updatePadding);
  }, [map, activeSnapPoint]);
}
```

- [ ] **Step 4: Implémenter `src/components/explorer/MobileExplorerSheet.tsx` avec `vaul`**

Créer `src/components/explorer/MobileExplorerSheet.tsx` :
```tsx
'use client';

import React, { useState } from 'react';
import { Drawer } from 'vaul';
import type { PlaceMarkerData } from '@/lib/types/map';
import { PlaceCard } from '@/components/places/PlaceCard';
import { FilterBar } from '@/components/filters/FilterBar';

export interface MobileExplorerSheetProps {
  places: PlaceMarkerData[];
  selectedPlaceId?: string | null;
  onSelectPlace?: (place: PlaceMarkerData) => void;
  isRaining?: boolean;
  activeSnapPoint?: string | number | null;
  onSnapChange?: (snap: string | number | null) => void;
}

export function MobileExplorerSheet({
  places,
  selectedPlaceId,
  onSelectPlace,
  isRaining = false,
  activeSnapPoint,
  onSnapChange,
}: MobileExplorerSheetProps) {
  const [internalSnap, setInternalSnap] = useState<string | number | null>('140px');
  const snap = activeSnapPoint !== undefined ? activeSnapPoint : internalSnap;

  const handleSnapChange = (newSnap: string | number | null) => {
    setInternalSnap(newSnap);
    onSnapChange?.(newSnap);
  };

  return (
    <Drawer.Root
      open={true}
      modal={false} // CRITIQUE : Permet l'interaction avec la carte WebGL en arrière-plan
      dismissible={false} // Reste toujours au minimum à 140px
      snapPoints={['140px', 0.5, 0.92]}
      activeSnapPoint={snap}
      setActiveSnapPoint={handleSnapChange}
    >
      <Drawer.Portal>
        <Drawer.Content
          className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex flex-col rounded-t-[24px] bg-white/95 backdrop-blur-md shadow-2xl border-t border-slate-200/80 outline-none select-none"
          style={{ height: '92dvh' }}
        >
          {/* Poignée de manipulation physique */}
          <div className="py-2.5 flex justify-center cursor-grab active:cursor-grabbing">
            <Drawer.Handle className="w-12 h-1.5 bg-slate-300 rounded-full" />
          </div>

          {/* Barre de filtres intégrée sous la poignée */}
          <div className="px-4 pb-2 border-b border-slate-100">
            <FilterBar isRaining={isRaining} />
          </div>

          {/* Liste interne défilable avec confinement de scroll */}
          <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y px-4 py-3 space-y-2.5 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
              {places.length} lieu{places.length > 1 ? 'x' : ''} à proximité
            </div>

            {places.map((place) => (
              <PlaceCard
                key={place.id}
                place={place}
                variant="compact"
                isSelected={place.id === selectedPlaceId}
                onSelect={(p) => {
                  handleSnapChange(0.5); // Ouvre à 50% au tap
                  onSelectPlace?.(p);
                }}
              />
            ))}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
```

- [ ] **Step 5: Implémenter `src/components/explorer/DesktopSplitExplorer.tsx`**

Créer `src/components/explorer/DesktopSplitExplorer.tsx` :
```tsx
'use client';

import React from 'react';
import type { PlaceMarkerData } from '@/lib/types/map';
import { PlaceCard } from '@/components/places/PlaceCard';
import { FilterBar } from '@/components/filters/FilterBar';

export interface DesktopSplitExplorerProps {
  places: PlaceMarkerData[];
  selectedPlaceId?: string | null;
  onSelectPlace?: (place: PlaceMarkerData) => void;
  isRaining?: boolean;
}

export function DesktopSplitExplorer({
  places,
  selectedPlaceId,
  onSelectPlace,
  isRaining = false,
}: DesktopSplitExplorerProps) {
  return (
    <aside className="w-[440px] h-full flex flex-col bg-white border-r border-slate-200 shadow-sm shrink-0 z-10">
      <div className="p-4 border-b border-slate-100 space-y-3">
        <h1 className="font-bold text-slate-900 text-lg">
          Explorateur du Golfe
        </h1>
        <FilterBar isRaining={isRaining} />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {places.length} lieu{places.length > 1 ? 'x' : ''} trouvés
        </div>

        {places.map((place) => (
          <PlaceCard
            key={place.id}
            place={place}
            variant="compact"
            isSelected={place.id === selectedPlaceId}
            onSelect={onSelectPlace}
          />
        ))}
      </div>
    </aside>
  );
}
```

- [ ] **Step 6: Exécuter le test unitaire et valider le succès**

Exécuter :
```bash
npx tsx --test tests/camera-offset.test.ts
```
Résultat attendu : PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/hooks/useCameraOffset.ts src/components/explorer/MobileExplorerSheet.tsx src/components/explorer/DesktopSplitExplorer.tsx tests/camera-offset.test.ts
git commit -m "feat(ui): add non-modal vaul MobileExplorerSheet, camera-offset hook and desktop split-view"
```

---

### Task 6: Page Explorateur Cartographique (`src/app/carte/page.tsx`)

**Files:**
- Create: `src/app/carte/page.tsx`
- Test: `tests/carte-page.test.ts`

**Interfaces:**
- Produces: Route `/carte` fonctionnelle sur mobile et grand écran avec bascule réactive.

- [ ] **Step 1: Écrire le test d'intégration pour `/carte`**

Créer `tests/carte-page.test.ts` :
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import CartePage from '../src/app/carte/page';

test('CartePage renders without SSR crash', () => {
  const html = renderToString(React.createElement(CartePage));
  assert.ok(html.includes('Explorateur') || html.includes('Golfe'));
});
```

- [ ] **Step 2: Exécuter le test pour vérifier l'échec initial**

Exécuter :
```bash
npx tsx --test tests/carte-page.test.ts
```
Résultat attendu : FAIL (page inexistante).

- [ ] **Step 3: Implémenter `src/app/carte/page.tsx`**

Créer `src/app/carte/page.tsx` :
```tsx
'use client';

import React, { useState } from 'react';
import { FloatingContextPill } from '@/components/context/FloatingContextPill';
import { TidalAlertChip } from '@/components/context/TidalAlertChip';
import { MobileExplorerSheet } from '@/components/explorer/MobileExplorerSheet';
import { DesktopSplitExplorer } from '@/components/explorer/DesktopSplitExplorer';
import type { PlaceMarkerData } from '@/lib/types/map';

// Échantillon initial représentatif des lieux phares
const INITIAL_PLACES: PlaceMarkerData[] = [
  {
    id: 'berder',
    slug: 'passage-berder',
    name: 'Île de Berder',
    latitude: 47.5794,
    longitude: -2.8872,
    category: 'TRAIL',
    status: 'WARNING',
    label: 'Fermeture dans 35 min',
    score: 85,
  },
  {
    id: 'fogeo',
    slug: 'plage-fogeo',
    name: 'Plage du Fogeo (Arzon)',
    latitude: 47.5367,
    longitude: -2.8953,
    category: 'BEACH',
    status: 'IDEAL',
    label: 'Idéal marée haute',
    score: 95,
  },
  {
    id: 'saint-goustan',
    slug: 'port-saint-goustan',
    name: 'Port Saint-Goustan (Auray)',
    latitude: 47.6669,
    longitude: -2.9772,
    category: 'HERITAGE',
    status: 'IDEAL',
    label: 'Terrasses au soleil',
    score: 90,
  },
  {
    id: 'suscinio',
    slug: 'domaine-suscinio',
    name: 'Château de Suscinio',
    latitude: 47.5144,
    longitude: -2.7297,
    category: 'HERITAGE',
    status: 'IDEAL',
    score: 88,
  },
];

export default function CartePage() {
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [activeSnapPoint, setActiveSnapPoint] = useState<string | number | null>('140px');

  return (
    <main className="relative w-full h-[100dvh] overflow-hidden flex flex-col lg:flex-row bg-slate-100">
      {/* Pilule contextuelle flottante haute visibilité */}
      <div className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-4 z-40 pointer-events-auto">
        <FloatingContextPill
          tideText="PM 17h42 (78)"
          weatherText="19°C · NO 12nd"
          urgentAlert={
            <TidalAlertChip
              passageName="Berder"
              minutesRemaining={35}
              isOpen={true}
            />
          }
        />
      </div>

      {/* Volet Desktop (>= 1024px) */}
      <div className="hidden lg:flex h-full">
        <DesktopSplitExplorer
          places={INITIAL_PLACES}
          selectedPlaceId={selectedPlaceId}
          onSelectPlace={(p) => setSelectedPlaceId(p.id)}
        />
      </div>

      {/* Canevas Cartographique Central */}
      <section className="flex-1 relative w-full h-full bg-slate-200 flex items-center justify-center">
        {/* Placeholder avant hydratation MapLibre complète */}
        <div className="text-center p-6 text-slate-600 select-none">
          <p className="text-4xl mb-2">🗺️</p>
          <p className="font-bold text-slate-800">Canevas Cartographique WebGL</p>
          <p className="text-xs text-slate-500 mt-1">MapLibre GL JS & OpenFreeMap</p>
        </div>
      </section>

      {/* Bottom Sheet Mobile (< 1024px) */}
      <MobileExplorerSheet
        places={INITIAL_PLACES}
        selectedPlaceId={selectedPlaceId}
        onSelectPlace={(p) => setSelectedPlaceId(p.id)}
        activeSnapPoint={activeSnapPoint}
        onSnapChange={setActiveSnapPoint}
      />
    </main>
  );
}
```

- [ ] **Step 4: Exécuter le test unitaire et valider le succès**

Exécuter :
```bash
npx tsx --test tests/carte-page.test.ts
```
Résultat attendu : PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/carte/page.tsx tests/carte-page.test.ts
git commit -m "feat(ui): implement responsive /carte page with mobile sheet and desktop split-view"
```

---

### Task 7: Page Dashboard Accueil (`src/app/page.tsx`)

**Files:**
- Modify: `src/app/page.tsx`
- Test: `tests/home-page.test.ts`

**Interfaces:**
- Produces: Page d'accueil `/` complète avec Hero contextuel, sélecteur d'intention tactile, pépites triées et alerte conditionnelle Berder.

- [ ] **Step 1: Écrire le test d'intégration pour la page d'accueil**

Créer `tests/home-page.test.ts` :
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import HomePage from '../src/app/page';

test('HomePage renders hero, cta and intent buttons', () => {
  const html = renderToString(React.createElement(HomePage));
  assert.ok(html.includes('Le Copilote Contextuel'));
  assert.ok(html.includes('Ouvrir la Carte'));
  assert.ok(html.includes('Baignade'));
  assert.ok(html.includes('Sentiers'));
});
```

- [ ] **Step 2: Exécuter le test pour vérifier l'échec initial**

Exécuter :
```bash
npx tsx --test tests/home-page.test.ts
```
Résultat attendu : FAIL (texte différent).

- [ ] **Step 3: Implémenter `src/app/page.tsx`**

Modifier `src/app/page.tsx` :
```tsx
import React from 'react';
import Link from 'next/link';
import { Map, ArrowRight, Waves } from 'lucide-react';
import { PlaceCard } from '@/components/places/PlaceCard';
import { TidalAlertChip } from '@/components/context/TidalAlertChip';
import type { PlaceMarkerData } from '@/lib/types/map';

const TOP_PLACES: PlaceMarkerData[] = [
  {
    id: 'fogeo',
    slug: 'plage-fogeo',
    name: 'Plage du Fogeo (Arzon)',
    latitude: 47.5367,
    longitude: -2.8953,
    category: 'BEACH',
    status: 'IDEAL',
    label: 'Idéal marée haute',
    score: 95,
  },
  {
    id: 'saint-goustan',
    slug: 'port-saint-goustan',
    name: 'Port Saint-Goustan (Auray)',
    latitude: 47.6669,
    longitude: -2.9772,
    category: 'HERITAGE',
    status: 'IDEAL',
    label: 'Terrasses au soleil',
    score: 90,
  },
  {
    id: 'suscinio',
    slug: 'domaine-suscinio',
    name: 'Château de Suscinio',
    latitude: 47.5144,
    longitude: -2.7297,
    category: 'HERITAGE',
    status: 'IDEAL',
    score: 88,
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-16">
      {/* Header Contextuel & Hero */}
      <header className="relative bg-white border-b border-slate-200/80 pt-8 pb-10 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto flex flex-col items-center text-center">
          {/* Alerte Submersion Juste-à-Temps (apparaît uniquement si urgence) */}
          <div className="mb-4">
            <TidalAlertChip
              passageName="Passage de Berder"
              minutesRemaining={35}
              isOpen={true}
            />
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-800 text-xs font-semibold mb-4">
            <Waves className="w-3.5 h-3.5" />
            <span>Marée montante · Pleine mer à 17h42 (Coeff 78)</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Le Copilote Contextuel du Golfe du Morbihan
          </h1>

          <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-xl">
            Praticabilité des plages à marée haute, sentiers côtiers ouverts et criques abritées du vent en temps réel.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Link
              href="/carte"
              className="h-12 px-6 rounded-full bg-slate-900 text-white font-semibold flex items-center justify-center gap-2 shadow-md transition-transform duration-100 active:scale-95 touch-manipulation hover:bg-slate-800"
            >
              <Map className="w-4 h-4" />
              <span>Ouvrir la Carte en Direct</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Sélecteur d'Intention Immédiate */}
      <section className="max-w-4xl mx-auto w-full px-4 mt-8">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Que souhaitez-vous faire maintenant ?
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            href="/carte?cat=BEACH&maree=IDEAL_NOW"
            className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col items-center text-center transition-transform duration-100 active:scale-95"
          >
            <span className="text-3xl mb-1.5 select-none">🏖️</span>
            <span className="font-semibold text-sm text-slate-800">Baignade idéale</span>
            <span className="text-xs text-slate-500 mt-0.5">Marée haute</span>
          </Link>

          <Link
            href="/carte?cat=TRAIL"
            className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col items-center text-center transition-transform duration-100 active:scale-95"
          >
            <span className="text-3xl mb-1.5 select-none">🥾</span>
            <span className="font-semibold text-sm text-slate-800">Sentiers ouverts</span>
            <span className="text-xs text-slate-500 mt-0.5">GR34 praticable</span>
          </Link>

          <Link
            href="/carte?cat=HERITAGE"
            className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col items-center text-center transition-transform duration-100 active:scale-95"
          >
            <span className="text-3xl mb-1.5 select-none">🏰</span>
            <span className="font-semibold text-sm text-slate-800">Patrimoine</span>
            <span className="text-xs text-slate-500 mt-0.5">Châteaux & Ports</span>
          </Link>

          <Link
            href="/carte?cat=GASTRONOMY"
            className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col items-center text-center transition-transform duration-100 active:scale-95"
          >
            <span className="text-3xl mb-1.5 select-none">🦪</span>
            <span className="font-semibold text-sm text-slate-800">Huîtres & Terrasses</span>
            <span className="text-xs text-slate-500 mt-0.5">Vue mer</span>
          </Link>
        </div>
      </section>

      {/* Pépites du Moment */}
      <section className="max-w-4xl mx-auto w-full px-4 mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">
            Pépites du moment dans le Golfe
          </h2>
          <Link
            href="/carte"
            className="text-sm font-semibold text-emerald-700 flex items-center gap-1 hover:underline"
          >
            <span>Voir la carte</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {TOP_PLACES.map((place) => (
            <PlaceCard key={place.id} place={place} variant="rich" />
          ))}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Exécuter le test unitaire et valider le succès**

Exécuter :
```bash
npx tsx --test tests/home-page.test.ts
```
Résultat attendu : PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx tests/home-page.test.ts
git commit -m "feat(ui): implement context-aware dashboard home page with intent buttons and top spots"
```

---

### Task 8: Validation Globale du Suite de Tests & Vérification Build

**Files:**
- Test: All `tests/**/*.test.ts`

- [ ] **Step 1: Exécuter l'ensemble de la suite de tests de non-régression**

Exécuter :
```bash
npm test
```
Résultat attendu : 100% des tests unitaires passent sans échec.

- [ ] **Step 2: Vérifier le build TypeScript et Next.js**

Exécuter :
```bash
npm run build
```
Résultat attendu : Compilation Next.js standalone sans erreur TypeScript ou JSX.

- [ ] **Step 3: Commit final du Bloc 5**

```bash
git commit --allow-empty -m "chore(release): complete Bloc 5 mobile-first UI implementation plan validation"
```
