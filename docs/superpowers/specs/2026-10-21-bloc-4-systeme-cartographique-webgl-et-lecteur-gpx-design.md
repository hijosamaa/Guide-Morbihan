# Spécification de Conception — Bloc 4 : Système Cartographique WebGL & Lecteur GPX

- **Date :** 21 Octobre 2026
- **Projet :** Le Copilote Contextuel du Golfe du Morbihan
- **Sous-Projet :** Bloc 4 — Composant Cartographique WebGL (MapLibre GL JS & OpenFreeMap), Marqueurs Contextuels Stylisés par Statut (Vert/Orange/Gris/Doré), Lecteur de Traces GPX & Profil Altimétrique SVG Interactif Synchronisé
- **Statut :** Validé — Prêt pour implémentation

---

## 1. Objectifs & Périmètre

Le Bloc 4 concrétise l'expérience visuelle et spatiale du copilote. Conformément au cahier des charges, il fournit une cartographie fluide à 60 FPS sur mobile, sans dépendance coûteuse ou propriétaire (zéro abonnement Mapbox/Google Maps), reposant sur des briques souveraines et pérennes : **MapLibre GL JS** et les tuiles vectorielles libres **OpenFreeMap**.

Les responsabilités majeures de ce bloc sont :
1. **Composant Cartographique Principal (`GolfeMap.tsx`)** :
   - Initialisation et contrôle du canevas WebGL MapLibre avec le style vectoriel OpenFreeMap Liberty.
   - Cadrage strict et optimisé sur le territoire du Golfe du Morbihan (limitation d'emprise `maxBounds` pour éviter le gaspillage réseau).
   - Gestion robuste du cycle de vie WebGL (évitement absolu des fuites mémoire et des erreurs d'hydratation SSR).
   - Barre de contrôles flottants intégrés (géolocalisation « Autour de moi », recentrage global, zoom).
2. **Système de Marqueurs Contextuels Dynamiques (`MapMarkers.ts`)** :
   - Génération de marqueurs DOM légers (`maplibregl.Marker`) stylisés à 100% avec des classes utilitaires **Tailwind CSS**.
   - Codage couleur et sémantique immédiate basé sur l'évaluation contextuelle du Bloc 2 :
     - 🟢 **Vert (`IDEAL`)** : spot parfait aux conditions actuelles (marée / météo).
     - 🟠 **Orange (`WARNING`)** : vigilance (fin de créneau praticable, vent soutenu).
     - ⚪ **Gris (`DISCOURAGED`)** : déconseillé (submersion, marée basse vaseuse).
     - 🟡 **Doré (`SPONSORED`)** : recommandation partenaire ou coup de cœur éditorial.
   - Support complet de l'accessibilité web (ARIA roles, labels parlants, focus clavier).
   - Événements de sélection et notification de l'emprise visible (`onBoundsChange`) pour piloter la Bottom Sheet du Bloc 5.
3. **Lecteur de Traces de Randonnée (`GpxTrackViewer.tsx`)** :
   - Rendu vectoriel GPU de la trace GeoJSON `LineString` issue du parseur GPX du Bloc 3 avec halo de lisibilité.
   - Marqueurs distinctifs de départ et d'arrivée.
   - Cadrage automatique (`fitBounds`) centré sur l'itinéraire avec marges de sécurité.
4. **Profil Altimétrique SVG Interactif Synchronisé (`ElevationProfileSvg.tsx`)** :
   - Rendu vectoriel mathématique pur en SVG responsive (sans librairie de charting tierce lourde).
   - Synchronisation bidirectionnelle fluide :
     - Le survol souris ou le glissement au doigt (touch scrub) sur le profil SVG déplace un curseur repère dynamique sur la trace de la carte avec infobulle temps réel (distance en km, altitude en m).
     - Le survol de la trace sur la carte projette le repère correspondant sur le profil altimétrique.
   - Cartouche récapitulatif : distance totale (km), dénivelé positif cumulé D+ (m), altitude min/max (m), temps de marche estimé.
5. **Wrappers d'Hydratation Sécurisés (`DynamicMapWrappers.tsx`)** :
   - Exportation de composants protégés contre le SSR (`next/dynamic` avec `ssr: false`).
   - Squelettes de chargement animés (`animate-pulse`) soignés pour une transition visuelle invisible.

---

## 2. Architecture Technique & Organisation des Fichiers

### 2.1 Arborescence des Fichiers

```text
src/
├── components/
│   └── map/
│       ├── GolfeMap.tsx               # Composant cartographique WebGL principal
│       ├── MapMarkers.ts              # Fabrique DOM des marqueurs contextuels stylisés (Tailwind)
│       ├── MapControls.tsx            # Barre de contrôles flottants (géoloc, recentrage, zoom)
│       ├── GpxTrackViewer.tsx         # Lecteur de trace GPX (carte + profil altimétrique)
│       ├── ElevationProfileSvg.tsx    # Profil altimétrique SVG interactif réactif (scrubbing)
│       ├── DynamicMapWrappers.tsx     # Wrappers client-only Next.js (ssr: false + skeleton)
│       └── index.ts                   # Point d'entrée des exports publics
└── lib/
    ├── map-config.ts                  # Constantes (coordonnées Golfe, zoom, bounds, URLs styles)
    ├── map-utils.ts                   # Utilitaires mathématiques (bbox, interpolation, mise à l'échelle SVG)
    └── types/
        └── map.ts                     # Définitions TypeScript (PlaceMarker, ElevationPoint, MapBounds)
```

### 2.2 Dépendances

- **`maplibre-gl` (v5.x)** : Bibliothèque open-source de cartographie WebGL.
- **`@types/geojson`** : Déjà présent dans le projet (`devDependencies`).
- **`lucide-react`** : Pour les icônes vectorielles des contrôles et des marqueurs.
- **`tailwind-merge` & `clsx`** : Pour la composition fluide des classes Tailwind personnalisables.

---

## 3. Configuration & Cadrage Territorial (`src/lib/map-config.ts`)

La cartographie est verrouillée sur le cadre géographique du Golfe du Morbihan et de ses abords immédiats :

```typescript
export const GOLFE_MAP_CONFIG = {
  // Coordonnées du centre géographique du Golfe (entre l'Île-aux-Moines et Arradon)
  defaultCenter: [-2.7800, 47.5850] as [number, number],
  defaultZoom: 10.5,
  minZoom: 9.0,
  maxZoom: 18.0,

  // Emprise maximale autorisée (évite le défilement hors de Bretagne Sud)
  maxBounds: [
    [-3.3000, 47.2500], // Sud-Ouest (baie de Quiberon / Belle-Île)
    [-2.3500, 47.8800], // Nord-Est (Vannes / Auray / Questembert)
  ] as [[number, number], [number, number]],

  // Tuiles vectorielles libres et rapides OpenFreeMap
  styles: {
    liberty: 'https://tiles.openfreemap.org/styles/liberty',
    bright: 'https://tiles.openfreemap.org/styles/bright',
    // Fallback raster OSM standard
    fallbackRaster: {
      version: 8,
      sources: {
        'osm-tiles': {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap Contributors',
        },
      },
      layers: [
        {
          id: 'osm-tiles-layer',
          type: 'raster',
          source: 'osm-tiles',
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
  },
};
```

---

## 4. Composant Cartographique Principal (`GolfeMap.tsx`)

### 4.1 Interface des Props (`src/lib/types/map.ts`)

```typescript
import type { EvaluationStatus } from '@/lib/types/context';

export interface PlaceMarkerData {
  id: string;
  slug: string;
  name: string;
  latitude: number;
  longitude: number;
  category: string;
  status: EvaluationStatus; // 'IDEAL' | 'WARNING' | 'DISCOURAGED'
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
```

### 4.2 Cycle de Vie WebGL & Gestion Mémoire

1. **Montage & Initialisation :**
   - Utilisation de `useRef<HTMLDivElement>` pour le conteneur DOM.
   - Création de l'instance `maplibregl.Map` dans un `useEffect` déclenché une seule fois.
   - Enregistrement des gestionnaires d'erreurs (`map.on('error')`) avec bascule transparente vers le style raster en cas d'échec de chargement des tuiles vectorielles.
   - Surveillance de la taille du conteneur via un `ResizeObserver` qui appelle `map.resize()` pour neutraliser les bandes grises lors des transitions CSS ou rotations mobiles.

2. **Démontage & Nettoyage :**
   - Suppression des écouteurs d'événements.
   - Suppression de tous les marqueurs du DOM via `marker.remove()`.
   - Fermeture du ResizeObserver.
   - Invocation de `map.remove()`, libération explicite de l'extension WebGL `WEBGL_lose_context` pour libérer la mémoire GPU mobile.

3. **Interception de la perte de contexte GPU (`webglcontextlost`) :**
   - L'événement `webglcontextlost` sur le canvas intercepte l'arrêt GPU du système (`e.preventDefault()`).
   - L'événement `webglcontextrestored` déclenche une réinitialisation automatique sans rafraîchissement complet de la page.

---

## 5. Système de Marqueurs Stylisés par Statut (`MapMarkers.ts`)

### 5.1 Structure DOM & Rendu Tailwind

Chaque marqueur est un élément HTML interactif doté de styles Tailwind entièrement personnalisables :

```typescript
export interface MarkerStyleTokens {
  badgeClass: string;
  dotClass: string;
  ringClass: string;
  iconName?: string;
}

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

### 5.2 Accessibilité & Interactions

- **Éléments DOM natifs :** `button` ou `div` avec `role="button"`, `tabindex="0"`.
- **Attribut `aria-label` :** Explicite et lisible par les outils d'assistance vocale :
  `aria-label="Plage de Conleau — Statut : Idéal aux marées actuelles"`
- **Déclenchement clavier :** Écoute des touches `Enter` et `Space` pour déclencher `onSelectPlace`.
- **Surbrillance de sélection (`selectedPlaceId`) :**
  - Ajout d'une classe d'agrandissement (`scale-125 z-50 ring-4 ring-sky-500`).
  - Animation de centrage progressif via `map.flyTo({ center: [place.longitude, place.latitude], speed: 1.2 })`.

---

## 6. Composant Lecteur GPX & Profil Altimétrique SVG (`GpxTrackViewer.tsx`)

### 6.1 Interface des Props

```typescript
export interface ElevationPoint {
  distanceKm: number;
  elevationM: number;
  lat: number;
  lon: number;
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

### 6.2 Rendu Vectoriel de la Trace sur MapLibre

- **Source de données :** `map.addSource('gpx-track', { type: 'geojson', data: geojson })`.
- **Couche halo de contraste :**
  - `id: 'gpx-track-casing'`
  - `type: 'line'`
  - `paint: { 'line-color': '#ffffff', 'line-width': 7, 'line-opacity': 0.85 }`
- **Couche principale :**
  - `id: 'gpx-track-line'`
  - `type: 'line'`
  - `layout: { 'line-join': 'round', 'line-cap': 'round' }`
  - `paint: { 'line-color': '#0284c7', 'line-width': 4 }` (Bleu Sky Tailwind)
- **Cadrage automatique :** Calcul de la boîte englobante de la trace (`map-utils.ts: calculateBoundingBox`) et ajustement automatique via :
  `map.fitBounds(bbox, { padding: { top: 40, bottom: 40, left: 40, right: 40 }, maxZoom: 15, duration: 800 })`.
- **Marqueurs d'extrémité :**
  - Épingle de départ : point vert avec icône de drapeau ou lettre `D`.
  - Épingle d'arrivée : point rouge/damier avec lettre `A`.

### 6.3 Profil Altimétrique SVG Réactif (`ElevationProfileSvg.tsx`)

Le profil altimétrique est dessiné directement en SVG mathématique pur, garantissant zéro dépendance tierce et un rendu instantané :

1. **Géométrie & Mise à l'Échelle :**
   - Espace SVG : `viewBox="0 0 800 160"` avec préservation du ratio d'aspect.
   - Échelle X : $x = \frac{p.\text{distanceKm}}{D_{\max}} \times 800$.
   - Échelle Y : $y = 140 - \frac{p.\text{elevationM} - A_{\min}}{A_{\max} - A_{\min} + \epsilon} \times 100$ (avec marge supérieure pour l'esthétique).
   - Génération de la ligne de crête : balise `<path d="..." fill="none" stroke="#0284c7" strokeWidth="2.5" />`.
   - Génération de l'aire sous la courbe : balise `<path d="... V 150 H 0 Z" fill="url(#elevation-gradient)" />` avec dégradé vertical (`sky-500/25` vers transparent).
2. **Synchronisation Bidirectionnelle :**
   - Événements `onPointerMove` / `onTouchMove` sur le conteneur SVG :
     - Conversion de la position locale du curseur $X$ en distance kilométrique cible.
     - Recherche dichotomique ou linéaire du point le plus proche dans `elevationProfile`.
     - Mise à jour de la réglette verticale SVG et de l'infobulle flottante (`km X.X • Y m`).
     - Déplacement simultané du curseur dynamique sur la carte MapLibre via `trackPinMarker.setLngLat([point.lon, point.lat])`.
   - Événement `mouseleave` / `touchend` : masquage gracieux du curseur repère et de l'infobulle.
3. **Cartouche Métrique Récapitulatif :**
   - En-tête au-dessus du profil affichant 4 données synthétiques stylisées avec Tailwind :
     - 📏 **Distance :** `X.X km`
     - ⛰️ **Dénivelé D+ :** `+XX m`
     - 📍 **Point Culminant :** `XX m`
     - ⏱️ **Temps Estimé :** calculé selon la norme FFRandonnée (vitesse moyenne de 4 km/h à plat + 1h par 300m de D+).

---

## 7. Prévention SSR & Wrappers Dynamiques (`DynamicMapWrappers.tsx`)

Pour respecter strictement l'architecture Next.js 15 App Router et éliminer tout risque d'erreur d'hydratation côté serveur (`ReferenceError: window is not defined`) :

```typescript
// src/components/map/DynamicMapWrappers.tsx
'use client';

import dynamic from 'next/dynamic';
import { MapSkeleton } from './MapSkeleton';

export const DynamicGolfeMap = dynamic(
  () => import('./GolfeMap').then((mod) => mod.GolfeMap),
  {
    ssr: false,
    loading: () => <MapSkeleton message="Chargement de la carte interactive..." />,
  }
);

export const DynamicGpxTrackViewer = dynamic(
  () => import('./GpxTrackViewer').then((mod) => mod.GpxTrackViewer),
  {
    ssr: false,
    loading: () => <MapSkeleton message="Chargement du tracé de randonnée..." height="h-96" />,
  }
);
```

Le composant `MapSkeleton` affiche un conteneur stylisé en Tailwind (`bg-slate-100 animate-pulse rounded-2xl flex flex-col items-center justify-center text-slate-400 gap-3`) afin d'offrir une transition visuelle fluide sans sursaut d'affichage (CLS = 0).

---

## 8. Utilitaires Mathématiques & Géodésiques (`src/lib/map-utils.ts`)

Fonctions pures dédiées aux calculs cartographiques :

1. `calculateBoundingBox(coordinates: [number, number][]): [[number, number], [number, number]]`
   - Détermine `[[minLon, minLat], [maxLon, maxLat]]` avec garde-fous sur tableau vide ou à point unique.
2. `findNearestElevationPoint(points: ElevationPoint[], targetDistanceKm: number): ElevationPoint`
   - Sélectionne le point altimétrique le plus proche d'une distance kilométrique donnée.
3. `calculateElevationScales(points: ElevationPoint[], width: number, height: number)`
   - Calcule les bornes minimales et maximales d'altitude ($A_{\min}, A_{\max}$) avec padding minimal pour éviter les divisions par zéro sur terrain plat.
   - Construit les chaînes de commande SVG `<path d="...">` pour la ligne et l'aire dégradée.
4. `estimateHikingDuration(distanceKm: number, elevationGainM: number): { hours: number; minutes: number; formatted: string }`
   - Applique la formule géodésique standard pour estimer la durée de marche.
5. `isPointInBounds(lat: number, lon: number, bounds: MapViewportBounds): boolean`
   - Vérifie l'inclusion géographique d'un lieu dans l'emprise courante de la caméra.

---

## 9. Plan de Test & Critères d'Acceptation

### 9.1 Tests Unitaires (`tests/map-utils.test.ts`)
- **Calcul de Boîte Englobante :**
  - Validation sur un tracé de 100 points : vérification de l'inclusion stricte de tous les points.
  - Résilience sur entrée vide ou coordonnées dégénérées (retour de l'emprise par défaut du Golfe).
- **Mise à l'échelle & Tracé SVG :**
  - Vérification de la génération des chemins SVG valides (syntaxe `M x y L x y ...`).
  - Tolérance aux tracés complètement plats (ex: île avec 0m de dénivelé sans `NaN` ni division par zéro).
- **Interpolation du Curseur Synchronisé :**
  - Vérification de la précision de sélection du point altimétrique lors d'un scrub horizontal.
  - Calcul de durée de randonnée conforme à la formule pédestre.
- **Résolution des Styles Tailwind de Marqueurs :**
  - Validation des classes appliquées pour chaque statut (`IDEAL`, `WARNING`, `DISCOURAGED`, `SPONSORED`).

### 9.2 Tests de Composants & Accessibilité (`tests/map-components.test.ts`)
- **Génération DOM des Marqueurs :**
  - Création des éléments DOM de marqueurs : présence obligatoire des attributs `role="button"`, `tabindex="0"`, et `aria-label`.
  - Vérification que la sélection au clavier déclenche le callback `onSelectPlace`.
- **Rendu du Profil Altimétrique SVG :**
  - Présence des éléments SVG structurels (`<svg>`, `<path>`, `<defs>`, `<linearGradient>`).
  - Gestion des événements de pointeur (`pointermove`, `pointerleave`) sans levée d'exception.
- **Squelette de Chargement & SSR :**
  - Vérification du rendu serveur sans erreur du composant `MapSkeleton`.

### 9.3 Critères d'Acceptation Globaux
1. Aucun appel direct vers des services tiers payants (100% MapLibre GL JS + OpenFreeMap).
2. Zéro erreur d'hydratation SSR (`window is not defined`) grâce aux wrappers dynamiques.
3. Fluidité du scrubbing du profil altimétrique à 60 FPS sans décalage du curseur sur la carte.
4. Personnalisation graphique intégrale de tous les éléments d'interface via Tailwind CSS.
5. Suite de tests unitaires passant à 100% avec `npm test`.
