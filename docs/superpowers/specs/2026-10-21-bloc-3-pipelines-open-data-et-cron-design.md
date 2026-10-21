# Spécification de Conception — Bloc 3 : Pipelines d'Ingestion Open Data & Routes Cron

- **Date :** 21 Octobre 2026
- **Projet :** Le Copilote Contextuel du Golfe du Morbihan
- **Sous-Projet :** Bloc 3 — Ingestion Météo AROME (Open-Meteo), Ingestion Équipements OSM (Overpass), Parseur GPX Géodésique & Route Cron Sécurisée
- **Statut :** Validé — Prêt pour implémentation

---

## 1. Objectifs & Périmètre

Le Bloc 3 met en place l'infrastructure d'alimentation asynchrone des données dynamiques et géographiques du copilote. Conformément à la règle d'or du projet, **aucun utilisateur final ne déclenche d'appel direct vers une API tierce** : l'application sert toujours les requêtes depuis la base locale et le cache mémoire.

Les 4 responsabilités exclusives de ce bloc sont :
1. **Connecteur Open-Meteo (`src/lib/open-meteo.ts`)** :
   - Récupération des prévisions météo temps réel à haute résolution (modèle AROME Météo-France) pour les 5 secteurs côtiers stratégiques.
   - Calcul de la direction cardinale normalisée (`N`, `NE`, `E`, etc.) et détection de la pluie.
   - Upsert idempotent dans la table `weather_snapshots`.
2. **Connecteur Overpass OpenStreetMap (`src/lib/overpass.ts`)** :
   - Ingestion des cales de mise à l'eau (`leisure=slipway`) vers la table principale `places` (`category: 'NAUTICAL'`).
   - Ingestion des équipements d'usage courant (fontaines `amenity=drinking_water` et toilettes `amenity=toilets`) vers une table légère dédiée `amenities`.
3. **Parseur GPX Géodésique (`src/lib/gpx-parser.ts`)** :
   - Conversion tolérante de flux XML GPX en GeoJSON `LineString`.
   - Calcul mathématique de la distance cumulée (formule de Haversine) et du dénivelé (D+/D-) avec **filtre d'hystérésis altimétrique (seuil de 3 m)** pour éliminer le bruit GPS mobile.
   - Échantillonnage régulier du profil altimétrique (100 à 200 points max) pour un affichage SVG instantané.
4. **Route API Cron `/api/cron/sync` & Scripts CLI** :
   - Endpoint Next.js App Router protégé par `CRON_SECRET` (`Authorization: Bearer <token>`).
   - Support des jobs sélectifs (`?job=all|weather|osm`).
   - Résilience non-bloquante avec reporting granulaire et rétention des données existantes en cas de défaillance tierce.
   - Scripts autonomes (`scripts/sync-weather.ts`, `scripts/sync-osm.ts`).

---

## 2. Architecture Technique & Modèle de Données

### 2.1 Organisation des Fichiers

```text
src/
├── app/
│   └── api/
│       └── cron/
│           └── sync/
│               └── route.ts          # Route API protégée par CRON_SECRET (GET/POST)
├── db/
│   └── schema.ts                     # Table amenities et énumération amenity_type
├── lib/
│   ├── open-meteo.ts                 # Service d'ingestion météo AROME
│   ├── overpass.ts                   # Service d'ingestion OSM Overpass (cales & équipements)
│   ├── gpx-parser.ts                 # Parseur GPX XML -> GeoJSON avec profil altimétrique
│   ├── types/
│   │   ├── weather.ts                # Interfaces Open-Meteo, snapshots & secteurs
│   │   ├── osm.ts                    # Interfaces Overpass QL & amenities
│   │   └── gpx.ts                    # Interfaces de résultat GPX & profil altimétrique
│   └── utils/
│       └── geo.ts                    # Fonctions pures : Haversine, filtre altimétrique, cardinaux
scripts/
├── sync-weather.ts                   # Exécutable CLI pour la météo
└── sync-osm.ts                       # Exécutable CLI pour OSM Overpass
tests/
├── open-meteo.test.ts                # Tests unitaires connecteur météo et fonctions pures
├── overpass.test.ts                  # Tests unitaires connecteur OSM et routage
├── gpx-parser.test.ts                # Tests unitaires parseur GPX, Haversine et anti-bruit
└── cron-sync.test.ts                 # Tests d'intégration de la route /api/cron/sync
```

### 2.2 Dépendances Externes Minimales

- Production :
  - `@tmcw/togeojson` : `^6.0.0` (conversion GPX vers GeoJSON pure et sans dépendance C++)
  - `@xmldom/xmldom` : `^0.8.10` (analyseur DOM XML résilient aux imperfections de formatage)
- Zéro dépendance superflue :
  - Requêtes HTTP effectuées via `fetch` natif (Node 18+ / Next.js 15).
  - Calculs géodésiques autonomes dans `src/lib/utils/geo.ts` (évite les 500 Ko de `@turf/turf`).

### 2.3 Évolution du Schéma Drizzle (`src/db/schema.ts`)

Pour préserver la clarté du catalogue `places` tout en indexant efficacement les points d'eau et sanitaires utiles aux randonneurs et à la carte interactive (Bloc 4) :

```typescript
// Nouvel enum pour les types d'équipements utilitaires
export const amenityTypeEnum = pgEnum('amenity_type', [
  'DRINKING_WATER', // Fontaines d'eau potable
  'TOILETS',        // Toilettes publiques
  'OTHER',          // Extensions futures
]);

// Table des équipements pratiques
export const amenities = pgTable(
  'amenities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    osmId: varchar('osm_id', { length: 64 }).notNull().unique(), // ex: 'node:12345678' ou 'way:87654321'
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

---

## 3. Spécification des Connecteurs

### 3.1 Connecteur Open-Meteo (`src/lib/open-meteo.ts`)

#### 1. Configuration des 5 Secteurs Côtiers
```typescript
export interface SectorConfig {
  sector: 'VANNES' | 'ARRADON' | 'SARZEAU' | 'QUIBERON' | 'ETEL';
  name: string;
  latitude: number;
  longitude: number;
}

export const COASTAL_SECTORS: Record<string, SectorConfig> = {
  VANNES: { sector: 'VANNES', name: 'Fond de Golfe (Vannes / Séné)', latitude: 47.6586, longitude: -2.7599 },
  ARRADON: { sector: 'ARRADON', name: 'Golfe Ouest (Arradon / Baden)', latitude: 47.6258, longitude: -2.8277 },
  SARZEAU: { sector: 'SARZEAU', name: 'Presqu\'île de Rhuys (Sarzeau / Port-Navalo)', latitude: 47.5278, longitude: -2.7694 },
  QUIBERON: { sector: 'QUIBERON', name: 'Presqu\'île de Quiberon & Océan', latitude: 47.4839, longitude: -3.1206 },
  ETEL: { sector: 'ETEL', name: 'Ria d\'Étel & Côte Sauvage Nord', latitude: 47.6575, longitude: -3.2003 },
};
```

#### 2. Requête API & Modèle AROME
- **URL** : `https://api.open-meteo.com/v1/forecast`
- **Paramètres** :
  - `latitude`, `longitude`
  - `current`: `temperature_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m`
  - `wind_speed_unit`: `kn` (nœuds marins)
  - `models`: `meteofrance_arome_france_hd,meteofrance_arome_france`
- **Timeout** : 8 secondes (`AbortSignal.timeout(8000)`).

#### 3. Logique Métier Pure (`mapOpenMeteoResponse`)
- **Direction cardinale** : Conversion de l'angle $[0, 360[$ en 8 secteurs de 45° :
  - $N \in [337.5^\circ, 360^\circ] \cup [0^\circ, 22.5^\circ[$
  - $NE \in [22.5^\circ, 67.5^\circ[$, $E \in [67.5^\circ, 112.5^\circ[$, $SE \in [112.5^\circ, 157.5^\circ[$
  - $S \in [157.5^\circ, 202.5^\circ[$, $SW \in [202.5^\circ, 247.5^\circ[$, $W \in [247.5^\circ, 292.5^\circ[$, $NW \in [292.5^\circ, 337.5^\circ[$
- **Détection de pluie (`isRaining`)** : `true` si `precipitation > 0.1` ou codes WMO de précipitations (51 à 67, 80 à 82, 95 à 99).

#### 4. Upsert & Résilience
- Upsert sur la contrainte d'unicité `weatherSnapshots.sector`.
- En cas d'échec sur un secteur, les données précédentes sont conservées sans modification de leur date, évitant de servir des données nulles ou corrompues.

---

### 3.2 Connecteur Overpass OpenStreetMap (`src/lib/overpass.ts`)

#### 1. Bounding Box & Requête Overpass QL
Zone littorale du Morbihan : Sud `47.45`, Ouest `-3.25`, Nord `47.75`, Est `-2.60`.

```overpassql
[out:json][timeout:25];
(
  node["leisure"="slipway"](47.45,-3.25,47.75,-2.60);
  way["leisure"="slipway"](47.45,-3.25,47.75,-2.60);
  node["amenity"="drinking_water"](47.45,-3.25,47.75,-2.60);
  node["amenity"="toilets"](47.45,-3.25,47.75,-2.60);
  way["amenity"="toilets"](47.45,-3.25,47.75,-2.60);
);
out center tags;
```

#### 2. Routage Hybride des Données
- **Cales (`leisure=slipway`) $\rightarrow$ Table `places`** :
  - `externalId` : `osm:node:<id>` ou `osm:way:<id>`.
  - `category` : `'NAUTICAL'`.
  - `slug` : normalisé (`cale-de-...` ou `cale-slipway-<id>`).
  - `contextualRules` : `{ tideConstraint: tags.tidal === 'yes' ? 'HIGH_TIDE_ONLY' : 'ALL_TIDES', dogsAllowedSummer: true, strollerFriendly: true, rainFriendly: false }`.
  - Upsert sur `places.externalId` sans écraser les descriptions éditoriales manuelles.
- **Fontaines & Toilettes $\rightarrow$ Table `amenities`** :
  - `osmId` : `node:<id>` ou `way:<id>`.
  - `type` : `'DRINKING_WATER'` ou `'TOILETS'`.
  - `properties` : stockage JSONB des tags pertinents (`wheelchair`, `fee`, `seasonal`, `access`).
  - Upsert sur `amenities.osmId`.

#### 3. Résilience Réseau
- Endpoint primaire : `https://overpass-api.de/api/interpreter`.
- Miroir secondaire automatique : `https://overpass.kumi.systems/api/interpreter`.

---

## 4. Parseur GPX & Fonctions Géodésiques (`src/lib/gpx-parser.ts`)

### 4.1 Interface de Résultat
```typescript
export interface ParsedGpxResult {
  track: GeoJSON.Feature<GeoJSON.LineString>;
  distanceKm: number;
  elevationGainM: number;       // D+ cumulé lissé
  elevationLossM: number;       // D- cumulé lissé
  minElevationM: number;
  maxElevationM: number;
  estimatedDurationMinutes: number;
  elevationProfile: { distKm: number; altM: number }[];
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
}
```

### 4.2 Formules Géodésiques & Algorithme Anti-Bruit (`src/lib/utils/geo.ts`)

1. **Distance Haversine** :
   $$d = 2 R \cdot \operatorname{atan2}\left(\sqrt{\sin^2\frac{\Delta\phi}{2} + \cos\phi_1\cos\phi_2\sin^2\frac{\Delta\lambda}{2}}, \sqrt{1 - a}\right) \quad (R = 6371.0088\text{ km})$$
2. **Filtre Altimétrique d'Hystérésis (Seuil de 3 m)** :
   - Tout capteur GPS de smartphone oscille verticalement de $\pm 2$ à $5$ m.
   - Une variation altimétrique n'est comptabilisée en D+ ou D- que si l'écart dépasse un seuil d'inflexion $\delta \ge 3.0\text{ m}$.
   - Si le tracé est 2D (aucune coordonnée z), `elevationGainM = 0` et `elevationLossM = 0` sans lever d'exception.
3. **Échantillonnage du Profil** :
   - Échantillonnage linéaire à $\le 200$ points de profil `{ distKm, altM }` pour garantir la performance de rendu WebGL / SVG du Bloc 4.
4. **Estimation de la Durée (Norme FFRandonnée)** :
   $$\text{Durée (min)} = \left(\frac{\text{Distance (km)}}{4.0} + \frac{\text{D+ (m)}}{300.0}\right) \times 60$$

---

## 5. Route Sécurisée `/api/cron/sync` & Scripts d'Exécution

### 5.1 Sécurité & Authentification
- Header HTTP : `Authorization: Bearer <CRON_SECRET>`
- Alternative Query param : `?token=<CRON_SECRET>`
- En cas de non-concordance avec `process.env.CRON_SECRET` : code **HTTP 401 Unauthorized**.

### 5.2 Paramètres de Requête & Réponses
- `GET /api/cron/sync?job=all` (défaut) : exécute la météo et la synchro OSM.
- `GET /api/cron/sync?job=weather` : exécute uniquement Open-Meteo.
- `GET /api/cron/sync?job=osm` : exécute uniquement Overpass OSM.

**Code de retour HTTP :**
- `200 OK` si l'ensemble des tâches demandées a abouti.
- `207 Multi-Status` en cas d'erreur partielle (ex: Overpass indisponible mais météo synchronisée).
- Les données en base ne sont jamais réinitialisées ni écrasées en cas d'échec distant.

### 5.3 Scripts CLI (`scripts/`)
- `npm run sync:weather` : synchronise les 5 secteurs côtiers en ligne de commande.
- `npm run sync:osm` : synchronise les cales et équipements OSM en ligne de commande.

---

## 6. Plan de Test & Critères d'Acceptation

1. **`tests/open-meteo.test.ts`** :
   - Validation de la fonction pure de conversion cardinale (8 tranches de 45°).
   - Validation de la détection de pluie sur seuil et codes WMO.
   - Simulation d'un timeout ou 503 : vérification que la base de données ne perd pas son snapshot précédent.
2. **`tests/overpass.test.ts`** :
   - Validation du mapping JSON Overpass (nodes et ways avec centroïde).
   - Vérification du routage : cales vers `places`, fontaines/toilettes vers `amenities`.
   - Test du basculement sur miroir secondaire.
3. **`tests/gpx-parser.test.ts`** :
   - Trace plate du GR34 : vérification que le seuil de 3 m absorbe le bruit GPS mobile (D+ proche de 0).
   - Trace avec dénivelé réel : vérification de la précision de D+, D-, distance et profil.
   - Traces 2D sans altitude : gestion gracieuse sans crash.
   - Traces corrompues ou invalides : rejet explicite avec erreur typée.
4. **`tests/cron-sync.test.ts`** :
   - Rejet 401 si le token est absent ou erroné.
   - Succès 200 avec token valide.
   - Exécution ciblée par paramètre `?job=weather`.
   - Comportement 207 en cas d'échec partiel d'un connecteur.
