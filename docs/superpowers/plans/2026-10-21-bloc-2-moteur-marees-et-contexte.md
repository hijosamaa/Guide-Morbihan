# Bloc 2 — Moteur Mathématique des Marées & Évaluation Contextuelle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter le moteur mathématique pur de marées (`tide-engine.ts`) basé sur la règle des douzièmes avec modèle hybride pour les passages submersibles (Berder/Tascon), et le moteur d'évaluation contextuelle instantanée (`context-matcher.ts`) avec scoring, abri au vent et adaptation à la pluie.

**Architecture:** Fonctions 100 % pures, déterministes et isomorphes (sans I/O ni dépendance externe) situées dans `src/lib/`. Les types partagés résident dans `src/lib/types/context.ts`. Les tests unitaires exploitent le test runner natif Node.js via `tsx --test tests/**/*.test.ts`.

**Tech Stack:** TypeScript strict, Node.js test runner (`tsx --test`), Drizzle schema types existants.

**Spec:** [docs/superpowers/specs/2026-10-21-bloc-2-moteur-marees-et-contexte-design.md](file:///Users/Moulitos/Documents/antigravity/Guide%20Morbihan/docs/superpowers/specs/2026-10-21-bloc-2-moteur-marees-et-contexte-design.md)

## Global Constraints

- Fonctions 100 % pures : zéro appel réseau, zéro lecture de base de données à l'intérieur de `tide-engine.ts` et `context-matcher.ts`.
- Précision marégraphique : interpolation continue par la Règle des Douzièmes canonique aux 6 heures marégraphiques.
- Modèle hybride pour Berder et Tascon : priorité absolue au créneau officiel (`OFFICIAL`) si fourni, fallback hydrodynamique (`CALCULATED_FALLBACK`) si absent.
- Aucun type `any`, mode strict TypeScript actif, conformité avec le build standalone Next.js 15.
- Performance d'exécution : < 0.1 ms par calcul de marée ou d'évaluation de lieu.

---

### Task 1: Context & Tide Type Definitions

**Files:**
- Create: `src/lib/types/context.ts`
- Test: `tests/context-types.test.ts`

**Interfaces:**
- Produces: Types `TidalPhase`, `PassageStatusKind`, `ContextBadge`, `TidePoint`, `TideStatus`, `OfficialPassageWindow`, `PassageStatus`, `WeatherContext`, `ContextEvaluationResult`.

- [ ] **Step 1: Write test for context types validation**

Create `tests/context-types.test.ts` :
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  TidalPhase,
  PassageStatusKind,
  ContextBadge,
  TidePoint,
  TideStatus,
  OfficialPassageWindow,
  PassageStatus,
  WeatherContext,
  ContextEvaluationResult,
} from '../src/lib/types/context';

test('Context Types can be instantiated and typed strictly', () => {
  const tidePoint: TidePoint = {
    harbor: 'PORT_NAVALO',
    eventType: 'HIGH',
    eventTimestamp: new Date('2026-10-21T05:12:00Z'),
    heightMeters: 4.85,
    coefficient: 74,
  };
  assert.equal(tidePoint.harbor, 'PORT_NAVALO');
  assert.equal(tidePoint.eventType, 'HIGH');
  assert.equal(tidePoint.coefficient, 74);

  const officialWindow: OfficialPassageWindow = {
    passageSlug: 'passage-ile-de-berder',
    openAt: new Date('2026-10-21T09:30:00Z'),
    closeAt: new Date('2026-10-21T13:30:00Z'),
    source: 'MAIRIE_LARMOR_BADEN',
  };
  assert.equal(officialWindow.passageSlug, 'passage-ile-de-berder');

  const weather: WeatherContext = {
    sector: 'VANNES',
    tempCelsius: 18.5,
    windSpeedKnots: 11.2,
    windDirectionDeg: 315,
    windCardinal: 'NW',
    weatherCode: 1,
    isRaining: false,
  };
  assert.equal(weather.windCardinal, 'NW');
  assert.equal(weather.isRaining, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/context-types.test.ts`
Expected: FAIL with "Cannot find module '../src/lib/types/context'"

- [ ] **Step 3: Implement context types**

Create `src/lib/types/context.ts` :
```typescript
export type TidalPhase = 'FLOOD' | 'EBB' | 'SLACK_HIGH' | 'SLACK_LOW';
export type PassageStatusKind = 'OPEN' | 'CLOSING_SOON' | 'CLOSED' | 'OPENING_SOON';
export type ContextBadge = 'IDEAL' | 'WARNING' | 'UNSUITABLE';
export type WindCardinal = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export interface TidePoint {
  harbor: 'PORT_NAVALO' | 'VANNES';
  eventType: 'HIGH' | 'LOW';
  eventTimestamp: Date;
  heightMeters: number;
  coefficient?: number | null;
}

export interface TideStatus {
  harbor: 'PORT_NAVALO' | 'VANNES';
  timestamp: Date;
  waterHeightMeters: number;
  phase: TidalPhase;
  coefficient: number;
  previousEvent: TidePoint;
  nextEvent: TidePoint;
  minutesToNextEvent: number;
  tidalRangeMeters: number;
}

export interface OfficialPassageWindow {
  passageSlug: string;
  openAt: Date;
  closeAt: Date;
  source?: string;
}

export interface PassageStatus {
  slug: string;
  name: string;
  isOpen: boolean;
  status: PassageStatusKind;
  minutesRemaining: number;
  source: 'OFFICIAL' | 'CALCULATED_FALLBACK';
  window: {
    start: Date;
    end: Date;
  };
  hazardNotice?: string;
}

export interface WeatherContext {
  sector: string;
  tempCelsius: number;
  windSpeedKnots: number;
  windDirectionDeg: number;
  windCardinal: WindCardinal;
  weatherCode: number;
  isRaining: boolean;
}

export interface ContextEvaluationResult {
  placeSlug: string;
  badge: ContextBadge;
  score: number;
  titleReason: string;
  reasons: string[];
  isSheltered: boolean;
  tideContext?: {
    harbor: 'PORT_NAVALO' | 'VANNES';
    waterHeightMeters: number;
    phase: TidalPhase;
  };
  passageContext?: PassageStatus;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/context-types.test.ts`
Expected: PASS with 1 passing test.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types/context.ts tests/context-types.test.ts
git commit -m "feat(bloc-2): add core context, tide and passage type definitions"
```

---

### Task 2: Pure Rule of Twelfths Tide Engine

**Files:**
- Create: `src/lib/tide-engine.ts`
- Test: `tests/tide-engine.test.ts`

**Interfaces:**
- Consumes: Types from `src/lib/types/context.ts`.
- Produces:
  - `calculateTwelfthsFraction(progress: number): number`
  - `interpolateWaterHeight(timestamp: Date, prev: TidePoint, next: TidePoint): number`
  - `resolveHarborForCommune(communeSlug: string, sector?: string): 'PORT_NAVALO' | 'VANNES'`
  - `getTideStatus(timestamp: Date, harbor: 'PORT_NAVALO' | 'VANNES', events: TidePoint[]): TideStatus`

- [ ] **Step 1: Write failing tests for Rule of Twelfths and height calculation**

Create `tests/tide-engine.test.ts` :
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTwelfthsFraction,
  interpolateWaterHeight,
  resolveHarborForCommune,
  getTideStatus,
} from '../src/lib/tide-engine';
import type { TidePoint } from '../src/lib/types/context';

test('Rule of twelfths fractional checkpoints', () => {
  // Check exact 1/12, 3/12, 6/12, 9/12, 11/12, 12/12
  assert.equal(calculateTwelfthsFraction(0), 0);
  assert.equal(calculateTwelfthsFraction(1 / 6), 1 / 12);
  assert.equal(calculateTwelfthsFraction(2 / 6), 3 / 12);
  assert.equal(calculateTwelfthsFraction(3 / 6), 6 / 12);
  assert.equal(calculateTwelfthsFraction(4 / 6), 9 / 12);
  assert.equal(calculateTwelfthsFraction(5 / 6), 11 / 12);
  assert.equal(calculateTwelfthsFraction(1), 1);
});

test('Continuous height interpolation during flood and ebb', () => {
  const low: TidePoint = {
    harbor: 'PORT_NAVALO',
    eventType: 'LOW',
    eventTimestamp: new Date('2026-10-21T11:34:00Z'),
    heightMeters: 1.12,
  };
  const high: TidePoint = {
    harbor: 'PORT_NAVALO',
    eventType: 'HIGH',
    eventTimestamp: new Date('2026-10-21T17:42:00Z'),
    heightMeters: 5.02,
    coefficient: 78,
  };

  // At low tide: exact low height
  const hStart = interpolateWaterHeight(low.eventTimestamp, low, high);
  assert.equal(Math.round(hStart * 100) / 100, 1.12);

  // At high tide: exact high height
  const hEnd = interpolateWaterHeight(high.eventTimestamp, low, high);
  assert.equal(Math.round(hEnd * 100) / 100, 5.02);

  // Half duration (mid-tide, 3/6 progress): should equal low + 0.5 * range
  const midTime = new Date(low.eventTimestamp.getTime() + (high.eventTimestamp.getTime() - low.eventTimestamp.getTime()) / 2);
  const hMid = interpolateWaterHeight(midTime, low, high);
  const expectedMid = 1.12 + (5.02 - 1.12) * 0.5;
  assert.equal(Math.abs(hMid - expectedMid) < 0.001, true);
});

test('Resolve harbor for commune correctly assigns outer vs inner gulf', () => {
  assert.equal(resolveHarborForCommune('arzon'), 'PORT_NAVALO');
  assert.equal(resolveHarborForCommune('quiberon'), 'PORT_NAVALO');
  assert.equal(resolveHarborForCommune('etel'), 'PORT_NAVALO');
  assert.equal(resolveHarborForCommune('vannes'), 'VANNES');
  assert.equal(resolveHarborForCommune('arradon'), 'VANNES');
  assert.equal(resolveHarborForCommune('larmor-baden'), 'VANNES');
  assert.equal(resolveHarborForCommune('saint-armel'), 'VANNES');
});

test('getTideStatus returns complete phase and state', () => {
  const events: TidePoint[] = [
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
  ];

  // 14:00 is between LOW (11:34) and HIGH (17:42) -> FLOOD
  const status = getTideStatus(new Date('2026-10-21T14:00:00Z'), 'PORT_NAVALO', events);
  assert.equal(status.harbor, 'PORT_NAVALO');
  assert.equal(status.phase, 'FLOOD');
  assert.equal(status.coefficient, 78);
  assert.equal(status.waterHeightMeters > 1.12, true);
  assert.equal(status.waterHeightMeters < 5.02, true);
  assert.equal(status.previousEvent.eventType, 'LOW');
  assert.equal(status.nextEvent.eventType, 'HIGH');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/tide-engine.test.ts`
Expected: FAIL with "Cannot find module '../src/lib/tide-engine'"

- [ ] **Step 3: Implement pure tide engine core**

Create `src/lib/tide-engine.ts` :
```typescript
import type {
  TidalPhase,
  TidePoint,
  TideStatus,
} from './types/context';

const TWELFTHS_CUMULATIVE = [0, 1 / 12, 3 / 12, 6 / 12, 9 / 12, 11 / 12, 1];

/**
 * Calcule la fraction cumulée du marnage selon la règle des douzièmes
 * avec interpolation continue linéaire à l'intérieur de chaque heure marégraphique.
 * @param progress Progression normalisée de la marée entre 0 et 1.
 */
export function calculateTwelfthsFraction(progress: number): number {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;

  const scaled = progress * 6;
  const hourIndex = Math.floor(scaled);
  const hourFraction = scaled - hourIndex;

  if (hourIndex >= 6) return 1;

  const startFrac = TWELFTHS_CUMULATIVE[hourIndex];
  const endFrac = TWELFTHS_CUMULATIVE[hourIndex + 1];

  return startFrac + hourFraction * (endFrac - startFrac);
}

/**
 * Interpole la hauteur d'eau à l'instant cible entre deux événements consécutifs.
 */
export function interpolateWaterHeight(
  timestamp: Date,
  prev: TidePoint,
  next: TidePoint
): number {
  const t = timestamp.getTime();
  const tPrev = prev.eventTimestamp.getTime();
  const tNext = next.eventTimestamp.getTime();

  if (tNext <= tPrev) {
    return prev.heightMeters;
  }

  const progress = Math.max(0, Math.min(1, (t - tPrev) / (tNext - tPrev)));
  const fraction = calculateTwelfthsFraction(progress);
  const range = Math.abs(next.heightMeters - prev.heightMeters);

  if (next.heightMeters >= prev.heightMeters) {
    // Montante (Flot)
    return prev.heightMeters + range * fraction;
  } else {
    // Descendante (Jusant)
    return prev.heightMeters - range * fraction;
  }
}

const OUTER_GULF_COMMUNES = new Set([
  'arzon',
  'saint-gildas-de-rhuys',
  'quiberon',
  'saint-pierre-quiberon',
  'plouhinec',
  'etel',
  'belz',
  'erdeven',
  'locmariaquer',
]);

/**
 * Détermine le port de référence marégraphique (Port-Navalo vs Vannes).
 */
export function resolveHarborForCommune(
  communeSlug: string,
  sector?: string
): 'PORT_NAVALO' | 'VANNES' {
  const slug = communeSlug.toLowerCase().trim();
  if (OUTER_GULF_COMMUNES.has(slug)) {
    return 'PORT_NAVALO';
  }
  if (sector === 'Presqu-ile de Quiberon' || sector === 'Ria d-Etel') {
    return 'PORT_NAVALO';
  }
  return 'VANNES';
}

/**
 * Calcule l'état instantané complet de la marée pour un port et un horodatage.
 */
export function getTideStatus(
  timestamp: Date,
  harbor: 'PORT_NAVALO' | 'VANNES',
  events: TidePoint[]
): TideStatus {
  const harborEvents = events
    .filter((e) => e.harbor === harbor)
    .sort((a, b) => a.eventTimestamp.getTime() - b.eventTimestamp.getTime());

  if (harborEvents.length < 2) {
    throw new Error(`Insufficient tide events for harbor ${harbor}. Minimum 2 events required.`);
  }

  const targetTime = timestamp.getTime();
  let prevEventIndex = -1;

  for (let i = 0; i < harborEvents.length - 1; i++) {
    const current = harborEvents[i].eventTimestamp.getTime();
    const next = harborEvents[i + 1].eventTimestamp.getTime();
    if (targetTime >= current && targetTime <= next) {
      prevEventIndex = i;
      break;
    }
  }

  let prevEvent: TidePoint;
  let nextEvent: TidePoint;

  if (prevEventIndex !== -1) {
    prevEvent = harborEvents[prevEventIndex];
    nextEvent = harborEvents[prevEventIndex + 1];
  } else if (targetTime < harborEvents[0].eventTimestamp.getTime()) {
    prevEvent = harborEvents[0];
    nextEvent = harborEvents[1];
  } else {
    prevEvent = harborEvents[harborEvents.length - 2];
    nextEvent = harborEvents[harborEvents.length - 1];
  }

  const waterHeightMeters = Math.round(interpolateWaterHeight(timestamp, prevEvent, nextEvent) * 100) / 100;
  const tidalRangeMeters = Math.round(Math.abs(nextEvent.heightMeters - prevEvent.heightMeters) * 100) / 100;

  // Détection de phase et étales (fenêtre de 20 minutes)
  const diffToPrevMinutes = Math.abs(targetTime - prevEvent.eventTimestamp.getTime()) / 60000;
  const diffToNextMinutes = Math.abs(nextEvent.eventTimestamp.getTime() - targetTime) / 60000;

  let phase: TidalPhase;
  if (diffToPrevMinutes <= 20) {
    phase = prevEvent.eventType === 'HIGH' ? 'SLACK_HIGH' : 'SLACK_LOW';
  } else if (diffToNextMinutes <= 20) {
    phase = nextEvent.eventType === 'HIGH' ? 'SLACK_HIGH' : 'SLACK_LOW';
  } else {
    phase = nextEvent.heightMeters > prevEvent.heightMeters ? 'FLOOD' : 'EBB';
  }

  const coefficient = nextEvent.coefficient ?? prevEvent.coefficient ?? 70;
  const minutesToNextEvent = Math.max(0, Math.round((nextEvent.eventTimestamp.getTime() - targetTime) / 60000));

  return {
    harbor,
    timestamp,
    waterHeightMeters,
    phase,
    coefficient,
    previousEvent: prevEvent,
    nextEvent,
    minutesToNextEvent,
    tidalRangeMeters,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/tide-engine.test.ts`
Expected: PASS with 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tide-engine.ts tests/tide-engine.test.ts
git commit -m "feat(bloc-2): implement rule of twelfths tide engine with continuous interpolation"
```

---

### Task 3: Submersible Passages Module (Hybrid Official & Fallback)

**Files:**
- Modify: `src/lib/tide-engine.ts`
- Test: `tests/tide-engine.test.ts`

**Interfaces:**
- Consumes: Types from `src/lib/types/context.ts`, tide calculation functions.
- Produces:
  - `evaluatePassageStatus(passageSlug: string, timestamp: Date, options: PassageEvaluationOptions): PassageStatus`
  - Support for `passage-ile-de-berder` and `passage-ile-tascon`.

- [ ] **Step 1: Write failing tests for official window priority and fallback calculation**

Append to `tests/tide-engine.test.ts` :
```typescript
import { evaluatePassageStatus } from '../src/lib/tide-engine';
import type { OfficialPassageWindow, TidePoint } from '../src/lib/types/context';

test('Berder passage prioritizes official window when provided', () => {
  const officialWindows: OfficialPassageWindow[] = [
    {
      passageSlug: 'passage-ile-de-berder',
      openAt: new Date('2026-10-21T09:30:00Z'),
      closeAt: new Date('2026-10-21T13:30:00Z'),
      source: 'MAIRIE_LARMOR_BADEN',
    },
  ];

  // At 11:00: open with official source
  const statusOpen = evaluatePassageStatus('passage-ile-de-berder', new Date('2026-10-21T11:00:00Z'), {
    officialWindows,
  });
  assert.equal(statusOpen.isOpen, true);
  assert.equal(statusOpen.status, 'OPEN');
  assert.equal(statusOpen.source, 'OFFICIAL');
  assert.equal(statusOpen.minutesRemaining, 150); // 2h30 before 13:30

  // At 13:15: closing soon (< 30 min before 13:30)
  const statusClosing = evaluatePassageStatus('passage-ile-de-berder', new Date('2026-10-21T13:15:00Z'), {
    officialWindows,
  });
  assert.equal(statusClosing.isOpen, true);
  assert.equal(statusClosing.status, 'CLOSING_SOON');
  assert.equal(statusClosing.minutesRemaining, 15);

  // At 14:00: closed
  const statusClosed = evaluatePassageStatus('passage-ile-de-berder', new Date('2026-10-21T14:00:00Z'), {
    officialWindows,
  });
  assert.equal(statusClosed.isOpen, false);
  assert.equal(statusClosed.status, 'CLOSED');
});

test('Berder passage falls back to calculation when no official window provided', () => {
  const tideEvents: TidePoint[] = [
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
      heightMeters: 4.4,
      coefficient: 78,
    },
  ];

  // At 13:20 (exact low tide): open via fallback
  const statusFallback = evaluatePassageStatus('passage-ile-de-berder', new Date('2026-10-21T13:20:00Z'), {
    tideEvents,
  });
  assert.equal(statusFallback.isOpen, true);
  assert.equal(statusFallback.source, 'CALCULATED_FALLBACK');
  assert.equal(statusFallback.hazardNotice !== undefined, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/tide-engine.test.ts`
Expected: FAIL with "evaluatePassageStatus is not a function"

- [ ] **Step 3: Implement evaluatePassageStatus in `src/lib/tide-engine.ts`**

Add to `src/lib/tide-engine.ts` :
```typescript
import type {
  OfficialPassageWindow,
  PassageStatus,
} from './types/context';

export interface PassageEvaluationOptions {
  officialWindows?: OfficialPassageWindow[];
  tideEvents?: TidePoint[];
  harbor?: 'PORT_NAVALO' | 'VANNES';
}

const PASSAGE_CONFIGS: Record<
  string,
  {
    name: string;
    defaultHarbor: 'PORT_NAVALO' | 'VANNES';
    maxHeightMeters: number;
    hoursAroundLow: number;
    hazardNoticeFlood?: string;
  }
> = {
  'passage-ile-de-berder': {
    name: "Chaussée de l'Île de Berder",
    defaultHarbor: 'VANNES',
    maxHeightMeters: 1.4,
    hoursAroundLow: 2,
    hazardNoticeFlood:
      'Attention : violent courant de la Jument au flot. Ne traversez sous aucun prétexte avec de l’eau sur la chaussée.',
  },
  'passage-ile-tascon': {
    name: "Passage de l'Île Tascon",
    defaultHarbor: 'VANNES',
    maxHeightMeters: 1.5,
    hoursAroundLow: 2,
    hazardNoticeFlood:
      'Attention : marée montante rapide sur les vasières. Respectez les créneaux au sec.',
  },
};

/**
 * Évalue l'état de praticabilité d'un passage submersible (Berder, Tascon).
 * Priorité absolue aux créneaux officiels, avec calcul hydrographique de secours.
 */
export function evaluatePassageStatus(
  passageSlug: string,
  timestamp: Date,
  options: PassageEvaluationOptions = {}
): PassageStatus {
  const config = PASSAGE_CONFIGS[passageSlug] ?? {
    name: passageSlug,
    defaultHarbor: 'VANNES' as const,
    maxHeightMeters: 1.4,
    hoursAroundLow: 2,
  };

  const targetTime = timestamp.getTime();

  // 1. Recherche d'un créneau officiel englobant ou proche
  if (options.officialWindows && options.officialWindows.length > 0) {
    const matchingWindow = options.officialWindows.find(
      (w) => w.passageSlug === passageSlug &&
        Math.abs(targetTime - w.openAt.getTime()) <= 12 * 3600 * 1000
    );

    if (matchingWindow) {
      const openTime = matchingWindow.openAt.getTime();
      const closeTime = matchingWindow.closeAt.getTime();
      const isOpen = targetTime >= openTime && targetTime <= closeTime;

      let status: 'OPEN' | 'CLOSING_SOON' | 'CLOSED' | 'OPENING_SOON';
      let minutesRemaining: number;

      if (isOpen) {
        minutesRemaining = Math.max(0, Math.round((closeTime - targetTime) / 60000));
        status = minutesRemaining <= 30 ? 'CLOSING_SOON' : 'OPEN';
      } else if (targetTime < openTime) {
        minutesRemaining = Math.max(0, Math.round((openTime - targetTime) / 60000));
        status = minutesRemaining <= 30 ? 'OPENING_SOON' : 'CLOSED';
      } else {
        minutesRemaining = 0;
        status = 'CLOSED';
      }

      return {
        slug: passageSlug,
        name: config.name,
        isOpen,
        status,
        minutesRemaining,
        source: 'OFFICIAL',
        window: {
          start: matchingWindow.openAt,
          end: matchingWindow.closeAt,
        },
        hazardNotice: config.hazardNoticeFlood,
      };
    }
  }

  // 2. Fallback hydrodynamique via marées
  if (!options.tideEvents || options.tideEvents.length === 0) {
    throw new Error(`Cannot evaluate passage ${passageSlug}: neither official windows nor tide events provided.`);
  }

  const harbor = options.harbor ?? config.defaultHarbor;
  const tideStatus = getTideStatus(timestamp, harbor, options.tideEvents);

  // Recherche de la basse mer la plus proche
  const nearestLow = tideStatus.previousEvent.eventType === 'LOW'
    ? tideStatus.previousEvent
    : tideStatus.nextEvent.eventType === 'LOW'
    ? tideStatus.nextEvent
    : options.tideEvents
        .filter((e) => e.harbor === harbor && e.eventType === 'LOW')
        .sort(
          (a, b) =>
            Math.abs(a.eventTimestamp.getTime() - targetTime) -
            Math.abs(b.eventTimestamp.getTime() - targetTime)
        )[0];

  if (!nearestLow) {
    throw new Error(`No low tide event found for harbor ${harbor}.`);
  }

  const lowTime = nearestLow.eventTimestamp.getTime();
  const halfWindowMs = config.hoursAroundLow * 3600 * 1000;
  const startTime = new Date(lowTime - halfWindowMs);
  const endTime = new Date(lowTime + halfWindowMs);

  const isOpen = targetTime >= startTime.getTime() && targetTime <= endTime.getTime();
  let status: 'OPEN' | 'CLOSING_SOON' | 'CLOSED' | 'OPENING_SOON';
  let minutesRemaining: number;

  if (isOpen) {
    minutesRemaining = Math.max(0, Math.round((endTime.getTime() - targetTime) / 60000));
    status = minutesRemaining <= 30 ? 'CLOSING_SOON' : 'OPEN';
  } else if (targetTime < startTime.getTime()) {
    minutesRemaining = Math.max(0, Math.round((startTime.getTime() - targetTime) / 60000));
    status = minutesRemaining <= 30 ? 'OPENING_SOON' : 'CLOSED';
  } else {
    minutesRemaining = 0;
    status = 'CLOSED';
  }

  return {
    slug: passageSlug,
    name: config.name,
    isOpen,
    status,
    minutesRemaining,
    source: 'CALCULATED_FALLBACK',
    window: {
      start: startTime,
      end: endTime,
    },
    hazardNotice:
      tideStatus.phase === 'FLOOD' ? config.hazardNoticeFlood : undefined,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/tide-engine.test.ts`
Expected: PASS with 6 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tide-engine.ts tests/tide-engine.test.ts
git commit -m "feat(bloc-2): implement submersible passages evaluation with official window priority and fallback"
```

---

### Task 4: Context Matcher Engine (Scoring, Wind Shelter & Rain Handling)

**Files:**
- Create: `src/lib/context-matcher.ts`
- Test: `tests/context-matcher.test.ts`

**Interfaces:**
- Consumes: `ContextualRules` from schema, types from `src/lib/types/context.ts`.
- Produces:
  - `evaluatePlaceContext(place, currentTime, tideContext, weatherContext, passageContext?): ContextEvaluationResult`
  - `sortPlacesByContext(evaluations: ContextEvaluationResult[]): ContextEvaluationResult[]`
  - `filterPlacesContextually(places, filters, evaluations): FilteredResult`

- [ ] **Step 1: Write failing tests for context matcher**

Create `tests/context-matcher.test.ts` :
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePlaceContext, sortPlacesByContext } from '../src/lib/context-matcher';
import type { TideStatus, WeatherContext, PassageStatus } from '../src/lib/types/context';

const mockTideStatusHigh: TideStatus = {
  harbor: 'VANNES',
  timestamp: new Date('2026-10-21T06:55:00Z'),
  waterHeightMeters: 4.25,
  phase: 'SLACK_HIGH',
  coefficient: 74,
  previousEvent: {
    harbor: 'VANNES',
    eventType: 'HIGH',
    eventTimestamp: new Date('2026-10-21T06:55:00Z'),
    heightMeters: 4.25,
    coefficient: 74,
  },
  nextEvent: {
    harbor: 'VANNES',
    eventType: 'LOW',
    eventTimestamp: new Date('2026-10-21T13:20:00Z'),
    heightMeters: 1.45,
  },
  minutesToNextEvent: 385,
  tidalRangeMeters: 2.8,
};

const mockTideStatusLow: TideStatus = {
  ...mockTideStatusHigh,
  timestamp: new Date('2026-10-21T13:20:00Z'),
  waterHeightMeters: 1.45,
  phase: 'SLACK_LOW',
  minutesToNextEvent: 0,
};

const mockWeatherGood: WeatherContext = {
  sector: 'ARRADON',
  tempCelsius: 19,
  windSpeedKnots: 12,
  windDirectionDeg: 320,
  windCardinal: 'NW',
  weatherCode: 1,
  isRaining: false,
};

const mockWeatherRain: WeatherContext = {
  ...mockWeatherGood,
  weatherCode: 61,
  isRaining: true,
};

test('Toulindac beach is IDEAL at high tide and UNSTABLE/UNSUITABLE at low tide', () => {
  const toulindac = {
    slug: 'plage-de-toulindac-arradon',
    name: 'Plage de Toulindac',
    contextualRules: {
      tideConstraint: 'HIGH_TIDE_ONLY' as const,
      tideOffsetHours: { beforeHigh: 2.5, afterHigh: 2.5 },
      shelteredFromWindDirections: ['N', 'NE', 'NW'] as const,
      dogsAllowedSummer: false,
      strollerFriendly: true,
      rainFriendly: false,
    },
    isSponsored: false,
  };

  // High tide: IDEAL + sheltered from NW
  const evalHigh = evaluatePlaceContext(toulindac, mockTideStatusHigh.timestamp, mockTideStatusHigh, mockWeatherGood);
  assert.equal(evalHigh.badge, 'IDEAL');
  assert.equal(evalHigh.isSheltered, true);
  assert.equal(evalHigh.score >= 70, true);

  // Low tide: UNSUITABLE
  const evalLow = evaluatePlaceContext(toulindac, mockTideStatusLow.timestamp, mockTideStatusLow, mockWeatherGood);
  assert.equal(evalLow.badge, 'UNSUITABLE');
  assert.equal(evalLow.score < 40, true);
});

test('Indoor heritage site is promoted during rain while beach is demoted', () => {
  const indoorMuseum = {
    slug: 'chateau-de-suscinio',
    name: 'Château de Suscinio',
    contextualRules: {
      tideConstraint: 'ALL_TIDES' as const,
      dogsAllowedSummer: true,
      strollerFriendly: true,
      rainFriendly: true,
    },
    isSponsored: false,
  };

  const outdoorTrail = {
    slug: 'sentier-cotier',
    name: 'Sentier Côtier',
    contextualRules: {
      tideConstraint: 'ALL_TIDES' as const,
      dogsAllowedSummer: true,
      strollerFriendly: false,
      rainFriendly: false,
    },
    isSponsored: false,
  };

  const evalMuseum = evaluatePlaceContext(indoorMuseum, mockWeatherRain.timestamp ?? new Date(), mockTideStatusHigh, mockWeatherRain);
  const evalTrail = evaluatePlaceContext(outdoorTrail, mockWeatherRain.timestamp ?? new Date(), mockTideStatusHigh, mockWeatherRain);

  assert.equal(evalMuseum.badge, 'IDEAL');
  assert.equal(evalMuseum.score > evalTrail.score, true);
  assert.equal(evalTrail.badge !== 'IDEAL', true);
});

test('Berder passage context matches passage open/close status', () => {
  const berder = {
    slug: 'passage-ile-de-berder',
    name: "Chaussée de l'Île de Berder",
    contextualRules: {
      tideConstraint: 'LOW_TIDE_ONLY' as const,
      tideOffsetHours: { beforeLow: 2, afterLow: 2 },
      minWaterHeightMeters: 1.2,
      dogsAllowedSummer: true,
      strollerFriendly: false,
      rainFriendly: false,
    },
    isSponsored: false,
  };

  const passageOpen: PassageStatus = {
    slug: 'passage-ile-de-berder',
    name: "Chaussée de l'Île de Berder",
    isOpen: true,
    status: 'OPEN',
    minutesRemaining: 90,
    source: 'OFFICIAL',
    window: { start: new Date(), end: new Date() },
  };

  const evalOpen = evaluatePlaceContext(berder, new Date(), mockTideStatusLow, mockWeatherGood, passageOpen);
  assert.equal(evalOpen.badge, 'IDEAL');

  const passageClosed: PassageStatus = {
    ...passageOpen,
    isOpen: false,
    status: 'CLOSED',
    minutesRemaining: 0,
  };

  const evalClosed = evaluatePlaceContext(berder, new Date(), mockTideStatusHigh, mockWeatherGood, passageClosed);
  assert.equal(evalClosed.badge, 'UNSUITABLE');
});

test('Performance: 1000 evaluations complete in under 15ms', () => {
  const place = {
    slug: 'test-place',
    name: 'Test Place',
    contextualRules: {
      tideConstraint: 'HIGH_TIDE_ONLY' as const,
      shelteredFromWindDirections: ['NW'] as const,
      dogsAllowedSummer: true,
      strollerFriendly: true,
      rainFriendly: false,
    },
    isSponsored: false,
  };

  const start = performance.now();
  for (let i = 0; i < 1000; i++) {
    evaluatePlaceContext(place, mockTideStatusHigh.timestamp, mockTideStatusHigh, mockWeatherGood);
  }
  const duration = performance.now() - start;
  assert.equal(duration < 15, true, `Expected < 15ms, took ${duration.toFixed(2)}ms`);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/context-matcher.test.ts`
Expected: FAIL with "Cannot find module '../src/lib/context-matcher'"

- [ ] **Step 3: Implement context matcher engine**

Create `src/lib/context-matcher.ts` :
```typescript
import type { ContextualRules } from '../db/schema';
import type {
  ContextBadge,
  ContextEvaluationResult,
  PassageStatus,
  TideStatus,
  WeatherContext,
} from './types/context';

export interface PlaceWithContextRules {
  slug: string;
  name: string;
  contextualRules: ContextualRules;
  isSponsored?: boolean;
}

/**
 * Évalue l'adéquation d'un lieu à l'instant T selon la marée, le vent et la météo.
 * Fonction 100% pure, exécutable sur serveur et client.
 */
export function evaluatePlaceContext(
  place: PlaceWithContextRules,
  currentTime: Date,
  tideContext: TideStatus,
  weatherContext: WeatherContext,
  passageContext?: PassageStatus
): ContextEvaluationResult {
  const rules = place.contextualRules;
  const reasons: string[] = [];
  let score = 50;
  let forceBadge: ContextBadge | null = null;
  let primaryReason = '';

  // 1. Évaluation de la contrainte de marée
  switch (rules.tideConstraint) {
    case 'HIGH_TIDE_ONLY': {
      // Baignade optimale à marée haute (PM ± 2h30)
      const isHighTideNear =
        (tideContext.previousEvent.eventType === 'HIGH' &&
          Math.abs(currentTime.getTime() - tideContext.previousEvent.eventTimestamp.getTime()) <= 2.5 * 3600000) ||
        (tideContext.nextEvent.eventType === 'HIGH' &&
          Math.abs(tideContext.nextEvent.eventTimestamp.getTime() - currentTime.getTime()) <= 2.5 * 3600000);

      const isMidTide =
        (tideContext.previousEvent.eventType === 'HIGH' &&
          Math.abs(currentTime.getTime() - tideContext.previousEvent.eventTimestamp.getTime()) <= 3.5 * 3600000) ||
        (tideContext.nextEvent.eventType === 'HIGH' &&
          Math.abs(tideContext.nextEvent.eventTimestamp.getTime() - currentTime.getTime()) <= 3.5 * 3600000);

      if (isHighTideNear) {
        score += 35;
        primaryReason = 'Baignade idéale actuellement (marée haute)';
        reasons.push('Profondeur d’eau optimale pour la baignade.');
      } else if (isMidTide) {
        score += 10;
        primaryReason = 'Baignade praticable (mi-marée)';
        reasons.push('Hauteur d’eau correcte, pente douce.');
      } else {
        score -= 40;
        forceBadge = 'UNSUITABLE';
        primaryReason = 'Baignade déconseillée actuellement (marée basse)';
        reasons.push('Estran découvert, présence de vase ou accès à l’eau difficile.');
      }
      break;
    }

    case 'LOW_TIDE_ONLY': {
      // Passages submersibles ou pêche à pied
      if (passageContext) {
        if (passageContext.status === 'OPEN') {
          score += 40;
          primaryReason = `Passage praticable au sec (encore ${passageContext.minutesRemaining} min)`;
          reasons.push(`Accès piéton sécurisé (${passageContext.source === 'OFFICIAL' ? 'Horaires officiels' : 'Calcul estimé'}).`);
        } else if (passageContext.status === 'CLOSING_SOON') {
          score -= 10;
          forceBadge = 'WARNING';
          primaryReason = `⚠️ Fermeture imminente dans ${passageContext.minutesRemaining} min`;
          reasons.push('Regagnez la rive immédiatement avant submersion complète de la chaussée.');
        } else if (passageContext.status === 'OPENING_SOON') {
          score -= 15;
          forceBadge = 'WARNING';
          primaryReason = `Ouverture du passage imminente (dans ${passageContext.minutesRemaining} min)`;
          reasons.push('La mer se retire, chaussée bientôt praticable au sec.');
        } else {
          score -= 50;
          forceBadge = 'UNSUITABLE';
          primaryReason = 'Passage submersible sous l’eau';
          reasons.push('Chaussée recouverte par la mer.');
        }
      } else {
        // Fallback sans contexte de passage
        const isNearLow =
          (tideContext.previousEvent.eventType === 'LOW' &&
            Math.abs(currentTime.getTime() - tideContext.previousEvent.eventTimestamp.getTime()) <= 2 * 3600000) ||
          (tideContext.nextEvent.eventType === 'LOW' &&
            Math.abs(tideContext.nextEvent.eventTimestamp.getTime() - currentTime.getTime()) <= 2 * 3600000);

        if (isNearLow) {
          score += 35;
          primaryReason = 'Idéal à marée basse (estran accessible)';
          reasons.push('Pêche à pied et découverte de l’estran.');
        } else {
          score -= 30;
          forceBadge = 'UNSUITABLE';
          primaryReason = 'Estran recouvert par la mer';
          reasons.push('Praticable uniquement autour de la basse mer.');
        }
      }
      break;
    }

    case 'MID_TIDE_FLOW': {
      // Spectacle de courant marin (Courant de la Jument)
      const isSlack = tideContext.phase === 'SLACK_HIGH' || tideContext.phase === 'SLACK_LOW';
      if (!isSlack) {
        score += 35;
        primaryReason = 'Courant marin spectaculaire à mi-marée';
        reasons.push('Vitesse de courant maximale, marmites et bouillonnements saisissants.');
      } else {
        score -= 20;
        primaryReason = 'Courant calme en période d’étale';
        reasons.push('Activité du courant réduite aux heures de pleine et basse mer.');
      }
      break;
    }

    case 'ALL_TIDES':
    default: {
      score += 20;
      if (!primaryReason) {
        primaryReason = 'Praticable à toute heure de marée';
      }
      reasons.push('Lieu accessible indépendamment du niveau de la mer.');
      break;
    }
  }

  // 2. Évaluation de l'abri au vent
  let isSheltered = false;
  if (
    rules.shelteredFromWindDirections &&
    rules.shelteredFromWindDirections.length > 0 &&
    rules.shelteredFromWindDirections.includes(weatherContext.windCardinal)
  ) {
    isSheltered = true;
    score += 15;
    reasons.push(`Plage bien abritée du vent de ${weatherContext.windCardinal}.`);
  } else if (weatherContext.windSpeedKnots >= 20) {
    score -= 15;
    reasons.push(`Exposé au vent fort (${Math.round(weatherContext.windSpeedKnots)} nds).`);
  }

  // 3. Évaluation de la pluie et couverture
  if (weatherContext.isRaining) {
    if (rules.rainFriendly) {
      score += 30;
      primaryReason = 'Idéal par temps de pluie (visite abritée)';
      reasons.push('Site couvert ou abrité des intempéries.');
    } else {
      score -= 30;
      if (!forceBadge && score < 70) {
        forceBadge = 'WARNING';
      }
      reasons.push('Activité de plein air déconseillée sous la pluie.');
    }
  }

  // 4. Normalisation finale du score (0 à 100)
  score = Math.max(0, Math.min(100, Math.round(score)));

  // 5. Attribution du badge
  let badge: ContextBadge;
  if (forceBadge) {
    badge = forceBadge;
  } else if (score >= 70) {
    badge = 'IDEAL';
  } else if (score >= 40) {
    badge = 'WARNING';
  } else {
    badge = 'UNSUITABLE';
  }

  return {
    placeSlug: place.slug,
    badge,
    score,
    titleReason: primaryReason || 'Conditions actuelles',
    reasons,
    isSheltered,
    tideContext: {
      harbor: tideContext.harbor,
      waterHeightMeters: tideContext.waterHeightMeters,
      phase: tideContext.phase,
    },
    passageContext,
  };
}

/**
 * Trie une liste d'évaluations contextuelles par pertinence décroissante.
 * En cas d'égalité, les lieux sponsorisés bénéficient d'un léger avantage.
 */
export function sortPlacesByContext(
  evaluations: (ContextEvaluationResult & { isSponsored?: boolean })[]
): ContextEvaluationResult[] {
  return [...evaluations].sort((a, b) => {
    const scoreA = a.score + (a.isSponsored ? 2 : 0);
    const scoreB = b.score + (b.isSponsored ? 2 : 0);
    return scoreB - scoreA;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/context-matcher.test.ts`
Expected: PASS with 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/context-matcher.ts tests/context-matcher.test.ts
git commit -m "feat(bloc-2): implement pure context matcher engine with multi-criteria scoring and wind/rain logic"
```

---

### Task 5: End-to-End Validation & Complete Test Suite Execution

**Files:**
- Test: All tests in `tests/**/*.test.ts`

**Interfaces:**
- Consumes: All Bloc 1 and Bloc 2 modules.
- Produces: 100% green test suite, clean standalone compilation.

- [ ] **Step 1: Run complete test suite**

Run: `npm test`
Expected: PASS across all test files (schema, seed, standalone, context-types, tide-engine, context-matcher).

- [ ] **Step 2: Run production standalone build**

Run: `npm run build`
Expected: Successful standalone compilation with 0 TypeScript or ESLint errors.

- [ ] **Step 3: Commit and update documentation**

```bash
git add docs/superpowers/plans/2026-10-21-bloc-2-moteur-marees-et-contexte.md
git commit -m "docs: finalize Bloc 2 implementation plan for tide engine and context matcher"
```
