# Bloc 1 — Socle Portable & Base de Données Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mettre en place le socle Next.js 15 en mode standalone, la conteneurisation Docker portable, la modélisation Drizzle ORM connectée à Supabase, et un jeu de données initial (Seed) de 20+ lieux répartis sur les 4 zones (Golfe, Rhuys, Quiberon, Ria d'Étel).

**Architecture:** Next.js 15 App Router avec TypeScript strict et Tailwind CSS, conteneurisé en multi-stage build sans dépendance propriétaire Vercel ni Supabase SDK. Base relationnelle et géospatiale pilotée par Drizzle ORM avec connecteur `pg`, connectée à l'instance Supabase `ywfibmabchzzogzozoaw.supabase.co` ou basculable sur PostGIS local.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, Drizzle ORM, Drizzle Kit, `pg` (node-postgres), Docker, Supabase PostgreSQL / PostGIS.

**Spec:** [docs/superpowers/specs/2026-10-21-bloc-1-socle-et-base-de-donnees-design.md](file:///Users/Moulitos/Documents/antigravity/Guide%20Morbihan/docs/superpowers/specs/2026-10-21-bloc-1-socle-et-base-de-donnees-design.md)

## Global Constraints

- Standalone output obligatoire : `output: 'standalone'` dans `next.config.ts`.
- Zéro dépendance propriétaire `@vercel/*` ni `@supabase/*` dans la couche de données (portabilité VPS immédiate).
- TypeScript en mode strict, zéro type `any`.
- Schéma Drizzle rigoureusement conforme au PRD ([CAHIER_DES_CHARGES.md](file:///Users/Moulitos/Documents/antigravity/Guide%20Morbihan/CAHIER_DES_CHARGES.md)).
- Couverture géographique obligatoire sur les 4 zones : Golfe fermé, Presqu'île de Rhuys, Presqu'île de Quiberon, Ria d'Étel.

---

### Task 1: Next.js 15 Project Scaffold & Configuration

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `postcss.config.mjs`
- Create: `src/app/globals.css`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Modify: `.gitignore`

**Interfaces:**
- Produces: Application Next.js 15 fonctionnelle avec Tailwind CSS, script `build` produisant un serveur autonome `standalone`.

- [ ] **Step 1: Initialiser package.json avec les dépendances spécifiées**

```json
{
  "name": "guide-morbihan",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "db:push": "drizzle-kit push",
    "db:generate": "drizzle-kit generate",
    "db:seed": "tsx src/db/seed.ts",
    "test": "tsx --test tests/**/*.test.ts"
  },
  "dependencies": {
    "clsx": "^2.1.1",
    "dotenv": "^16.4.7",
    "drizzle-orm": "^0.39.3",
    "lucide-react": "^0.475.0",
    "next": "^15.1.7",
    "pg": "^8.13.3",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwind-merge": "^3.0.1"
  },
  "devDependencies": {
    "@types/geojson": "^7946.0.16",
    "@types/node": "^22.13.4",
    "@types/pg": "^8.11.11",
    "@types/react": "^19.0.10",
    "@types/react-dom": "^19.0.4",
    "drizzle-kit": "^0.30.4",
    "postcss": "^8.5.2",
    "tailwindcss": "^3.4.17",
    "tsx": "^4.19.2",
    "typescript": "^5.7.3"
  }
}
```

- [ ] **Step 2: Installer les dépendances via npm**

Run: `npm install`
Expected: Dépendances installées et `package-lock.json` généré sans conflit.

- [ ] **Step 3: Créer tsconfig.json, next.config.ts et configuration Tailwind**

`tsconfig.json` :
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next.config.ts` :
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

`tailwind.config.ts` :
```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ocean: {
          50: '#f0f9ff',
          500: '#0284c7',
          700: '#0369a1',
          900: '#0c4a6e',
        },
        slate: {
          900: '#0f172a',
        },
      },
    },
  },
  plugins: [],
};

export default config;
```

`postcss.config.mjs` :
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 4: Créer les pages de démarrage minimales**

`src/app/globals.css` :
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #f8fafc;
  --foreground: #0f172a;
}

/* Règle mobile-native : suppression du flash gris tactile et inflation de police */
html {
  -webkit-tap-highlight-color: transparent;
  -webkit-text-size-adjust: 100%;
}

body {
  color: var(--foreground);
  background: var(--background);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  min-height: 100dvh;
}

/* Cibles tactiles réactives et suppression du délai de 300ms */
button,
a,
[role="button"] {
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
}

/* Empêcher le zoom automatique sur focus input iOS Safari */
input,
textarea,
select {
  font-size: 16px;
}
```

`src/app/layout.tsx` :
```typescript
import type { Metadata, Viewport } from 'next';
import './globals.css';

// Configuration viewport mobile-native conforme aux standards PWA
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
      <body className="min-h-screen antialiased bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
```

`src/app/page.tsx` :
```typescript
export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
        Le Copilote Contextuel du Golfe du Morbihan
      </h1>
      <p className="max-w-xl mt-4 text-lg text-slate-600">
        Praticabilité des plages, passages de Berder et Tascon, sentiers côtiers et criques abritées en temps réel.
      </p>
      <div className="inline-flex items-center px-4 py-2 mt-8 font-medium text-white rounded-full bg-ocean-500 shadow-sm">
        Socle Next.js 15 Standalone Initialisé
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Mettre à jour .gitignore**

Ajouter à `.gitignore` :
```gitignore
node_modules
.next
out
build
dist
.env
.env.local
.env.production
.DS_Store
*.pem
```

- [ ] **Step 6: Vérifier la compilation Next.js standalone**

Run: `npm run build`
Expected: Build réussi avec le message indiquant la création du dossier `.next/standalone`.

- [ ] **Step 7: Commit Task 1**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts tailwind.config.ts postcss.config.mjs src/ .gitignore
git commit -m "feat: scaffold Next.js 15 standalone project with Tailwind CSS"
```

---

### Task 2: Docker & Portable Configuration

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `docker-compose.yml`
- Create: `.env.example`

**Interfaces:**
- Produces: Conteneurisation autonome pour déploiement VPS/Coolify et fallback local PostgreSQL PostGIS 16.

- [ ] **Step 1: Créer le Dockerfile multi-stage**

`Dockerfile` :
```dockerfile
FROM node:22-alpine AS base

# Étape 1 : Installation des dépendances
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Étape 2 : Construction de l'application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# Étape 3 : Image d'exécution minimale
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
```

- [ ] **Step 2: Créer le fichier .dockerignore**

`.dockerignore` :
```text
node_modules
.next
.git
.env
.env.local
npm-debug.log
README.md
docs
```

- [ ] **Step 3: Créer docker-compose.yml et .env.example**

`docker-compose.yml` :
```yaml
version: '3.8'

services:
  web:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - CRON_SECRET=${CRON_SECRET}
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy

  # Service optionnel si bascule locale ou VPS sans Supabase Cloud
  db:
    image: postgis/postgis:16-3.4-alpine
    container_name: morbihan-postgis
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgrespassword
      POSTGRES_DB: morbihan_guide
    ports:
      - "5432:5432"
    volumes:
      - postgis_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgis_data:
```

`.env.example` :
```bash
# Configuration Supabase (ywfibmabchzzogzozoaw)
# Mode direct :
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.ywfibmabchzzogzozoaw.supabase.co:5432/postgres"
# Mode pooler (IPv4 / Transaction mode) :
# DATABASE_URL="postgresql://postgres.ywfibmabchzzogzozoaw:[PASSWORD]@aws-0-eu-west-3.pooler.supabase.com:6543/postgres"

# Mode Docker local (fallback sans Supabase) :
# DATABASE_URL="postgresql://postgres:postgrespassword@localhost:5432/morbihan_guide"

# Jeton secret pour l'ingestion API Cron
CRON_SECRET="change-this-to-a-secure-random-token"
```

- [ ] **Step 4: Commit Task 2**

```bash
git add Dockerfile .dockerignore docker-compose.yml .env.example
git commit -m "feat: add multi-stage Dockerfile, docker-compose and .env.example"
```

---

### Task 3: Drizzle ORM Setup, Database Connection & Schema Definition

**Files:**
- Create: `drizzle.config.ts`
- Create: `src/db/index.ts`
- Create: `src/db/schema.ts`
- Test: `tests/schema.test.ts`

**Interfaces:**
- Produces: Tables Drizzle ORM `places`, `tideEvents`, `weatherSnapshots` avec énumérations et typages JSONB stricts, connexion via `db`.

- [ ] **Step 1: Créer drizzle.config.ts**

`drizzle.config.ts` :
```typescript
import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || '',
  },
  verbose: true,
  strict: true,
});
```

- [ ] **Step 2: Créer src/db/index.ts**

`src/db/index.ts` :
```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const connectionString = process.env.DATABASE_URL;

const pool = new pg.Pool({
  connectionString,
  ssl: connectionString?.includes('supabase.co') || connectionString?.includes('pooler.supabase.com')
    ? { rejectUnauthorized: false }
    : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
});

export const db = drizzle(pool, { schema });
export { pool };
```

- [ ] **Step 3: Créer src/db/schema.ts selon les spécifications complètes**

`src/db/schema.ts` :
```typescript
import {
  pgTable,
  uuid,
  varchar,
  text,
  doublePrecision,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';

// Énumérations métier
export const categoryEnum = pgEnum('place_category', [
  'BEACH',           // Plages et criques
  'TRAIL',           // Randonnées et sentiers GR34
  'TIDAL_PASSAGE',   // Passages submersibles (Berder, Tascon...)
  'HERITAGE',        // Châteaux, mégalithes, ports historiques
  'GASTRONOMY',      // Chantiers ostréicoles, crêperies, cafés
  'NAUTICAL',        // Cales, clubs nautiques, embarcadères
  'VIEWPOINT',       // Panoramas et points de vue
]);

export const tideConstraintEnum = pgEnum('tide_constraint', [
  'ALL_TIDES',       // Praticable tout le temps
  'HIGH_TIDE_ONLY',  // Baignade à marée haute uniquement
  'LOW_TIDE_ONLY',   // Passages submersibles ou pêche à pied
  'MID_TIDE_FLOW',   // Observation de courants marins (Courant de la Jument)
]);

// Types JSONB contextuels
export interface ContextualRules {
  tideConstraint: 'ALL_TIDES' | 'HIGH_TIDE_ONLY' | 'LOW_TIDE_ONLY' | 'MID_TIDE_FLOW';
  tideOffsetHours?: {
    beforeHigh?: number;
    afterHigh?: number;
    beforeLow?: number;
    afterLow?: number;
  };
  shelteredFromWindDirections?: ('N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW')[];
  minWaterHeightMeters?: number;
  dogsAllowedSummer: boolean;
  strollerFriendly: boolean;
  rainFriendly: boolean;
}

export interface TrailMetadata {
  distanceKm: number;
  elevationGainM: number;
  durationMinutes: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  isLoop: boolean;
  gpxUrl?: string;
  geojsonTrack: GeoJSON.Feature<GeoJSON.LineString>;
  elevationProfile: { distKm: number; altM: number }[];
}

// 1. Table principale des Lieux, Plages et Sentiers
export const places = pgTable(
  'places',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    externalId: varchar('external_id', { length: 128 }).unique(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    shortDescription: varchar('short_description', { length: 300 }).notNull(),
    fullDescription: text('full_description'),
    category: categoryEnum('category').notNull(),
    commune: varchar('commune', { length: 100 }).notNull(),
    communeSlug: varchar('commune_slug', { length: 100 }).notNull(),
    sector: varchar('sector', { length: 100 }).notNull(),
    
    // Coordonnées GPS principales et Parking
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    parkingLat: doublePrecision('parking_lat'),
    parkingLng: doublePrecision('parking_lng'),

    // Règles métier contextuelles
    contextualRules: jsonb('contextual_rules').$type<ContextualRules>().notNull(),

    // Données spécifiques aux randonnées
    trailData: jsonb('trail_data').$type<TrailMetadata>(),

    // Médias & Monétisation
    coverImageUrl: text('cover_image_url'),
    isSponsored: boolean('is_sponsored').default(false).notNull(),
    affiliateBookingUrl: text('affiliate_booking_url'),
    affiliateLabel: varchar('affiliate_label', { length: 100 }),

    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    communeCategoryIdx: index('idx_commune_category').on(table.communeSlug, table.category),
    coordsIdx: index('idx_coords').on(table.latitude, table.longitude),
    sponsoredIdx: index('idx_sponsored').on(table.isSponsored),
  })
);

// 2. Table des Événements de Marée
export const tideEvents = pgTable(
  'tide_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    harbor: varchar('harbor', { length: 50 }).notNull(), // 'PORT_NAVALO' | 'VANNES'
    eventType: varchar('event_type', { length: 10 }).notNull(), // 'HIGH' | 'LOW'
    eventTimestamp: timestamp('event_timestamp', { withTimezone: true }).notNull(),
    heightMeters: doublePrecision('height_meters').notNull(),
    coefficient: integer('coefficient'),
  },
  (table) => ({
    harborTimeIdx: index('idx_harbor_time').on(table.harbor, table.eventTimestamp),
  })
);

// 3. Table des Instantanés Météo
export const weatherSnapshots = pgTable('weather_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  sector: varchar('sector', { length: 50 }).notNull().unique(), // 'VANNES', 'ARRADON', 'SARZEAU', 'QUIBERON', 'ETEL'
  tempCelsius: doublePrecision('temp_celsius').notNull(),
  windSpeedKnots: doublePrecision('wind_speed_knots').notNull(),
  windDirectionDeg: integer('wind_direction_deg').notNull(),
  windCardinal: varchar('wind_cardinal', { length: 5 }).notNull(),
  weatherCode: integer('weather_code').notNull(),
  isRaining: boolean('is_raining').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Place = typeof places.$inferSelect;
export type NewPlace = typeof places.$inferInsert;
export type TideEvent = typeof tideEvents.$inferSelect;
export type WeatherSnapshot = typeof weatherSnapshots.$inferSelect;
```

- [ ] **Step 4: Écrire le test unitaire pour valider le schéma TypeScript et les métadonnées**

`tests/schema.test.ts` :
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { places, tideEvents, weatherSnapshots, categoryEnum, tideConstraintEnum } from '../src/db/schema';

test('Schema defines all expected tables and enums', () => {
  assert.ok(places, 'places table must be defined');
  assert.ok(tideEvents, 'tideEvents table must be defined');
  assert.ok(weatherSnapshots, 'weatherSnapshots table must be defined');

  assert.equal(categoryEnum.enumValues.length, 7);
  assert.equal(tideConstraintEnum.enumValues.length, 4);

  assert.ok(places.slug);
  assert.ok(places.latitude);
  assert.ok(places.longitude);
  assert.ok(places.contextualRules);
});
```

- [ ] **Step 5: Exécuter le test unitaire**

Run: `npm test`
Expected: Test PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add drizzle.config.ts src/db/index.ts src/db/schema.ts tests/schema.test.ts
git commit -m "feat: add Drizzle ORM schema, pg connection pool and schema unit tests"
```

---

### Task 4: Multi-Zone Seed Dataset (Golfe, Rhuys, Quiberon, Ria d'Étel)

**Files:**
- Create: `src/db/seed-data.ts`
- Create: `src/db/seed.ts`
- Test: `tests/seed-data.test.ts`

**Interfaces:**
- Produces: 20+ lieux de référence couvrant les 4 zones avec géolocalisation et règles contextuelles réalistes, événements de marée 48h et météo.

- [ ] **Step 1: Écrire le test unitaire de validation du jeu de données (tests/seed-data.test.ts)**

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { seedPlaces, seedTides, seedWeather } from '../src/db/seed-data';

test('Seed places count and zone distribution', () => {
  assert.ok(seedPlaces.length >= 20, `Expected at least 20 places, got ${seedPlaces.length}`);

  const sectors = new Set(seedPlaces.map((p) => p.sector));
  assert.ok(sectors.has('Golfe'), 'Must contain Golfe places');
  assert.ok(sectors.has('Presqu-ile de Rhuys'), 'Must contain Rhuys places');
  assert.ok(sectors.has('Presqu-ile de Quiberon'), 'Must contain Quiberon places');
  assert.ok(sectors.has('Ria d-Etel'), 'Must contain Ria d-Etel places');

  // Coordonnées géographiques dans le Morbihan Sud (Lat: 47.45 à 47.75, Lng: -3.25 à -2.60)
  for (const place of seedPlaces) {
    assert.ok(place.latitude >= 47.45 && place.latitude <= 47.75, `Invalid lat for ${place.name}: ${place.latitude}`);
    assert.ok(place.longitude >= -3.25 && place.longitude <= -2.60, `Invalid lng for ${place.name}: ${place.longitude}`);
    assert.ok(place.slug.length > 0);
    assert.ok(place.contextualRules.tideConstraint);
  }
});

test('Seed tides include Port-Navalo and Vannes', () => {
  const harbors = new Set(seedTides.map((t) => t.harbor));
  assert.ok(harbors.has('PORT_NAVALO'));
  assert.ok(harbors.has('VANNES'));
  assert.ok(seedTides.length >= 8, 'Expected at least 8 tide events for 48h');
});

test('Seed weather covers 5 strategic zones', () => {
  assert.equal(seedWeather.length, 5);
});
```

- [ ] **Step 2: Créer src/db/seed-data.ts avec les 20+ lieux réalistes**

`src/db/seed-data.ts` :
```typescript
import type { ContextualRules, TrailMetadata } from './schema';

export interface SeedPlace {
  slug: string;
  name: string;
  shortDescription: string;
  fullDescription: string;
  category: 'BEACH' | 'TRAIL' | 'TIDAL_PASSAGE' | 'HERITAGE' | 'GASTRONOMY' | 'NAUTICAL' | 'VIEWPOINT';
  commune: string;
  communeSlug: string;
  sector: 'Golfe' | 'Presqu-ile de Rhuys' | 'Presqu-ile de Quiberon' | 'Ria d-Etel';
  latitude: number;
  longitude: number;
  parkingLat: number;
  parkingLng: number;
  contextualRules: ContextualRules;
  trailData?: TrailMetadata;
  coverImageUrl?: string;
  isSponsored: boolean;
  affiliateBookingUrl?: string;
  affiliateLabel?: string;
}

export const seedPlaces: SeedPlace[] = [
  // --- 1. GOLFE FERMÉ ---
  {
    slug: 'passage-ile-de-berder',
    name: 'Chaussée submersible de l\'Île de Berder',
    shortDescription: 'Passage submersible mythique vers l\'île de Berder, accessible uniquement à marée basse.',
    fullDescription: 'Le passage de Berder relie Larmor-Baden à l\'île de Berder par un gois pavé submersible de 80 mètres. Attention au courant violent de la Jument lors de la remontée des eaux.',
    category: 'TIDAL_PASSAGE',
    commune: 'Larmor-Baden',
    communeSlug: 'larmor-baden',
    sector: 'Golfe',
    latitude: 47.5792,
    longitude: -2.8856,
    parkingLat: 47.5815,
    parkingLng: -2.8872,
    contextualRules: {
      tideConstraint: 'LOW_TIDE_ONLY',
      tideOffsetHours: { beforeLow: 2, afterLow: 2 },
      minWaterHeightMeters: 1.2,
      dogsAllowedSummer: true,
      strollerFriendly: false,
      rainFriendly: false,
    },
    isSponsored: false,
  },
  {
    slug: 'plage-de-toulindac-arradon',
    name: 'Plage de Toulindac',
    shortDescription: 'Plage familiale bordée de pins face à l\'Île d\'Irus, base nautique d\'Arradon.',
    fullDescription: 'Plage emblématique d\'Arradon offrant une vue imprenable sur les îles du Golfe. Baignade optimale à marée haute. Nombreux mouillages et école de voile.',
    category: 'BEACH',
    commune: 'Arradon',
    communeSlug: 'arradon',
    sector: 'Golfe',
    latitude: 47.6189,
    longitude: -2.8274,
    parkingLat: 47.6201,
    parkingLng: -2.8265,
    contextualRules: {
      tideConstraint: 'HIGH_TIDE_ONLY',
      tideOffsetHours: { beforeHigh: 2.5, afterHigh: 2.5 },
      shelteredFromWindDirections: ['N', 'NE', 'NW'],
      dogsAllowedSummer: false,
      strollerFriendly: true,
      rainFriendly: false,
    },
    isSponsored: false,
    affiliateBookingUrl: 'https://example.com/kayak-arradon',
    affiliateLabel: 'Louer un paddle / kayak',
  },
  {
    slug: 'presqu-ile-de-conleau-vannes',
    name: 'Presqu\'île et Piscine de Conleau',
    shortDescription: 'Piscine naturelle d\'eau de mer et pinède aux portes de Vannes.',
    fullDescription: 'Véritable petit village maritime avec ses chalets colorés, son bassin de baignade submersible et le départ des navettes fluviales vers le Golfe.',
    category: 'BEACH',
    commune: 'Vannes',
    communeSlug: 'vannes',
    sector: 'Golfe',
    latitude: 47.6322,
    longitude: -2.7761,
    parkingLat: 47.6335,
    parkingLng: -2.7742,
    contextualRules: {
      tideConstraint: 'ALL_TIDES', // Grâce à la piscine d'eau de mer
      shelteredFromWindDirections: ['E', 'SE', 'NE'],
      dogsAllowedSummer: false,
      strollerFriendly: true,
      rainFriendly: false,
    },
    isSponsored: false,
  },
  {
    slug: 'sentier-tour-ile-aux-moines',
    name: 'Grand Tour de l\'Île-aux-Moines (GR34)',
    shortDescription: '17 km de sentier littoral entre cales, pointes panoramiques et bois d\'amour.',
    fullDescription: 'La perle du Golfe se découvre à pied. De la pointe du Trec\'h à la pointe de Nioul face à la presqu\'île de Rhuys, une immersion maritime totale.',
    category: 'TRAIL',
    commune: 'Île-aux-Moines',
    communeSlug: 'ile-aux-moines',
    sector: 'Golfe',
    latitude: 47.5968,
    longitude: -2.8432,
    parkingLat: 47.5878, // Port-Blanc Baden (embarcadère)
    parkingLng: -2.8631,
    contextualRules: {
      tideConstraint: 'ALL_TIDES',
      dogsAllowedSummer: true,
      strollerFriendly: false,
      rainFriendly: false,
    },
    trailData: {
      distanceKm: 16.8,
      elevationGainM: 95,
      durationMinutes: 260,
      difficulty: 'MEDIUM',
      isLoop: true,
      geojsonTrack: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: [
            [-2.8432, 47.5968],
            [-2.8395, 47.5852],
            [-2.8481, 47.5714],
            [-2.8432, 47.5968],
          ],
        },
      },
      elevationProfile: [
        { distKm: 0, altM: 5 },
        { distKm: 5, altM: 22 },
        { distKm: 10, altM: 14 },
        { distKm: 16.8, altM: 5 },
      ],
    },
    isSponsored: true,
    affiliateBookingUrl: 'https://example.com/traversee-ile-aux-moines',
    affiliateLabel: 'Horaires & billets navette maritime',
  },
  {
    slug: 'courant-de-la-jument-port-blanc',
    name: 'Belvédère du Courant de la Jument',
    shortDescription: 'Deuxième courant de marée le plus puissant d\'Europe (jusqu\'à 9 nœuds).',
    fullDescription: 'Spectacle naturel grandiose entre l\'Île de Berder et l\'Île de la Jument. Les marmites de bouillonnement et tourbillons sont saisissants à mi-marée.',
    category: 'VIEWPOINT',
    commune: 'Baden',
    communeSlug: 'baden',
    sector: 'Golfe',
    latitude: 47.5862,
    longitude: -2.8789,
    parkingLat: 47.5881,
    parkingLng: -2.8765,
    contextualRules: {
      tideConstraint: 'MID_TIDE_FLOW',
      dogsAllowedSummer: true,
      strollerFriendly: true,
      rainFriendly: true,
    },
    isSponsored: false,
  },
  {
    slug: 'plage-des-sept-iles-baden',
    name: 'Plage et Cordon de sable des 7 Îles',
    shortDescription: 'Tombolo de sable reliant le continent à l\'îlot des 7 Îles à marée basse.',
    fullDescription: 'Superbe anse naturelle abritée. Possibilité de passer sur l\'île à pied par le tombolo selon le coefficient de marée.',
    category: 'BEACH',
    commune: 'Baden',
    communeSlug: 'baden',
    sector: 'Golfe',
    latitude: 47.5985,
    longitude: -2.9038,
    parkingLat: 47.6012,
    parkingLng: -2.9015,
    contextualRules: {
      tideConstraint: 'ALL_TIDES',
      shelteredFromWindDirections: ['W', 'NW', 'N'],
      dogsAllowedSummer: false,
      strollerFriendly: false,
      rainFriendly: false,
    },
    isSponsored: false,
  },

  // --- 2. PRESQU'ÎLE DE RHUYS ---
  {
    slug: 'passage-ile-tascon-saint-armel',
    name: 'Passage submersible de l\'Île Tascon',
    shortDescription: 'Chaussée submersible reliant Saint-Armel à la seule île agricole du Golfe.',
    fullDescription: 'Le passage se dévoile à marée basse sur 400 mètres au milieu des parcs à huîtres et des vasières peuplées d\'aigrettes et bernaches cravants.',
    category: 'TIDAL_PASSAGE',
    commune: 'Saint-Armel',
    communeSlug: 'saint-armel',
    sector: 'Presqu-ile de Rhuys',
    latitude: 47.5758,
    longitude: -2.7189,
    parkingLat: 47.5742,
    parkingLng: -2.7135,
    contextualRules: {
      tideConstraint: 'LOW_TIDE_ONLY',
      tideOffsetHours: { beforeLow: 2, afterLow: 2 },
      minWaterHeightMeters: 1.5,
      dogsAllowedSummer: true,
      strollerFriendly: false,
      rainFriendly: false,
    },
    isSponsored: false,
  },
  {
    slug: 'phare-et-rade-de-port-navalo',
    name: 'Phare et Cale de Port-Navalo',
    shortDescription: 'La sentinelle du Golfe du Morbihan ouvrant sur l\'Océan Atlantique.',
    fullDescription: 'Port de référence officiel des marées du Golfe. Panorama exceptionnel sur Locmariaquer et la sortie du Golfe. Point de départ des navettes insulaires.',
    category: 'NAUTICAL',
    commune: 'Arzon',
    communeSlug: 'arzon',
    sector: 'Presqu-ile de Rhuys',
    latitude: 47.5492,
    longitude: -2.9189,
    parkingLat: 47.5481,
    parkingLng: -2.9152,
    contextualRules: {
      tideConstraint: 'ALL_TIDES',
      dogsAllowedSummer: true,
      strollerFriendly: true,
      rainFriendly: true,
    },
    isSponsored: true,
    affiliateBookingUrl: 'https://example.com/croisiere-port-navalo',
    affiliateLabel: 'Réserver croisière découverte',
  },
  {
    slug: 'plage-du-fogeo-arzon',
    name: 'Grande Plage du Fogeo',
    shortDescription: 'Vaste étendue de sable fin océanique face à Houat et Belle-Île.',
    fullDescription: 'Plage familiale surveillée en saison estivale, proche du port du Crouesty. Idéale pour la baignade à toute heure de marée.',
    category: 'BEACH',
    commune: 'Arzon',
    communeSlug: 'arzon',
    sector: 'Presqu-ile de Rhuys',
    latitude: 47.5385,
    longitude: -2.8942,
    parkingLat: 47.5401,
    parkingLng: -2.8928,
    contextualRules: {
      tideConstraint: 'ALL_TIDES',
      shelteredFromWindDirections: ['N', 'NE', 'E'],
      dogsAllowedSummer: false,
      strollerFriendly: true,
      rainFriendly: false,
    },
    isSponsored: false,
  },
  {
    slug: 'domaine-chateau-de-suscinio',
    name: 'Château fort et Marais de Suscinio',
    shortDescription: 'Forteresse médiévale des Ducs de Bretagne posée entre marais et océan.',
    fullDescription: 'Monument historique majeur du XIIIe siècle entouré de sentiers pédestres d\'observation ornithologique et accès direct à la grande plage de Suscinio.',
    category: 'HERITAGE',
    commune: 'Sarzeau',
    communeSlug: 'sarzeau',
    sector: 'Presqu-ile de Rhuys',
    latitude: 47.5142,
    longitude: -2.7789,
    parkingLat: 47.5161,
    parkingLng: -2.7798,
    contextualRules: {
      tideConstraint: 'ALL_TIDES',
      dogsAllowedSummer: true,
      strollerFriendly: true,
      rainFriendly: true,
    },
    isSponsored: false,
  },
  {
    slug: 'pointe-et-crique-de-bilgroix',
    name: 'Pointe et Crique de Bilgroix',
    shortDescription: 'Crique sauvage abritée avec vue frontale sur le goulet d\'étranglement du Golfe.',
    fullDescription: 'À la sortie de Port-Navalo, Bilgroix offre une petite plage de sable doré bien abritée du vent d\'ouest et un panorama impressionnant sur les courants.',
    category: 'BEACH',
    commune: 'Arzon',
    communeSlug: 'arzon',
    sector: 'Presqu-ile de Rhuys',
    latitude: 47.5548,
    longitude: -2.9112,
    parkingLat: 47.5535,
    parkingLng: -2.9095,
    contextualRules: {
      tideConstraint: 'HIGH_TIDE_ONLY',
      tideOffsetHours: { beforeHigh: 2, afterHigh: 2 },
      shelteredFromWindDirections: ['W', 'SW', 'NW'],
      dogsAllowedSummer: false,
      strollerFriendly: false,
      rainFriendly: false,
    },
    isSponsored: false,
  },

  // --- 3. PRESQU'ÎLE DE QUIBERON ---
  {
    slug: 'cote-sauvage-port-bara',
    name: 'Côte Sauvage - Crique de Port Bara',
    shortDescription: 'Falaises escarpées, gouffres marins et rouleaux de l\'Atlantique.',
    fullDescription: 'Le joyau minéral de Quiberon. Baignade formellement interdite en raison des lames de fond, mais balade grandiose sur le GR34 et crique de contemplation.',
    category: 'VIEWPOINT',
    commune: 'Saint-Pierre-Quiberon',
    communeSlug: 'saint-pierre-quiberon',
    sector: 'Presqu-ile de Quiberon',
    latitude: 47.5218,
    longitude: -3.1512,
    parkingLat: 47.5225,
    parkingLng: -3.1482,
    contextualRules: {
      tideConstraint: 'ALL_TIDES',
      dogsAllowedSummer: true,
      strollerFriendly: false,
      rainFriendly: false,
    },
    isSponsored: false,
  },
  {
    slug: 'grande-plage-de-quiberon',
    name: 'Grande Plage de Quiberon',
    shortDescription: '900 mètres de sable fin orientés plein Sud face à Belle-Île.',
    fullDescription: 'Plage urbaine par excellence le long de la promenade du front de mer. Idéale pour les familles, clubs enfants et restaurants de plage.',
    category: 'BEACH',
    commune: 'Quiberon',
    communeSlug: 'quiberon',
    sector: 'Presqu-ile de Quiberon',
    latitude: 47.4812,
    longitude: -3.1215,
    parkingLat: 47.4831,
    parkingLng: -3.1205,
    contextualRules: {
      tideConstraint: 'ALL_TIDES',
      shelteredFromWindDirections: ['N', 'NW', 'NE'],
      dogsAllowedSummer: false,
      strollerFriendly: true,
      rainFriendly: false,
    },
    isSponsored: false,
  },
  {
    slug: 'pointe-du-conguel-quiberon',
    name: 'Pointe du Conguel',
    shortDescription: 'L\'extrémité sud de la presqu\'île face au phare de la Teignouse.',
    fullDescription: 'Espace naturel remarquable géré par le Conservatoire du Littoral. Vestiges de fours à varech et sentier d\'interprétation pédestre.',
    category: 'TRAIL',
    commune: 'Quiberon',
    communeSlug: 'quiberon',
    sector: 'Presqu-ile de Quiberon',
    latitude: 47.4698,
    longitude: -3.0982,
    parkingLat: 47.4721,
    parkingLng: -3.1015,
    contextualRules: {
      tideConstraint: 'ALL_TIDES',
      dogsAllowedSummer: true,
      strollerFriendly: true,
      rainFriendly: false,
    },
    trailData: {
      distanceKm: 2.4,
      elevationGainM: 10,
      durationMinutes: 45,
      difficulty: 'EASY',
      isLoop: true,
      geojsonTrack: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: [
            [-3.1015, 47.4721],
            [-3.0982, 47.4698],
            [-3.0945, 47.4712],
            [-3.1015, 47.4721],
          ],
        },
      },
      elevationProfile: [
        { distKm: 0, altM: 2 },
        { distKm: 1.2, altM: 6 },
        { distKm: 2.4, altM: 2 },
      ],
    },
    isSponsored: false,
  },
  {
    slug: 'plage-des-sables-blancs-penthievre',
    name: 'Plage des Sables Blancs (Baie de Quiberon)',
    shortDescription: 'Côté baie de l\'isthme de Penthièvre, plan d\'eau calme et école de kitesurf.',
    fullDescription: 'À l\'exact opposé des déferlantes de l\'océan, les Sables Blancs offrent des eaux protégées idéales pour le char à voile, le wingfoil et les tout-petits.',
    category: 'BEACH',
    commune: 'Saint-Pierre-Quiberon',
    communeSlug: 'saint-pierre-quiberon',
    sector: 'Presqu-ile de Quiberon',
    latitude: 47.5528,
    longitude: -3.1315,
    parkingLat: 47.5541,
    parkingLng: -3.1328,
    contextualRules: {
      tideConstraint: 'ALL_TIDES',
      shelteredFromWindDirections: ['W', 'SW', 'NW'],
      dogsAllowedSummer: false,
      strollerFriendly: true,
      rainFriendly: false,
    },
    isSponsored: false,
  },

  // --- 4. RIA D'ÉTEL ---
  {
    slug: 'ilot-de-saint-cado-belz',
    name: 'Îlot et Maison de Saint-Cado',
    shortDescription: 'La célèbre maison de Nichtarguér sur les eaux calmes de la ria d\'Étel.',
    fullDescription: 'Carte postale emblématique de la Bretagne sud. Accessible par un pont de pierre du XVIIIe siècle, tour de l\'îlot et chapelle romane avec calvaire.',
    category: 'HERITAGE',
    commune: 'Belz',
    communeSlug: 'belz',
    sector: 'Ria d-Etel',
    latitude: 47.6835,
    longitude: -3.1895,
    parkingLat: 47.6815,
    parkingLng: -3.1865,
    contextualRules: {
      tideConstraint: 'ALL_TIDES',
      dogsAllowedSummer: true,
      strollerFriendly: true,
      rainFriendly: true,
    },
    isSponsored: true,
    affiliateBookingUrl: 'https://example.com/degustation-huitres-saint-cado',
    affiliateLabel: 'Dégustation d\'huîtres sur la ria',
  },
  {
    slug: 'la-barre-d-etel-semaphore',
    name: 'La Barre d\'Étel et Plage du Sémaphore',
    shortDescription: 'Banc de sable sous-marin mouvant redouté des marins et sémaphore historique.',
    fullDescription: 'Lieu mythique où la ria rencontre l\'océan. La Barre provoque des déferlantes impressionnantes. Baignade interdite dans le goulet, surveillée sur la plage océane attenante.',
    category: 'VIEWPOINT',
    commune: 'Plouhinec',
    communeSlug: 'plouhinec',
    sector: 'Ria d-Etel',
    latitude: 47.6432,
    longitude: -3.2095,
    parkingLat: 47.6445,
    parkingLng: -3.2065,
    contextualRules: {
      tideConstraint: 'ALL_TIDES',
      dogsAllowedSummer: true,
      strollerFriendly: true,
      rainFriendly: false,
    },
    isSponsored: false,
  },
  {
    slug: 'plage-du-magouer-plouhinec',
    name: 'Plage sauvage du Magouër',
    shortDescription: 'Dunes préservées et cale de mise à l\'eau face au port d\'Étel.',
    fullDescription: 'Plage océanique immense bordée par le massif dunaire d\'Erdeven-Gâvres. Havre de tranquillité avec vue sur le chenal d\'Étel.',
    category: 'BEACH',
    commune: 'Plouhinec',
    communeSlug: 'plouhinec',
    sector: 'Ria d-Etel',
    latitude: 47.6485,
    longitude: -3.2185,
    parkingLat: 47.6512,
    parkingLng: -3.2145,
    contextualRules: {
      tideConstraint: 'ALL_TIDES',
      shelteredFromWindDirections: ['E', 'NE'],
      dogsAllowedSummer: true,
      strollerFriendly: false,
      rainFriendly: false,
    },
    isSponsored: false,
  },
  {
    slug: 'plage-de-kerhillio-erdeven',
    name: 'Grande Plage de Kerhillio',
    shortDescription: 'Plage de sable fin de plusieurs kilomètres face à la presqu\'île de Quiberon.',
    fullDescription: 'Haut lieu des sports de glisse (kitesurf, surf, char à voile) avec zone de baignade surveillée en été et pente douce idéale pour les enfants.',
    category: 'BEACH',
    commune: 'Erdeven',
    communeSlug: 'erdeven',
    sector: 'Ria d-Etel',
    latitude: 47.6185,
    longitude: -3.1585,
    parkingLat: 47.6212,
    parkingLng: -3.1552,
    contextualRules: {
      tideConstraint: 'ALL_TIDES',
      shelteredFromWindDirections: ['N', 'NE', 'E'],
      dogsAllowedSummer: false,
      strollerFriendly: true,
      rainFriendly: false,
    },
    isSponsored: false,
  },
  {
    slug: 'port-et-glaciere-d-etel',
    name: 'Port et Musée de la Pêche d\'Étel',
    shortDescription: 'Ancien premier port thonier de France et quais pittoresques de la Ria.',
    fullDescription: 'Flânerie le long des quais, terrasses de cafés face aux bateaux de pêche et visite du musée de la Criée historique.',
    category: 'GASTRONOMY',
    commune: 'Étel',
    communeSlug: 'etel',
    sector: 'Ria d-Etel',
    latitude: 47.6568,
    longitude: -3.2012,
    parkingLat: 47.6575,
    parkingLng: -3.1995,
    contextualRules: {
      tideConstraint: 'ALL_TIDES',
      dogsAllowedSummer: true,
      strollerFriendly: true,
      rainFriendly: true,
    },
    isSponsored: false,
  },
];

export const seedTides = [
  // Port-Navalo (Entrée du Golfe) - Cycle 48h
  {
    harbor: 'PORT_NAVALO',
    eventType: 'HIGH',
    eventTimestamp: new Date('2026-10-21T05:12:00Z'),
    heightMeters: 4.85,
    coefficient: 74,
  },
  {
    harbor: 'PORT_NAVALO',
    eventType: 'LOW',
    eventTimestamp: new Date('2026-10-21T11:34:00Z'),
    heightMeters: 1.12,
    coefficient: null,
  },
  {
    harbor: 'PORT_NAVALO',
    eventType: 'HIGH',
    eventTimestamp: new Date('2026-10-21T17:42:00Z'),
    heightMeters: 5.02,
    coefficient: 78,
  },
  {
    harbor: 'PORT_NAVALO',
    eventType: 'LOW',
    eventTimestamp: new Date('2026-10-21T23:58:00Z'),
    heightMeters: 1.05,
    coefficient: null,
  },
  // Vannes (Fond du Golfe - décalage de ~1h45)
  {
    harbor: 'VANNES',
    eventType: 'HIGH',
    eventTimestamp: new Date('2026-10-21T06:55:00Z'),
    heightMeters: 4.25,
    coefficient: 74,
  },
  {
    harbor: 'VANNES',
    eventType: 'LOW',
    eventTimestamp: new Date('2026-10-21T13:20:00Z'),
    heightMeters: 1.45,
    coefficient: null,
  },
  {
    harbor: 'VANNES',
    eventType: 'HIGH',
    eventTimestamp: new Date('2026-10-21T19:25:00Z'),
    heightMeters: 4.40,
    coefficient: 78,
  },
  {
    harbor: 'VANNES',
    eventType: 'LOW',
    eventTimestamp: new Date('2026-10-22T01:45:00Z'),
    heightMeters: 1.35,
    coefficient: null,
  },
];

export const seedWeather = [
  {
    sector: 'VANNES',
    tempCelsius: 18.5,
    windSpeedKnots: 11.2,
    windDirectionDeg: 315,
    windCardinal: 'NW',
    weatherCode: 1, // Ensoleillé / Voilé
    isRaining: false,
  },
  {
    sector: 'ARRADON',
    tempCelsius: 19.0,
    windSpeedKnots: 12.0,
    windDirectionDeg: 320,
    windCardinal: 'NW',
    weatherCode: 1,
    isRaining: false,
  },
  {
    sector: 'SARZEAU',
    tempCelsius: 18.2,
    windSpeedKnots: 14.5,
    windDirectionDeg: 310,
    windCardinal: 'NW',
    weatherCode: 2,
    isRaining: false,
  },
  {
    sector: 'QUIBERON',
    tempCelsius: 17.0,
    windSpeedKnots: 17.8,
    windDirectionDeg: 300,
    windCardinal: 'W',
    weatherCode: 3,
    isRaining: false,
  },
  {
    sector: 'ETEL',
    tempCelsius: 17.8,
    windSpeedKnots: 15.2,
    windDirectionDeg: 310,
    windCardinal: 'NW',
    weatherCode: 2,
    isRaining: false,
  },
];
```

- [ ] **Step 3: Créer src/db/seed.ts pour insérer les données en base avec idempotence**

`src/db/seed.ts` :
```typescript
import { db, pool } from './index';
import { places, tideEvents, weatherSnapshots } from './schema';
import { seedPlaces, seedTides, seedWeather } from './seed-data';

async function runSeed() {
  console.log('🌊 Démarrage du seed pour le Guide Morbihan...');

  // 1. Insertion des Lieux (places)
  console.log(`📍 Insertion de ${seedPlaces.length} lieux de référence...`);
  for (const place of seedPlaces) {
    await db
      .insert(places)
      .values(place)
      .onConflictDoUpdate({
        target: places.slug,
        set: {
          name: place.name,
          shortDescription: place.shortDescription,
          fullDescription: place.fullDescription,
          category: place.category,
          commune: place.commune,
          communeSlug: place.communeSlug,
          sector: place.sector,
          latitude: place.latitude,
          longitude: place.longitude,
          parkingLat: place.parkingLat,
          parkingLng: place.parkingLng,
          contextualRules: place.contextualRules,
          trailData: place.trailData,
          isSponsored: place.isSponsored,
          affiliateBookingUrl: place.affiliateBookingUrl,
          affiliateLabel: place.affiliateLabel,
          updatedAt: new Date(),
        },
      });
  }
  console.log('✅ Lieux insérés avec succès.');

  // 2. Insertion des Événements de Marée
  console.log(`⏱️ Insertion de ${seedTides.length} événements de marées...`);
  for (const tide of seedTides) {
    await db.insert(tideEvents).values(tide);
  }
  console.log('✅ Événements de marée insérés.');

  // 3. Insertion des Instantanés Météo
  console.log(`⛅ Insertion de ${seedWeather.length} instantanés météo...`);
  for (const weather of seedWeather) {
    await db
      .insert(weatherSnapshots)
      .values(weather)
      .onConflictDoUpdate({
        target: weatherSnapshots.sector,
        set: {
          tempCelsius: weather.tempCelsius,
          windSpeedKnots: weather.windSpeedKnots,
          windDirectionDeg: weather.windDirectionDeg,
          windCardinal: weather.windCardinal,
          weatherCode: weather.weatherCode,
          isRaining: weather.isRaining,
          updatedAt: new Date(),
        },
      });
  }
  console.log('✅ Instantanés météo insérés.');

  console.log('🎉 Seed multi-zones terminé avec succès !');
}

runSeed()
  .catch((err) => {
    console.error('❌ Erreur lors du seed :', err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
```

- [ ] **Step 4: Exécuter le test unitaire sur les données de seed**

Run: `npm test`
Expected: PASS sur `tests/schema.test.ts` et `tests/seed-data.test.ts`.

- [ ] **Step 5: Commit Task 4**

```bash
git add src/db/seed-data.ts src/db/seed.ts tests/seed-data.test.ts
git commit -m "feat: add multi-zone seed dataset covering Golfe, Rhuys, Quiberon and Ria d'Etel"
```

---

### Task 5: End-to-End Build & Validation Check

**Files:**
- Modify: `package.json` (vérification scripts)
- Create: `tests/standalone-output.test.ts`

**Interfaces:**
- Produces: Vérification complète que l'application compile en mode `standalone` et que Drizzle Kit génère les migrations sans erreur.

- [ ] **Step 1: Créer le test d'intégrité de compilation**

`tests/standalone-output.test.ts` :
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Project critical configuration files exist', () => {
  assert.ok(fs.existsSync(path.resolve('next.config.ts')));
  assert.ok(fs.existsSync(path.resolve('drizzle.config.ts')));
  assert.ok(fs.existsSync(path.resolve('Dockerfile')));
  assert.ok(fs.existsSync(path.resolve('docker-compose.yml')));
  assert.ok(fs.existsSync(path.resolve('.env.example')));
});
```

- [ ] **Step 2: Exécuter l'ensemble des tests unitaires**

Run: `npm test`
Expected: Tous les tests passent.

- [ ] **Step 3: Exécuter le build Next.js complet**

Run: `npm run build`
Expected: Build compilé avec succès sans warning bloquant, dossier `.next/standalone` généré.

- [ ] **Step 4: Commit Task 5**

```bash
git add tests/standalone-output.test.ts
git commit -m "test: add configuration verification tests and validate standalone build"
```
