# Spécification de Conception — Bloc 1 : Socle Portable & Base de Données

- **Date :** 21 Octobre 2026
- **Projet :** Le Copilote Contextuel du Golfe du Morbihan
- **Sous-Projet :** Bloc 1 — Socle Portable, Docker, Schéma Drizzle ORM avec Supabase & Seed Multi-Zones
- **Instance Supabase :** `ywfibmabchzzogzozoaw.supabase.co`

---

## 1. Objectifs & Périmètre

Le Bloc 1 a pour objectif de poser les fondations techniques du projet sans lock-in fournisseur :
1. Initialiser une application **Next.js 15 (App Router, TypeScript strict, Tailwind CSS)** configurée pour un déploiement autonome (`output: 'standalone'`).
2. Configurer la conteneurisation Docker (`Dockerfile` multi-stage & `docker-compose.yml` avec option PostGIS local).
3. Modéliser la base relationnelle et spatiale avec **Drizzle ORM** (`pgTable`, énumérations, colonnes JSONB typées, index de géolocalisation et de commune).
4. Connecter l'ORM à l'instance cloud **Supabase** (`ywfibmabchzzogzozoaw`) via le pilote `pg` (`node-postgres`).
5. Développer un script de peuplement initial (`seed.ts`) injectant **20+ lieux de référence** couvrant les 4 zones géographiques cibles :
   - Golfe fermé (Vannes, Arradon, Baden, Séné, Île-aux-Moines, Île d'Arz)
   - Presqu'île de Rhuys (Port-Navalo, Arzon, Sarzeau, Saint-Armel)
   - Presqu'île de Quiberon (Côte Sauvage, Quiberon, Saint-Pierre-Quiberon)
   - Ria d'Étel (Saint-Cado, Belz, Étel, Plouhinec, Erdeven)
   ainsi que 48 heures de marées réalistes (Port-Navalo & Vannes) et un instantané météo multi-secteurs.

---

## 2. Architecture Technique du Bloc 1

### 2.1 Dépendances applicatives

- **Production :**
  - `next`: `^15.x`
  - `react`: `^19.x`
  - `react-dom`: `^19.x`
  - `drizzle-orm`: `^0.39.x`
  - `pg`: `^8.13.x`
  - `dotenv`: `^16.x`
  - `lucide-react`: `^1.x`
  - `clsx`: `^2.x`
  - `tailwind-merge`: `^3.x`
- **Développement :**
  - `typescript`: `^5.x`
  - `tailwindcss`: `^4.x` ou `^3.4.x`
  - `drizzle-kit`: `^0.30.x`
  - `tsx`: `^4.x`
  - `@types/node`, `@types/react`, `@types/react-dom`, `@types/pg`, `@types/geojson`

### 2.2 Configuration "Zéro Lock-in"
- `next.config.ts` :
  ```typescript
  import type { NextConfig } from 'next';

  const nextConfig: NextConfig = {
    output: 'standalone',
    images: {
      remotePatterns: [
        { protocol: 'https', hostname: 'images.unsplash.com' },
        { protocol: 'https', hostname: '*.supabase.co' },
      ],
    },
  };

  export default nextConfig;
  ```
- `Dockerfile` : Multi-stage build (deps -> builder -> runner) générant une image minimale basée sur `node:22-alpine` exécutant `server.js` autonome.
- `docker-compose.yml` : Service optionnel `db` avec l'image `postgis/postgis:16-3.4-alpine` pour bascule offline ou déploiement VPS autonome.

---

## 3. Schéma de Base de Données (`src/db/schema.ts`)

### 3.1 Énumérations
- `place_category` : `BEACH`, `TRAIL`, `TIDAL_PASSAGE`, `HERITAGE`, `GASTRONOMY`, `NAUTICAL`, `VIEWPOINT`.
- `tide_constraint` : `ALL_TIDES`, `HIGH_TIDE_ONLY`, `LOW_TIDE_ONLY`, `MID_TIDE_FLOW`.

### 3.2 Types JSONB TypeScript
- `ContextualRules` :
  - `tideConstraint`: `tide_constraint`
  - `tideOffsetHours`?: `{ beforeHigh?: number; afterHigh?: number; beforeLow?: number; afterLow?: number }`
  - `shelteredFromWindDirections`?: `('N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW')[]`
  - `minWaterHeightMeters`?: `number`
  - `dogsAllowedSummer`: `boolean`
  - `strollerFriendly`: `boolean`
  - `rainFriendly`: `boolean`
- `TrailMetadata` :
  - `distanceKm`: `number`
  - `elevationGainM`: `number`
  - `durationMinutes`: `number`
  - `difficulty`: `'EASY' | 'MEDIUM' | 'HARD'`
  - `isLoop`: `boolean`
  - `gpxUrl`?: `string`
  - `geojsonTrack`: `GeoJSON.Feature<GeoJSON.LineString>`
  - `elevationProfile`: `{ distKm: number; altM: number }[]`

### 3.3 Tables
1. **`places`** :
   - `id`: UUID (PK, auto-généré)
   - `externalId`: VARCHAR(128) unique
   - `slug`: VARCHAR(255) unique not null
   - `name`: VARCHAR(255) not null
   - `shortDescription`: VARCHAR(300) not null
   - `fullDescription`: TEXT
   - `category`: `place_category` not null
   - `commune`: VARCHAR(100) not null
   - `communeSlug`: VARCHAR(100) not null
   - `sector`: VARCHAR(100) not null (`'Golfe'`, `'Presqu-ile de Rhuys'`, `'Presqu-ile de Quiberon'`, `'Ria d-Etel'`)
   - `latitude`: DOUBLE PRECISION not null
   - `longitude`: DOUBLE PRECISION not null
   - `parkingLat`: DOUBLE PRECISION
   - `parkingLng`: DOUBLE PRECISION
   - `contextualRules`: JSONB typé `ContextualRules` not null
   - `trailData`: JSONB typé `TrailMetadata`
   - `coverImageUrl`: TEXT
   - `isSponsored`: BOOLEAN default false not null
   - `affiliateBookingUrl`: TEXT
   - `affiliateLabel`: VARCHAR(100)
   - `updatedAt`: TIMESTAMP default now not null
   - *Index :* `(commune_slug, category)`, `(latitude, longitude)`, `(is_sponsored)`

2. **`tide_events`** :
   - `id`: UUID (PK, auto-généré)
   - `harbor`: VARCHAR(50) not null (`'PORT_NAVALO'`, `'VANNES'`)
   - `eventType`: VARCHAR(10) not null (`'HIGH'`, `'LOW'`)
   - `eventTimestamp`: TIMESTAMP WITH TIME ZONE not null
   - `heightMeters`: DOUBLE PRECISION not null
   - `coefficient`: INTEGER
   - *Index :* `(harbor, event_timestamp)`

3. **`weather_snapshots`** :
   - `id`: UUID (PK, auto-généré)
   - `sector`: VARCHAR(50) unique not null (`'VANNES'`, `'ARRADON'`, `'SARZEAU'`, `'QUIBERON'`, `'ETEL'`)
   - `tempCelsius`: DOUBLE PRECISION not null
   - `windSpeedKnots`: DOUBLE PRECISION not null
   - `windDirectionDeg`: INTEGER not null (0-360)
   - `windCardinal`: VARCHAR(5) not null (`'N'`, `'NE'`, `'E'`, `'SE'`, `'S'`, `'SW'`, `'W'`, `'NW'`)
   - `weatherCode`: INTEGER not null (Code WMO)
   - `isRaining`: BOOLEAN not null
   - `updatedAt`: TIMESTAMP default now not null

---

## 4. Stratégie de Connexion Supabase & Portabilité

- Le fichier `src/db/index.ts` instancie un pool `pg.Pool` à partir de `process.env.DATABASE_URL`.
- En développement avec Supabase :
  - Connexion directe : `postgresql://postgres:[PASSWORD]@db.ywfibmabchzzogzozoaw.supabase.co:5432/postgres`
  - Connexion poolée (si réseau IPv4 strict) : `postgresql://postgres.ywfibmabchzzogzozoaw:[PASSWORD]@aws-0-eu-west-3.pooler.supabase.com:6543/postgres`
- En production ou bascule VPS :
  - Modification exclusive de la variable `DATABASE_URL` pointant vers le conteneur local.

---

## 5. Jeu de Données de Référence (Seed)

Le script `src/db/seed.ts` injecte :
1. **20+ lieux géolocalisés avec règles fines de marée et vent :**
   - **Golfe intérieur :**
     - Île de Berder (Passage submersible `LOW_TIDE_ONLY`, alerte courant de la Jument)
     - Plage de Toulindac à Arradon (`HIGH_TIDE_ONLY`, abritée vent Nord/Nord-Est)
     - Pointe de Roguédas / Conleau à Vannes (`HIGH_TIDE_ONLY`, piscine eau de mer)
     - Île-aux-Moines (Sentier côtier GR34 boucle 17 km `ALL_TIDES`)
     - Île d'Arz (Pointe de Liouse, cales et sentier)
     - Courant de la Jument à Port-Blanc / Baden (`MID_TIDE_FLOW`, spectacle de bouillonnement)
   - **Presqu'île de Rhuys :**
     - Passage de l'Île Tascon à Saint-Armel (`LOW_TIDE_ONLY`, passage submersible agricole et ornithologique)
     - Plage du Fogeo à Arzon (`ALL_TIDES`, grande plage océanique, protégée vent Est)
     - Port-Navalo (Capitainerie et phare, port de référence marée)
     - Château de Suscinio et Plage de Suscinio (`ALL_TIDES`, patrimoine ducs de Bretagne)
   - **Presqu'île de Quiberon :**
     - Côte Sauvage - Port Bara (`ALL_TIDES`, baignade interdite/danger houle, sentier côtier spectaculaire)
     - Grande Plage de Quiberon (`ALL_TIDES`, abritée vent Ouest/Nord-Ouest)
     - Pointe du Conguel (Panorama sur Houat et courants du Teignouse)
     - Plage des Sables Blancs à Penthièvre (`ALL_TIDES`, sports nautiques et char à voile)
   - **Ria d'Étel :**
     - Îlot de Saint-Cado à Belz (Maison sur l'eau de Nichtarguér, chapelle romane, `ALL_TIDES`)
     - La Barre d'Étel (Embouchure de la ria, banc de sable mouvant, sémaphore)
     - Plage du Magouër à Plouhinec (Dunes sauvages et cale de mise à l'eau)
     - Plage de Kerhillio à Erdeven (`ALL_TIDES`, vue sur Belle-Île, abri vent Nord-Est)
2. **Événements de marée pour 48h :**
   - Port-Navalo et Vannes (décalage horaire réaliste du Golfe : Vannes a environ 1h30 à 2h de retard par rapport à Port-Navalo).
3. **Instantanés météo initiaux :**
   - Vannes, Arradon, Sarzeau, Quiberon, Étel.

---

## 6. Plan de Test & Validation

- `npm run build` : Compilation du projet complet sans erreur TypeScript ni ESLint.
- `drizzle-kit generate` & `drizzle-kit push` : Application du schéma SQL sur Supabase.
- `npx tsx src/db/seed.ts` : Insertion et vérification du compte d'enregistrements (lieux, marées, météo).
