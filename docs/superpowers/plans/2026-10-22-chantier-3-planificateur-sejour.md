# Chantier 3 : Générateur d'Escapades Intelligentes Morbihan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire un générateur d'escapades (1 à 3 jours) 100% Morbihan, résolvant les 3 contraintes locales dures (anti-bouchons par secteur, ancrage marée strict via `tide-engine.ts`, 4 blocs de vie souples sans horaires rigides), avec mode pluie 1-clic et swap de spots.

**Architecture:** Moteur déterministe pur en mémoire (`escapade-engine.ts`) exploitant la table `places` et `curated-spots.json`, wizard mobile 3 étapes, interface responsive avec cartes de moments de vie (`vaul`), et persistance locale avec partage de lien léger.

**Tech Stack:** Next.js 15, TypeScript strict, Drizzle ORM, Tailwind CSS, Vaul Drawer, Lucide icons, `tsx --test`.

**Spec:** [`docs/superpowers/specs/2026-10-22-chantier-3-planificateur-sejour-design.md`](file:///Users/Moulitos/Documents/antigravity/Guide%20Morbihan/docs/superpowers/specs/2026-10-22-chantier-3-planificateur-sejour-design.md)

## Global Constraints
- 100% centré Morbihan : aucune table de territoire superflue, réutilisation stricte de `places.sector` (`'Golfe'`, `'Presqu-ile de Rhuys'`, `'Presqu-ile de Quiberon'`, `'Ria d-Etel'`).
- Pas d'horaires rigides (09h30, 11h15) : organisation par 4 moments naturels (Matinée, Déjeuner, Après-midi marée, Fin de journée).
- Zéro régression sur les 169 tests existants.
- Exécution du moteur < 20 ms en mémoire.

---

### Task 1: Moteur d'Escapade Déterministe & Types de Domaine

**Files:**
- Create: `src/lib/escapade/types.ts`
- Create: `src/lib/escapade/engine.ts`
- Test: `tests/escapade-engine.test.ts`

**Interfaces:**
- Consumes: `places` (ou `curated-spots.json`), `calculateDayTides` de `src/lib/tide-engine.ts`
- Produces: `generateEscapade(profile, placesPool, targetDate): EscapadePlan`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/escapade-engine.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateEscapade } from '../src/lib/escapade/engine';
import type { EscapadeProfile } from '../src/lib/escapade/types';

const mockPlaces = [
  {
    id: 'p1',
    slug: 'chateau-suscinio',
    name: 'Château de Suscinio',
    category: 'HERITAGE',
    sector: 'Presqu-ile de Rhuys',
    commune: 'Sarzeau',
    latitude: 47.53,
    longitude: -2.72,
    shortDescription: 'Forteresse ducale',
    contextualRules: { tideConstraint: 'ALL_TIDES', rainFriendly: true, strollerFriendly: true, dogsAllowedSummer: false },
  },
  {
    id: 'p2',
    slug: 'plage-landrezac',
    name: 'Plage de Landrezac',
    category: 'BEACH',
    sector: 'Presqu-ile de Rhuys',
    commune: 'Sarzeau',
    latitude: 47.51,
    longitude: -2.71,
    shortDescription: 'Grande plage familiale',
    contextualRules: { tideConstraint: 'HIGH_TIDE_ONLY', rainFriendly: false, strollerFriendly: true, dogsAllowedSummer: false },
  },
  {
    id: 'p3',
    slug: 'chantier-ostreicole-tour-du-parc',
    name: 'Chantier ostréicole du Tour-du-Parc',
    category: 'GASTRONOMY',
    sector: 'Presqu-ile de Rhuys',
    commune: 'Le Tour-du-Parc',
    latitude: 47.52,
    longitude: -2.65,
    shortDescription: 'Dégustation d’huîtres face au golfe',
    contextualRules: { tideConstraint: 'ALL_TIDES', rainFriendly: true, strollerFriendly: true, dogsAllowedSummer: true },
  },
  {
    id: 'p4',
    slug: 'pointe-bilgroix',
    name: 'Pointe de Bilgroix',
    category: 'VIEWPOINT',
    sector: 'Presqu-ile de Rhuys',
    commune: 'Arzon',
    latitude: 47.55,
    longitude: -2.89,
    shortDescription: 'Panorama coucher de soleil sur le goulet',
    contextualRules: { tideConstraint: 'ALL_TIDES', rainFriendly: false, strollerFriendly: true, dogsAllowedSummer: true },
  },
];

test('generateEscapade produces 1-day plan with 4 natural moments in same sector', () => {
  const profile: EscapadeProfile = {
    baseSector: 'Presqu-ile de Rhuys',
    durationDays: 1,
    profileType: 'FAMILY',
  };

  const plan = generateEscapade(profile, mockPlaces as any, new Date('2026-07-15T10:00:00Z'));

  assert.strictEqual(plan.days.length, 1, 'Must have 1 day');
  assert.strictEqual(plan.days[0].sector, 'Presqu-ile de Rhuys', 'Day sector must match baseSector');
  assert.strictEqual(plan.days[0].moments.length, 4, 'Must have 4 natural moments');
  
  const [matin, midi, aprem, soir] = plan.days[0].moments;
  assert.strictEqual(matin.momentType, 'MATIN');
  assert.strictEqual(midi.momentType, 'DEJEUNER');
  assert.strictEqual(aprem.momentType, 'APRES_MIDI');
  assert.strictEqual(soir.momentType, 'FIN_JOURNEE');
  
  assert.ok(matin.place, 'Morning moment must have a place');
  assert.ok(midi.place, 'Lunch moment must have a place');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with module not found

- [ ] **Step 3: Implement `src/lib/escapade/types.ts` and `src/lib/escapade/engine.ts`**

1. Dans `types.ts` :
   - `BaseSector = 'Golfe' | 'Presqu-ile de Rhuys' | 'Presqu-ile de Quiberon' | 'Ria d-Etel'`
   - `ProfileType = 'FAMILY' | 'NATURE' | 'HERITAGE_GOURMET'`
   - `MomentType = 'MATIN' | 'DEJEUNER' | 'APRES_MIDI' | 'FIN_JOURNEE'`
   - `EscapadeMoment = { momentType, title, place, alternatives: Place[], tideNotice? }`
   - `EscapadeDay = { dayIndex, date, sector, moments: EscapadeMoment[], tideSummary }`
   - `EscapadePlan = { id?, profile, days: EscapadeDay[] }`
2. Dans `engine.ts` :
   - Règle 1 (Anti-bouchons) : J1 = `baseSector`. Si 2-3 jours : rotation sur secteurs voisins logiques (ex: Rhuys puis Golfe puis Auray). 1 jour = 1 seul secteur.
   - Règle 2 (Marée) : utilise `getTideStatus` / `calculateDayTides`. Si marée haute l'après-midi, priorise `BEACH` sur `APRES_MIDI`. Si marée basse de fort coefficient, priorise passage submersible ou estran.
   - Règle 3 (4 moments de vie) : assigne Matin (balade/visite), Déjeuner (huîtres/crêperie), Après-midi (plage/marée), Fin de journée (coucher de soleil/terrasse).
   - Alternatives : chaque moment conserve jusqu'à 2 lieux remplaçants du même secteur.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/escapade/ tests/escapade-engine.test.ts
git commit -m "feat(escapade): implement deterministic escapade generator with 3 local constraints"
```

---

### Task 2: Mode Météo 1-Clic (« ☔ Il pleut ») & Swap de Spot

**Files:**
- Create: `src/lib/escapade/actions.ts`
- Test: `tests/escapade-actions.test.ts`

**Interfaces:**
- Consumes: `EscapadePlan`, `placesPool`
- Produces: `toggleDayRainMode(plan, dayIndex, placesPool): EscapadePlan` et `swapMomentPlace(plan, dayIndex, momentType, newPlaceId): EscapadePlan`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/escapade-actions.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toggleDayRainMode, swapMomentPlace } from '../src/lib/escapade/actions';
import type { EscapadePlan } from '../src/lib/escapade/types';

test('toggleDayRainMode replaces outdoor spots with rainFriendly spots in same sector', () => {
  const plan: EscapadePlan = {
    profile: { baseSector: 'Presqu-ile de Rhuys', durationDays: 1, profileType: 'FAMILY' },
    days: [
      {
        dayIndex: 1,
        date: '2026-07-15',
        sector: 'Presqu-ile de Rhuys',
        isRainMode: false,
        moments: [
          {
            momentType: 'APRES_MIDI',
            title: 'Après-midi marée',
            place: { id: 'p2', name: 'Plage', contextualRules: { rainFriendly: false } } as any,
            alternatives: [{ id: 'p1', name: 'Château Suscinio', contextualRules: { rainFriendly: true } }] as any,
          },
        ],
      },
    ],
  };

  const rainyPlan = toggleDayRainMode(plan, 1);
  assert.strictEqual(rainyPlan.days[0].isRainMode, true);
  assert.strictEqual(rainyPlan.days[0].moments[0].place.contextualRules.rainFriendly, true);
});

test('swapMomentPlace updates specific moment without altering other moments', () => {
  // test instant place replacement
  const plan: any = {
    days: [{ dayIndex: 1, moments: [{ momentType: 'MATIN', place: { id: 'p1', name: 'Spot 1' }, alternatives: [{ id: 'p2', name: 'Spot 2' }] }] }]
  };
  const updated = swapMomentPlace(plan, 1, 'MATIN', 'p2');
  assert.strictEqual(updated.days[0].moments[0].place.id, 'p2');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with module not found

- [ ] **Step 3: Implement `src/lib/escapade/actions.ts`**

Fonctions pures :
1. `toggleDayRainMode(plan, dayIndex)` : bascule `isRainMode`, filtre ou sélectionne parmi les alternatives les lieux avec `rainFriendly: true`.
2. `swapMomentPlace(plan, dayIndex, momentType, newPlaceId)` : échange le lieu actuel avec l'alternative choisie en conservant l'ancien lieu dans les alternatives.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/escapade/actions.ts tests/escapade-actions.test.ts
git commit -m "feat(escapade): add rain mode toggle and instant spot swap logic"
```

---

### Task 3: Wizard Express Mobile (3 questions / 15 secondes)

**Files:**
- Create: `src/components/escapade/EscapadeWizard.tsx`
- Test: `tests/escapade-wizard.test.tsx`

**Interfaces:**
- Consumes: `onGenerate: (profile: EscapadeProfile) => void`
- Produces: Composant tactile compact en 3 étapes rapides (Secteur hébergement, Durée 1j / 2-3j, Profil).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/escapade-wizard.test.tsx
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EscapadeWizard } from '../src/components/escapade/EscapadeWizard';

test('EscapadeWizard renders sector options and duration pills', () => {
  const html = renderToStaticMarkup(<EscapadeWizard onGenerate={() => {}} />);
  assert.ok(html.includes('Où logez-vous'), 'Must ask for base sector');
  assert.ok(html.includes('Presqu’île de Rhuys') || html.includes('Rhuys'), 'Must include Rhuys');
  assert.ok(html.includes('1 jour') || html.includes('Escapade 1 jour'), 'Must include duration');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with module not found

- [ ] **Step 3: Implement `EscapadeWizard.tsx`**

1. Étape 1 : Cartes tactiles des 4 secteurs (*Vannes & Golfe Nord*, *Presqu'île de Rhuys*, *Pays d'Auray*, *Quiberon & Carnac*).
2. Étape 2 : Pills durée (*1 jour*, *2-3 jours*).
3. Étape 3 : 3 profils ciblés (*Famille / Poussette*, *Balade & Nature sauvage*, *Patrimoine & Dégustation d'huîtres*).
4. Bouton final : *"Générer mon escapade"* (< 15 secondes de complétion).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/escapade/EscapadeWizard.tsx tests/escapade-wizard.test.tsx
git commit -m "feat(ui): add 15-second mobile escapade wizard"
```

---

### Task 4: Vue Escapade & Cartes des 4 Moments de Vie

**Files:**
- Create: `src/components/escapade/EscapadeMomentCard.tsx`
- Create: `src/components/escapade/EscapadeView.tsx`
- Test: `tests/escapade-view.test.tsx`

**Interfaces:**
- Consumes: `EscapadePlan`, handlers `onSwapPlace`, `onToggleRain`
- Produces: Écran complet avec onglets de jours, statut marée du jour, 4 cartes de moments de vie (sans horaires contraignants), tiroir de swap `vaul`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/escapade-view.test.tsx
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EscapadeView } from '../src/components/escapade/EscapadeView';

test('EscapadeView renders 4 life moments and rain toggle button', () => {
  const mockPlan: any = {
    profile: { baseSector: 'Presqu-ile de Rhuys', durationDays: 1, profileType: 'FAMILY' },
    days: [
      {
        dayIndex: 1,
        date: '2026-07-15',
        sector: 'Presqu-ile de Rhuys',
        isRainMode: false,
        moments: [
          { momentType: 'MATIN', title: 'Matinée iodée', place: { name: 'Suscinio', commune: 'Sarzeau' }, alternatives: [] },
          { momentType: 'DEJEUNER', title: 'Pause dégustation', place: { name: 'Chantier huîtres', commune: 'Le Tour' }, alternatives: [] },
          { momentType: 'APRES_MIDI', title: 'Après-midi marée', place: { name: 'Plage Landrezac', commune: 'Sarzeau' }, alternatives: [] },
          { momentType: 'FIN_JOURNEE', title: 'Coucher de soleil', place: { name: 'Pointe de Bilgroix', commune: 'Arzon' }, alternatives: [] },
        ],
      },
    ],
  };

  const html = renderToStaticMarkup(
    <EscapadeView plan={mockPlan} onSwap={() => {}} onToggleRain={() => {}} />
  );
  assert.ok(html.includes('Matinée iodée'), 'Renders morning moment');
  assert.ok(html.includes('Il pleut'), 'Renders rain toggle button');
  assert.ok(html.includes('Chantier huîtres'), 'Renders lunch spot');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with module not found

- [ ] **Step 3: Implement `EscapadeMomentCard.tsx` and `EscapadeView.tsx`**

1. `EscapadeMomentCard` : Affiche l'icône du moment (soleil levant, huître/couverts, vague/marée, coucher de soleil), le titre convivial du moment, le nom du lieu, sa commune, sa photo, son badge contextuel marée/abri, et les boutons `🔀 Remplacer` et `🚗 Y aller` (Maps/Waze).
2. `EscapadeView` :
   - En-tête avec bouton `☔ Il pleut` et `🔗 Partager`.
   - Bandeau d'onglets J1 / J2 / J3 avec le rappel de marée du jour.
   - Les 4 cartes de moments empilées.
   - Tiroir tactile `vaul` pour choisir parmi les 2 alternatives lors du clic sur `🔀 Remplacer`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/escapade/ tests/escapade-view.test.tsx
git commit -m "feat(ui): add escapade daily moments view with rain mode and spot swap"
```

---

### Task 5: Persistance Légère & Route de Partage (`itineraries`)

**Files:**
- Modify: `src/db/schema.ts`
- Create: `src/app/api/escapades/share/route.ts`
- Create: `src/app/escapade/[slug]/page.tsx`
- Test: `tests/escapade-share.test.ts`

**Interfaces:**
- Consumes: Table `itineraries` simple
- Produces: `POST /api/escapades/share` générant une URL courte `/escapade/[slug]` partageable.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/escapade-share.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('generateEscapadeSlug builds readable Morbihan slug', async () => {
  const { generateEscapadeSlug } = await import('../src/app/api/escapades/share/route');
  const slug = generateEscapadeSlug('Presqu-ile de Rhuys', 2);
  assert.match(slug, /^escapade-rhuys-2j-[a-z0-9]{5}$/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with module not found

- [ ] **Step 3: Implement schema addition and share route**

1. Dans `src/db/schema.ts` : ajouter uniquement la table `itineraries` :
   ```typescript
   export const itineraries = pgTable('itineraries', {
     id: uuid('id').defaultRandom().primaryKey(),
     slug: varchar('slug', { length: 32 }).notNull().unique(),
     title: varchar('title', { length: 255 }).notNull(),
     baseSector: varchar('base_sector', { length: 100 }).notNull(),
     durationDays: integer('duration_days').notNull(),
     escapadeData: jsonb('escapade_data').notNull(),
     createdAt: timestamp('created_at').defaultNow().notNull(),
   });
   ```
2. Dans `src/app/api/escapades/share/route.ts` : route POST insérant le snapshot et renvoyant le slug.
3. Dans `src/app/escapade/[slug]/page.tsx` : affichage en lecture seule du séjour avec bouton d'import/duplication locale.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts src/app/api/escapades/share/route.ts src/app/escapade/[slug]/page.tsx tests/escapade-share.test.ts
git commit -m "feat(share): add lightweight escapade persistence and sharing route"
```
