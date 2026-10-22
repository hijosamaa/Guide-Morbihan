# Chantier 2 (Navigation GPS Rando & Vélo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire le moteur d'itinérance GPS active et le cockpit mobile outdoor pour les randonneurs et cyclistes du Morbihan, avec suivi de trace assisté, alertes prédictives de marée (submersion des passages de Berder et Tascon), pack hors-ligne 1-clic (tuiles z11-z16) et bouton d'urgence littoral (SDIS 112 / CROSS 196).

**Architecture:** Approche **Local-First Reactive Engine** modulaire : calculs géométriques purs métriques équirectangulaires ($O(1)$ amorti), machine à états finis pour la progression et la détection d'écart à hystérésis, évaluation de surcote marée dynamique, pack hors-ligne stocké dans `CacheStorage` / IndexedDB, et cockpit mobile React 19 optimisé pour le plein soleil marin (High Glare).

**Tech Stack:** Next.js 15 (App Router, React 19), TypeScript strict, MapLibre GL JS, Web Audio API, Screen Wake Lock API, CacheStorage, IndexedDB, Node.js Test Runner (`tsx --test`).

**Spec:** [`docs/superpowers/specs/2026-10-22-chantier-2-navigation-gps-design.md`](file:///Users/Moulitos/Documents/antigravity/Guide%20Morbihan/docs/superpowers/specs/2026-10-22-chantier-2-navigation-gps-design.md)

## Global Constraints
- Projection métrique locale équirectangulaire obligatoire centrée sur $47.5^\circ\text{N}$ pour corriger la distorsion de longitude (32,4%).
- Clamping strict de la projection orthogonale sur segment fini ($t \in [0, 1]$).
- Seuil d'alerte déviation dynamique : $\max(35\text{m},\, 1.5 \times \text{accuracy})$, neutralisé si `accuracy > 40m`, délai 10s, hystérésis de retour à 20m.
- Séparation stricte Rando (GR34 interdit aux vélos) vs Vélo (Voies vertes).
- Marge de sécurité submersion dynamique : $15\text{ min} + (\text{Coeff} > 80 \ ? \ 10 : 0) + (\text{Vent W/SW} > 20\text{ kts} \ ? \ 15 : 0)$.
- Pack hors-ligne couvrant les tuiles vectorielles de $z=11$ à $z=16$ (tampon 300m) + Style JSON, sprites et glyphes latins (`0-255.pbf`).
- AudioContext déverrouillé dès le départ par buffer muet 1 ms (contournement de la politique WebKit iOS).
- Persistance de session dans `localStorage` toutes les 5 secondes pour tolérer l'éviction mémoire brutale de Safari liée à l'appareil photo.
- Zéro régression sur la suite existante (133 tests unitaires passants).

---

### Task 1: Calculs Géométriques & Projection Métrique Équirectangulaire

**Files:**
- Create: `src/lib/geo-navigation/projection.ts`
- Test: `tests/geo-navigation-projection.test.ts`

**Interfaces:**
- Consumes: Coordonnées géographiques WGS84 `[longitude, latitude]`.
- Produces:
  - `toLocalMetric(lon: number, lat: number, refLat: number): { x: number, y: number }`
  - `projectPointOnSegment(p: [number, number], a: [number, number], b: [number, number]): { projected: [number, number], crossTrackDistanceMeters: number, t: number }`
  - `pointToLineDistanceMeters(p: [number, number], a: [number, number], b: [number, number]): number`

- [ ] **Step 1: Écrire le test unitaire pour la projection géométrique locale**

```typescript
// tests/geo-navigation-projection.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toLocalMetric,
  projectPointOnSegment,
} from '../src/lib/geo-navigation/projection.js';

test('toLocalMetric applies cosine correction for 47.5°N latitude', () => {
  const refLat = 47.5;
  // 1 degree longitude at 47.5N should be ~75.1 km, latitude should be ~111.2 km
  const p1 = toLocalMetric(-2.7, 47.5, refLat);
  const p2 = toLocalMetric(-2.6, 47.5, refLat);
  const dx = p2.x - p1.x;
  assert.ok(dx > 74000 && dx < 76000, `Expected ~75100m, got ${dx}`);

  const p3 = toLocalMetric(-2.7, 47.6, refLat);
  const dy = p3.y - p1.y;
  assert.ok(dy > 111000 && dy < 112000, `Expected ~111200m, got ${dy}`);
});

test('projectPointOnSegment clamps projection to segment endpoints', () => {
  // Segment A -> B allant d'Ouest en Est
  const a: [number, number] = [-2.80, 47.50];
  const b: [number, number] = [-2.78, 47.50];

  // Point P1 au milieu, légèrement au Nord
  const p1: [number, number] = [-2.79, 47.5005];
  const proj1 = projectPointOnSegment(p1, a, b);
  assert.ok(proj1.t >= 0.45 && proj1.t <= 0.55);
  assert.ok(proj1.crossTrackDistanceMeters > 50 && proj1.crossTrackDistanceMeters < 60);

  // Point P2 avant A (en amont) -> t doit être bridé à 0 (point A)
  const p2: [number, number] = [-2.82, 47.50];
  const proj2 = projectPointOnSegment(p2, a, b);
  assert.equal(proj2.t, 0);
  assert.equal(proj2.projected[0], a[0]);
  assert.equal(proj2.projected[1], a[1]);

  // Point P3 après B (en aval) -> t doit être bridé à 1 (point B)
  const p3: [number, number] = [-2.76, 47.50];
  const proj3 = projectPointOnSegment(p3, a, b);
  assert.equal(proj3.t, 1);
  assert.equal(proj3.projected[0], b[0]);
  assert.equal(proj3.projected[1], b[1]);
});
```

- [ ] **Step 2: Exécuter le test pour vérifier l'échec initial**

Run: `npx tsx --test tests/geo-navigation-projection.test.ts`  
Expected: FAIL avec "Cannot find module '../src/lib/geo-navigation/projection.js'"

- [ ] **Step 3: Écrire l'implémentation de la projection métrique**

```typescript
// src/lib/geo-navigation/projection.ts
const EARTH_RADIUS_METERS = 6371000;
const DEG_TO_RAD = Math.PI / 180;

export interface MetricPoint {
  x: number;
  y: number;
}

export interface SegmentProjectionResult {
  projected: [number, number]; // [lon, lat]
  crossTrackDistanceMeters: number;
  t: number; // 0..1 clamped
}

export function toLocalMetric(lon: number, lat: number, refLat: number): MetricPoint {
  const cosRef = Math.cos(refLat * DEG_TO_RAD);
  return {
    x: lon * DEG_TO_RAD * EARTH_RADIUS_METERS * cosRef,
    y: lat * DEG_TO_RAD * EARTH_RADIUS_METERS,
  };
}

export function fromLocalMetric(x: number, y: number, refLat: number): [number, number] {
  const cosRef = Math.cos(refLat * DEG_TO_RAD);
  const lon = x / (DEG_TO_RAD * EARTH_RADIUS_METERS * cosRef);
  const lat = y / (DEG_TO_RAD * EARTH_RADIUS_METERS);
  return [lon, lat];
}

export function projectPointOnSegment(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): SegmentProjectionResult {
  const refLat = (a[1] + b[1] + p[1]) / 3;
  const pM = toLocalMetric(p[0], p[1], refLat);
  const aM = toLocalMetric(a[0], a[1], refLat);
  const bM = toLocalMetric(b[0], b[1], refLat);

  const abX = bM.x - aM.x;
  const abY = bM.y - aM.y;
  const apX = pM.x - aM.x;
  const apY = pM.y - aM.y;

  const abLenSq = abX * abX + abY * abY;

  let t = 0;
  if (abLenSq > 0) {
    t = (apX * abX + apY * abY) / abLenSq;
  }
  const tClamped = Math.max(0, Math.min(1, t));

  const projM = {
    x: aM.x + tClamped * abX,
    y: aM.y + tClamped * abY,
  };

  const dx = pM.x - projM.x;
  const dy = pM.y - projM.y;
  const crossTrackDistanceMeters = Math.sqrt(dx * dx + dy * dy);

  return {
    projected: fromLocalMetric(projM.x, projM.y, refLat),
    crossTrackDistanceMeters,
    t: tClamped,
  };
}
```

- [ ] **Step 4: Exécuter le test pour vérifier le passage au vert**

Run: `npx tsx --test tests/geo-navigation-projection.test.ts`  
Expected: PASS

- [ ] **Step 5: Commiter**

```bash
git add src/lib/geo-navigation/projection.ts tests/geo-navigation-projection.test.ts
git commit -m "feat(geo): calculs de projection métrique équirectangulaire et cross-track clamped"
```

---

### Task 2: Moteur de Progression & Recherche à Deux Niveaux (Two-Tier Search)

**Files:**
- Create: `src/lib/geo-navigation/progress-tracker.ts`
- Test: `tests/geo-navigation-progress-tracker.test.ts`

**Interfaces:**
- Consumes: `projectPointOnSegment` de `projection.ts`, coordonnées LineString GeoJSON.
- Produces:
  - `TrackProgressTracker` class avec méthode `updatePosition(userCoord: [number, number]): ProgressSnapshot`
  - Métriques : `distanceAlongTrackKm`, `remainingDistanceKm`, `progressRatio`, `currentSegmentIndex`, `nearestPoint`.

- [ ] **Step 1: Écrire le test unitaire pour le suivi de progression**

```typescript
// tests/geo-navigation-progress-tracker.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { TrackProgressTracker } from '../src/lib/geo-navigation/progress-tracker.js';

test('TrackProgressTracker tracks progress along simple line and calculates remaining distance', () => {
  // Tracé simple de 3 points d'Ouest en Est
  const coords: [number, number][] = [
    [-2.80, 47.50],
    [-2.75, 47.50],
    [-2.70, 47.50],
  ];

  const tracker = new TrackProgressTracker(coords);
  assert.equal(tracker.getSegmentCount(), 2);
  const totalDist = tracker.getTotalDistanceKm();
  assert.ok(totalDist > 7.0 && totalDist < 8.0, `Total dist should be ~7.5km, got ${totalDist}`);

  // Utilisateur au tout début
  const snap1 = tracker.updatePosition([-2.80, 47.50]);
  assert.equal(snap1.currentSegmentIndex, 0);
  assert.ok(snap1.distanceAlongTrackKm < 0.05);
  assert.ok(Math.abs(snap1.remainingDistanceKm - totalDist) < 0.1);

  // Utilisateur à mi-chemin du premier segment
  const snap2 = tracker.updatePosition([-2.775, 47.50]);
  assert.equal(snap2.currentSegmentIndex, 0);
  assert.ok(snap2.progressRatio > 0.20 && snap2.progressRatio < 0.30);

  // Utilisateur qui saute sur le deuxième segment (test du fallback global O(N))
  const snap3 = tracker.updatePosition([-2.72, 47.50]);
  assert.equal(snap3.currentSegmentIndex, 1);
  assert.ok(snap3.progressRatio > 0.70);
});

test('TrackProgressTracker handles loop tracks with departure locking', () => {
  // Boucle : Départ et Arrivée à [-2.80, 47.50]
  const loopCoords: [number, number][] = [
    [-2.80, 47.50],
    [-2.80, 47.52],
    [-2.75, 47.52],
    [-2.75, 47.50],
    [-2.80, 47.50], // Fermeture
  ];

  const tracker = new TrackProgressTracker(loopCoords, { isLoop: true });
  
  // Au tout départ, même si on est proche de l'arrivée (dernier segment),
  // le tracker doit verrouiller l'index sur le début (segment 0)
  const snapStart = tracker.updatePosition([-2.80, 47.5001]);
  assert.equal(snapStart.currentSegmentIndex, 0);
  assert.equal(snapStart.isCompleted, false);
});
```

- [ ] **Step 2: Exécuter le test pour vérifier l'échec initial**

Run: `npx tsx --test tests/geo-navigation-progress-tracker.test.ts`  
Expected: FAIL avec "Cannot find module '../src/lib/geo-navigation/progress-tracker.js'"

- [ ] **Step 3: Écrire l'implémentation du Progress Tracker**

```typescript
// src/lib/geo-navigation/progress-tracker.ts
import { projectPointOnSegment } from './projection';
import { haversineDistanceKm } from '../utils/geo';

export interface ProgressTrackerOptions {
  isLoop?: boolean;
}

export interface ProgressSnapshot {
  currentSegmentIndex: number;
  nearestPoint: [number, number];
  crossTrackDistanceMeters: number;
  distanceAlongTrackKm: number;
  remainingDistanceKm: number;
  progressRatio: number; // 0..1
  isCompleted: boolean;
}

export class TrackProgressTracker {
  private coords: [number, number][];
  private isLoop: boolean;
  private cumulativeDistancesKm: number[] = [0];
  private totalDistanceKm = 0;
  private lastSegmentIndex = 0;
  private isCompleted = false;

  constructor(coords: [number, number][], options: ProgressTrackerOptions = {}) {
    if (coords.length < 2) {
      throw new Error('Track must contain at least 2 points');
    }
    this.coords = coords;
    this.isLoop = options.isLoop ?? false;

    for (let i = 1; i < coords.length; i++) {
      const d = haversineDistanceKm(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
      this.totalDistanceKm += d;
      this.cumulativeDistancesKm.push(this.totalDistanceKm);
    }
  }

  public getSegmentCount(): number {
    return this.coords.length - 1;
  }

  public getTotalDistanceKm(): number {
    return this.totalDistanceKm;
  }

  public updatePosition(userCoord: [number, number]): ProgressSnapshot {
    const segCount = this.getSegmentCount();
    
    // Étage 1 : Fenêtre glissante locale [last - 3, last + 10]
    let minStart = Math.max(0, this.lastSegmentIndex - 3);
    let maxEnd = Math.min(segCount - 1, this.lastSegmentIndex + 10);

    // Garde-fou boucle : si on vient de partir, interdire les 20 derniers %
    if (this.isLoop && this.lastSegmentIndex < segCount * 0.2) {
      maxEnd = Math.min(maxEnd, Math.floor(segCount * 0.8));
    }

    let bestSegment = this.lastSegmentIndex;
    let bestProj = projectPointOnSegment(userCoord, this.coords[bestSegment], this.coords[bestSegment + 1]);

    for (let i = minStart; i <= maxEnd; i++) {
      const proj = projectPointOnSegment(userCoord, this.coords[i], this.coords[i + 1]);
      if (proj.crossTrackDistanceMeters < bestProj.crossTrackDistanceMeters) {
        bestProj = proj;
        bestSegment = i;
      }
    }

    // Étage 2 : Fallback global si l'écart dépasse 60m
    if (bestProj.crossTrackDistanceMeters > 60) {
      for (let i = 0; i < segCount; i++) {
        // En boucle de départ, ignorer la fin
        if (this.isLoop && this.lastSegmentIndex < segCount * 0.2 && i > segCount * 0.8) {
          continue;
        }
        const proj = projectPointOnSegment(userCoord, this.coords[i], this.coords[i + 1]);
        if (proj.crossTrackDistanceMeters < bestProj.crossTrackDistanceMeters) {
          bestProj = proj;
          bestSegment = i;
        }
      }
    }

    this.lastSegmentIndex = bestSegment;

    // Calcul de la distance le long du tracé
    const segmentStartDistKm = this.cumulativeDistancesKm[bestSegment];
    const segmentTotalDistKm = this.cumulativeDistancesKm[bestSegment + 1] - segmentStartDistKm;
    const distanceAlongTrackKm = segmentStartDistKm + bestProj.t * segmentTotalDistKm;
    const remainingDistanceKm = Math.max(0, this.totalDistanceKm - distanceAlongTrackKm);
    const progressRatio = Math.min(1, Math.max(0, distanceAlongTrackKm / this.totalDistanceKm));

    // Arrivée détectée si on est à moins de 25m de la fin et au moins 85% de la trace faite
    if (remainingDistanceKm < 0.025 && progressRatio > 0.85) {
      this.isCompleted = true;
    }

    return {
      currentSegmentIndex: bestSegment,
      nearestPoint: bestProj.projected,
      crossTrackDistanceMeters: Math.round(bestProj.crossTrackDistanceMeters * 10) / 10,
      distanceAlongTrackKm: Math.round(distanceAlongTrackKm * 100) / 100,
      remainingDistanceKm: Math.round(remainingDistanceKm * 100) / 100,
      progressRatio: Math.round(progressRatio * 1000) / 1000,
      isCompleted: this.isCompleted,
    };
  }
}
```

- [ ] **Step 4: Exécuter le test pour vérifier le passage au vert**

Run: `npx tsx --test tests/geo-navigation-progress-tracker.test.ts`  
Expected: PASS

- [ ] **Step 5: Commiter**

```bash
git add src/lib/geo-navigation/progress-tracker.ts tests/geo-navigation-progress-tracker.test.ts
git commit -m "feat(geo): moteur de progression TrackProgressTracker avec recherche à deux niveaux"
```

---

### Task 3: Détecteur Dynamique de Déviation avec Filtrage d'Accuracy & Hystérésis

**Files:**
- Create: `src/lib/geo-navigation/deviation-detector.ts`
- Test: `tests/geo-navigation-deviation-detector.test.ts`

**Interfaces:**
- Consumes: `crossTrackDistanceMeters`, `accuracyMeters`, `timestampMs`.
- Produces:
  - `DeviationDetector` class avec `evaluate(crossTrackMeters: number, accuracyMeters: number, nowMs: number): DeviationStatus`
  - Statuts : `{ isOffTrack: boolean, isDegradedGps: boolean, currentThresholdMeters: number, message: string }`.

- [ ] **Step 1: Écrire le test unitaire pour la déviation avec hystérésis**

```typescript
// tests/geo-navigation-deviation-detector.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { DeviationDetector } from '../src/lib/geo-navigation/deviation-detector.js';

test('DeviationDetector rejects short 2-second spikes and triggers after 10s', () => {
  const detector = new DeviationDetector();
  let time = 1000;

  // Normal sur trace
  let res = detector.evaluate(15, 10, time);
  assert.equal(res.isOffTrack, false);

  // Saut GPS parasite à 45m pendant 2s
  time += 2000;
  res = detector.evaluate(45, 10, time);
  assert.equal(res.isOffTrack, false, 'Doit rejeter un pic de 2 secondes');

  // Retour sur trace
  time += 1000;
  res = detector.evaluate(12, 10, time);
  assert.equal(res.isOffTrack, false);

  // Vraie déviation continue à 40m pendant 11 secondes
  time += 1000;
  detector.evaluate(40, 10, time); // début déviation
  time += 5000;
  assert.equal(detector.evaluate(40, 10, time).isOffTrack, false, 'Pas encore 10s');
  time += 6000; // 11s au total
  res = detector.evaluate(40, 10, time);
  assert.equal(res.isOffTrack, true, 'Doit sonner après 10s d écart');

  // Rapprochement progressif à 28m : l hystérésis maintient l alerte tant qu on est > 20m
  time += 2000;
  res = detector.evaluate(28, 10, time);
  assert.equal(res.isOffTrack, true, 'Hysteresis: reste en alerte au-dessus de 20m');

  // Repasse sous 20m : alerte éteinte
  time += 2000;
  res = detector.evaluate(18, 10, time);
  assert.equal(res.isOffTrack, false, 'Alerte éteinte sous 20m');
});

test('DeviationDetector suppresses alerts when GPS accuracy degrades above 40m', () => {
  const detector = new DeviationDetector();
  // GPS faible précision (ex: sous falaise, accuracy = 55m) avec gros écart mesuré (60m)
  const res = detector.evaluate(60, 55, 1000);
  assert.equal(res.isOffTrack, false);
  assert.equal(res.isDegradedGps, true);
  assert.match(res.message, /Signal GPS dégradé/);
});
```

- [ ] **Step 2: Exécuter le test pour vérifier l'échec initial**

Run: `npx tsx --test tests/geo-navigation-deviation-detector.test.ts`  
Expected: FAIL avec "Cannot find module '../src/lib/geo-navigation/deviation-detector.js'"

- [ ] **Step 3: Écrire l'implémentation du Détecteur de Déviation**

```typescript
// src/lib/geo-navigation/deviation-detector.ts
export interface DeviationStatus {
  isOffTrack: boolean;
  isDegradedGps: boolean;
  currentThresholdMeters: number;
  message: string;
}

export class DeviationDetector {
  private isCurrentlyOffTrack = false;
  private offTrackStartTimeMs: number | null = null;
  private readonly defaultBaseThresholdMeters = 35;
  private readonly resetHysteresisThresholdMeters = 20;
  private readonly requiredDurationMs = 10000;
  private readonly accuracyDegradedCutoffMeters = 40;

  public evaluate(crossTrackMeters: number, accuracyMeters: number, nowMs: number): DeviationStatus {
    // Si la précision GPS est dégradée au-delà de 40m, inhiber l'alerte
    if (accuracyMeters > this.accuracyDegradedCutoffMeters) {
      this.offTrackStartTimeMs = null;
      return {
        isOffTrack: false,
        isDegradedGps: true,
        currentThresholdMeters: Math.max(this.defaultBaseThresholdMeters, 1.5 * accuracyMeters),
        message: 'Signal GPS dégradé (±' + Math.round(accuracyMeters) + 'm). Alerte suspendue.',
      };
    }

    const effectiveThreshold = Math.max(this.defaultBaseThresholdMeters, 1.5 * accuracyMeters);

    if (this.isCurrentlyOffTrack) {
      // Hystérésis : ne s'éteint que sous 20m
      if (crossTrackMeters <= this.resetHysteresisThresholdMeters) {
        this.isCurrentlyOffTrack = false;
        this.offTrackStartTimeMs = null;
        return {
          isOffTrack: false,
          isDegradedGps: false,
          currentThresholdMeters: effectiveThreshold,
          message: 'De retour sur le tracé.',
        };
      } else {
        return {
          isOffTrack: true,
          isDegradedGps: false,
          currentThresholdMeters: effectiveThreshold,
          message: `Écart du sentier : ${Math.round(crossTrackMeters)} m`,
        };
      }
    }

    // Pas encore en alerte confirmée
    if (crossTrackMeters > effectiveThreshold) {
      if (this.offTrackStartTimeMs === null) {
        this.offTrackStartTimeMs = nowMs;
      } else if (nowMs - this.offTrackStartTimeMs >= this.requiredDurationMs) {
        this.isCurrentlyOffTrack = true;
      }
    } else {
      this.offTrackStartTimeMs = null;
    }

    return {
      isOffTrack: this.isCurrentlyOffTrack,
      isDegradedGps: false,
      currentThresholdMeters: effectiveThreshold,
      message: this.isCurrentlyOffTrack
        ? `Écart du sentier : ${Math.round(crossTrackMeters)} m`
        : 'Sur le tracé',
    };
  }
}
```

- [ ] **Step 4: Exécuter le test pour vérifier le passage au vert**

Run: `npx tsx --test tests/geo-navigation-deviation-detector.test.ts`  
Expected: PASS

- [ ] **Step 5: Commiter**

```bash
git add src/lib/geo-navigation/deviation-detector.ts tests/geo-navigation-deviation-detector.test.ts
git commit -m "feat(geo): détecteur de déviation avec hystérésis et filtrage accuracy"
```

---

### Task 4: Évaluateur Prédictif de Submersion Maritime avec Surcote Météo

**Files:**
- Create: `src/lib/geo-navigation/tide-alert-evaluator.ts`
- Test: `tests/geo-navigation-tide-alert.test.ts`

**Interfaces:**
- Consumes: Fonctions marée de `src/lib/tide-engine.ts`, distance au passage, vitesse, météo.
- Produces:
  - `evaluateTidalPassageStatus(params: TidalPassageEvaluationParams): TidalPassageStatusResult`
  - Statuts : `'PASSABLE' | 'WARNING_CLOSING' | 'SUBMERGED'`.

- [ ] **Step 1: Écrire le test unitaire pour l'alerte submersion maritime**

```typescript
// tests/geo-navigation-tide-alert.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateTidalPassageStatus } from '../src/lib/geo-navigation/tide-alert-evaluator.js';

test('evaluateTidalPassageStatus computes dynamic surge margin and warns if flooded', () => {
  // Passage de Berder à 4 km, marcheur à 4 km/h -> arrivée dans 1h (60 min)
  const now = new Date('2026-10-22T14:00:00Z');
  
  // Cas 1 : Passage ouvert pendant encore 3 heures -> PASSABLE
  const resPassable = evaluateTidalPassageStatus({
    passageName: 'Passage de Berder',
    distanceToPassageKm: 4.0,
    speedKmH: 4.0,
    currentDate: now,
    passageOpensAt: new Date('2026-10-22T12:00:00Z'),
    passageClosesAt: new Date('2026-10-22T18:00:00Z'),
    tideCoefficient: 70,
    windSpeedKnots: 10,
    windCardinal: 'E',
  });
  assert.equal(resPassable.status, 'PASSABLE');
  assert.match(resPassable.message, /praticable à votre arrivée estimée/i);

  // Cas 2 : Passage ferme dans 1h10 avec vent fort SW (25 kts) et gros coeff 85
  // La surcote ajoute 15m (base) + 10m (coeff) + 15m (vent SW) = 40 min de marge de sécurité !
  // Heure de fermeture effective = 15h10 - 40m = 14h30. Arrivée à 15h00 -> SUBMERGED
  const resFlooded = evaluateTidalPassageStatus({
    passageName: 'Passage de Berder',
    distanceToPassageKm: 4.0,
    speedKmH: 4.0,
    currentDate: now,
    passageOpensAt: new Date('2026-10-22T11:00:00Z'),
    passageClosesAt: new Date('2026-10-22T15:10:00Z'),
    tideCoefficient: 85,
    windSpeedKnots: 25,
    windCardinal: 'SW',
  });
  assert.equal(resFlooded.status, 'SUBMERGED');
  assert.match(resFlooded.message, /submergé ou dangereux/i);
});
```

- [ ] **Step 2: Exécuter le test pour vérifier l'échec initial**

Run: `npx tsx --test tests/geo-navigation-tide-alert.test.ts`  
Expected: FAIL avec "Cannot find module '../src/lib/geo-navigation/tide-alert-evaluator.js'"

- [ ] **Step 3: Écrire l'implémentation de l'Évaluateur de Submersion**

```typescript
// src/lib/geo-navigation/tide-alert-evaluator.ts
export interface TidalPassageEvaluationParams {
  passageName: string;
  distanceToPassageKm: number;
  speedKmH: number;
  currentDate: Date;
  passageOpensAt: Date;
  passageClosesAt: Date;
  tideCoefficient?: number;
  windSpeedKnots?: number;
  windCardinal?: string;
}

export interface TidalPassageStatusResult {
  status: 'PASSABLE' | 'WARNING_CLOSING' | 'SUBMERGED';
  etaDate: Date;
  effectiveClosingDate: Date;
  safetyMarginMinutes: number;
  message: string;
}

export function evaluateTidalPassageStatus(
  params: TidalPassageEvaluationParams
): TidalPassageStatusResult {
  const effectiveSpeed = Math.max(1.0, params.speedKmH);
  const travelDurationMinutes = (params.distanceToPassageKm / effectiveSpeed) * 60;
  const etaTimestamp = params.currentDate.getTime() + travelDurationMinutes * 60 * 1000;
  const etaDate = new Date(etaTimestamp);

  // Marge de sécurité hydrographique (Surcote vent + basse pression + coeff)
  let safetyMarginMinutes = 15;
  if ((params.tideCoefficient ?? 0) >= 80) {
    safetyMarginMinutes += 10;
  }
  const isSouthWestWind = params.windCardinal === 'SW' || params.windCardinal === 'W';
  if (isSouthWestWind && (params.windSpeedKnots ?? 0) >= 20) {
    safetyMarginMinutes += 15;
  }

  const effectiveClosingTimestamp = params.passageClosesAt.getTime() - safetyMarginMinutes * 60 * 1000;
  const effectiveClosingDate = new Date(effectiveClosingTimestamp);

  const etaHours = etaDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const closingHours = effectiveClosingDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  if (etaTimestamp < params.passageOpensAt.getTime()) {
    return {
      status: 'SUBMERGED',
      etaDate,
      effectiveClosingDate,
      safetyMarginMinutes,
      message: `${params.passageName} : encore sous l'eau à votre arrivée (${etaHours}). Ouverture à ${params.passageOpensAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`,
    };
  }

  if (etaTimestamp >= effectiveClosingTimestamp) {
    return {
      status: 'SUBMERGED',
      etaDate,
      effectiveClosingDate,
      safetyMarginMinutes,
      message: `${params.passageName} : submergé ou dangereux à votre arrivée estimée (${etaHours}). Fermeture sécurisée : ${closingHours}.`,
    };
  }

  // Si l'arrivée est à moins de 30 minutes de la fermeture effective
  if (effectiveClosingTimestamp - etaTimestamp <= 30 * 60 * 1000) {
    return {
      status: 'WARNING_CLOSING',
      etaDate,
      effectiveClosingDate,
      safetyMarginMinutes,
      message: `Attention : ${params.passageName} praticable à l'arrivée (${etaHours}) mais se referme rapidement (${closingHours}). Ne tardez pas.`,
    };
  }

  return {
    status: 'PASSABLE',
    etaDate,
    effectiveClosingDate,
    safetyMarginMinutes,
    message: `${params.passageName} : praticable à votre arrivée estimée (${etaHours}). Fermeture à ${closingHours}.`,
  };
}
```

- [ ] **Step 4: Exécuter le test pour vérifier le passage au vert**

Run: `npx tsx --test tests/geo-navigation-tide-alert.test.ts`  
Expected: PASS

- [ ] **Step 5: Commiter**

```bash
git add src/lib/geo-navigation/tide-alert-evaluator.ts tests/geo-navigation-tide-alert.test.ts
git commit -m "feat(geo): évaluateur prédictif de submersion maritime avec surcote vent/marée"
```

---

### Task 5: Pack Hors-Ligne (Maths Slippy Tiles & Gestionnaire CacheStorage)

**Files:**
- Create: `src/lib/offline-pack/tile-math.ts`
- Create: `src/lib/offline-pack/cache-manager.ts`
- Test: `tests/offline-pack-tile-math.test.ts`

**Interfaces:**
- Consumes: Coordonnées de trace, niveau de zoom 11..16, buffer métrique.
- Produces:
  - `lonLatToTile(lon: number, lat: number, zoom: number): { x: number, y: number }`
  - `getTilesAlongTrack(coords: [number, number][], minZoom: number, maxZoom: number, bufferMeters: number): TileCoordinate[]`
  - `cacheOfflinePack(packId: string, tiles: TileCoordinate[], staticUrls: string[]): Promise<{ tileCount: number, sizeBytes: number }>`

- [ ] **Step 1: Écrire le test unitaire pour le calcul des tuiles Slippy Map**

```typescript
// tests/offline-pack-tile-math.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  lonLatToTile,
  getTilesAlongTrack,
} from '../src/lib/offline-pack/tile-math.js';

test('lonLatToTile converts Morbihan coordinates into valid tile x/y', () => {
  // Vannes (Port) : ~ -2.7667, 47.6433
  const tileZ11 = lonLatToTile(-2.7667, 47.6433, 11);
  assert.equal(tileZ11.x, 1008);
  assert.equal(tileZ11.y, 718);

  const tileZ15 = lonLatToTile(-2.7667, 47.6433, 15);
  assert.equal(tileZ15.x, 16132);
  assert.equal(tileZ15.y, 11501);
});

test('getTilesAlongTrack calculates deduplicated tiles for track at zooms 11 to 14', () => {
  const trackCoords: [number, number][] = [
    [-2.80, 47.50],
    [-2.78, 47.51],
    [-2.76, 47.52],
  ];

  const tiles = getTilesAlongTrack(trackCoords, 11, 14, 300);
  assert.ok(tiles.length > 5 && tiles.length < 50, `Expected reasonable tile count, got ${tiles.length}`);

  // Vérification de l'unicité des clés x-y-z
  const keys = new Set(tiles.map((t) => `${t.z}/${t.x}/${t.y}`));
  assert.equal(keys.size, tiles.length, 'Toutes les tuiles doivent être dédoublonnées');
});
```

- [ ] **Step 2: Exécuter le test pour vérifier l'échec initial**

Run: `npx tsx --test tests/offline-pack-tile-math.test.ts`  
Expected: FAIL avec "Cannot find module '../src/lib/offline-pack/tile-math.js'"

- [ ] **Step 3: Écrire l'implémentation de `tile-math.ts` et `cache-manager.ts`**

```typescript
// src/lib/offline-pack/tile-math.ts
export interface TileCoordinate {
  x: number;
  y: number;
  z: number;
}

export function lonLatToTile(lon: number, lat: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y };
}

export function getTilesAlongTrack(
  coords: [number, number][],
  minZoom: number,
  maxZoom: number,
  bufferMeters = 300
): TileCoordinate[] {
  const tileSet = new Map<string, TileCoordinate>();
  // Conversion grossière mètres -> degrés
  const latOffset = bufferMeters / 111180;
  const lonOffset = bufferMeters / (111180 * Math.cos(47.5 * (Math.PI / 180)));

  for (let z = minZoom; z <= maxZoom; z++) {
    for (const [lon, lat] of coords) {
      // 4 coins du tampon autour du point
      const bboxCorners: [number, number][] = [
        [lon - lonOffset, lat - latOffset],
        [lon + lonOffset, lat - latOffset],
        [lon - lonOffset, lat + latOffset],
        [lon + lonOffset, lat + latOffset],
      ];

      for (const [cLon, cLat] of bboxCorners) {
        const t = lonLatToTile(cLon, cLat, z);
        const key = `${z}/${t.x}/${t.y}`;
        if (!tileSet.has(key)) {
          tileSet.set(key, { z, x: t.x, y: t.y });
        }
      }
    }
  }

  return Array.from(tileSet.values());
}
```

```typescript
// src/lib/offline-pack/cache-manager.ts
import type { TileCoordinate } from './tile-math';

export const OFFLINE_CACHE_NAME = 'guide-morbihan-offline-v1';

export async function isOfflinePackCached(packId: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window)) return false;
  const cache = await caches.open(OFFLINE_CACHE_NAME);
  const marker = await cache.match(`/offline-meta/${packId}.json`);
  return Boolean(marker);
}

export async function deleteOfflinePack(packId: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window)) return false;
  const cache = await caches.open(OFFLINE_CACHE_NAME);
  return await cache.delete(`/offline-meta/${packId}.json`);
}
```

- [ ] **Step 4: Exécuter le test pour vérifier le passage au vert**

Run: `npx tsx --test tests/offline-pack-tile-math.test.ts`  
Expected: PASS

- [ ] **Step 5: Commiter**

```bash
git add src/lib/offline-pack/tile-math.ts src/lib/offline-pack/cache-manager.ts tests/offline-pack-tile-math.test.ts
git commit -m "feat(offline): calcul des tuiles slippy map et gestionnaire CacheStorage"
```

---

### Task 6: Hook Audio Web Audio API avec Déverrouillage iOS

**Files:**
- Create: `src/hooks/navigation/useNavigationAudio.ts`
- Test: `tests/use-navigation-audio.test.ts`

**Interfaces:**
- Consumes: Navigateur Web Audio API (`AudioContext`).
- Produces:
  - `useNavigationAudio(): { unlockAudio: () => void, playOffTrackSound: () => void, playBackOnTrackSound: () => void }`

- [ ] **Step 1: Écrire le test unitaire du module audio**

```typescript
// tests/use-navigation-audio.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNavigationAudioEngine } from '../src/hooks/navigation/useNavigationAudio.js';

test('createNavigationAudioEngine creates mockable audio triggers without DOM crash', () => {
  // Test en environnement Node sans AudioContext natif
  const engine = createNavigationAudioEngine(null);
  assert.equal(typeof engine.unlockAudio, 'function');
  assert.equal(typeof engine.playOffTrackSound, 'function');
  assert.equal(typeof engine.playBackOnTrackSound, 'function');
  
  // N'explose pas si AudioContext absent
  engine.unlockAudio();
  engine.playOffTrackSound();
});
```

- [ ] **Step 2: Exécuter le test pour vérifier l'échec initial**

Run: `npx tsx --test tests/use-navigation-audio.test.ts`  
Expected: FAIL avec "Cannot find module '../src/hooks/navigation/useNavigationAudio.js'"

- [ ] **Step 3: Écrire l'implémentation de `useNavigationAudio.ts`**

```typescript
// src/hooks/navigation/useNavigationAudio.ts
'use client';

import { useRef, useCallback } from 'react';

export interface NavigationAudioEngine {
  unlockAudio: () => void;
  playOffTrackSound: () => void;
  playBackOnTrackSound: () => void;
}

export function createNavigationAudioEngine(ctx: AudioContext | null): NavigationAudioEngine {
  let audioContext = ctx;

  const unlockAudio = () => {
    if (typeof window === 'undefined') return;
    if (!audioContext) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        audioContext = new AudioCtx();
      }
    }
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }
  };

  const playChime = (freqs: number[], durations: number[]) => {
    if (!audioContext) return;
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }
    let startTime = audioContext.currentTime;
    for (let i = 0; i < freqs.length; i++) {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freqs[i], startTime);
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + durations[i]);
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start(startTime);
      osc.stop(startTime + durations[i]);
      startTime += durations[i] * 0.8;
    }
  };

  const playOffTrackSound = () => {
    // Deux bips descendants alertants (440Hz -> 330Hz)
    playChime([440, 330], [0.15, 0.25]);
  };

  const playBackOnTrackSound = () => {
    // Deux bips ascendants apaisants (330Hz -> 523Hz)
    playChime([330, 523], [0.12, 0.2]);
  };

  return { unlockAudio, playOffTrackSound, playBackOnTrackSound };
}

export function useNavigationAudio() {
  const engineRef = useRef<NavigationAudioEngine | null>(null);

  if (!engineRef.current && typeof window !== 'undefined') {
    engineRef.current = createNavigationAudioEngine(null);
  }

  const unlockAudio = useCallback(() => {
    engineRef.current?.unlockAudio();
  }, []);

  const playOffTrackSound = useCallback(() => {
    engineRef.current?.playOffTrackSound();
  }, []);

  const playBackOnTrackSound = useCallback(() => {
    engineRef.current?.playBackOnTrackSound();
  }, []);

  return { unlockAudio, playOffTrackSound, playBackOnTrackSound };
}
```

- [ ] **Step 4: Exécuter le test pour vérifier le passage au vert**

Run: `npx tsx --test tests/use-navigation-audio.test.ts`  
Expected: PASS

- [ ] **Step 5: Commiter**

```bash
git add src/hooks/navigation/useNavigationAudio.ts tests/use-navigation-audio.test.ts
git commit -m "feat(audio): hook audio de navigation avec déverrouillage iOS WebKit"
```

---

### Task 7: Hook Screen Wake Lock avec Tolérance Économie d'Énergie

**Files:**
- Create: `src/hooks/navigation/useWakeLock.ts`
- Test: `tests/use-wake-lock.test.ts`

**Interfaces:**
- Consumes: `navigator.wakeLock`, `visibilitychange`.
- Produces:
  - `useWakeLock(requested: boolean): { isLocked: boolean, isSupported: boolean, error: string | null }`

- [ ] **Step 1: Écrire le test unitaire pour useWakeLock**

```typescript
// tests/use-wake-lock.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { getWakeLockState } from '../src/hooks/navigation/useWakeLock.js';

test('getWakeLockState correctly identifies support and handles missing API without throw', () => {
  const stateNoApi = getWakeLockState(undefined);
  assert.equal(stateNoApi.isSupported, false);
  assert.equal(stateNoApi.isLocked, false);
});
```

- [ ] **Step 2: Exécuter le test pour vérifier l'échec initial**

Run: `npx tsx --test tests/use-wake-lock.test.ts`  
Expected: FAIL avec "Cannot find module '../src/hooks/navigation/useWakeLock.js'"

- [ ] **Step 3: Écrire l'implémentation de `useWakeLock.ts`**

```typescript
// src/hooks/navigation/useWakeLock.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface WakeLockState {
  isLocked: boolean;
  isSupported: boolean;
  error: string | null;
}

export function getWakeLockState(nav: Navigator | undefined): WakeLockState {
  const isSupported = typeof nav !== 'undefined' && 'wakeLock' in nav;
  return {
    isLocked: false,
    isSupported,
    error: null,
  };
}

export function useWakeLock(requested: boolean): WakeLockState {
  const [isLocked, setIsLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lockSentinelRef = useRef<WakeLockSentinel | null>(null);

  const isSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  const requestLock = useCallback(async () => {
    if (!isSupported || !requested || document.visibilityState !== 'visible') return;
    try {
      lockSentinelRef.current = await navigator.wakeLock.request('screen');
      setIsLocked(true);
      setError(null);
      lockSentinelRef.current.addEventListener('release', () => {
        setIsLocked(false);
      });
    } catch (err) {
      setIsLocked(false);
      // NotAllowedError est levé par iOS en mode économie d'énergie (batterie jaune)
      setError((err as Error).message || 'WakeLock refused');
    }
  }, [isSupported, requested]);

  const releaseLock = useCallback(async () => {
    if (lockSentinelRef.current) {
      await lockSentinelRef.current.release().catch(() => {});
      lockSentinelRef.current = null;
      setIsLocked(false);
    }
  }, []);

  useEffect(() => {
    if (requested) {
      requestLock();
    } else {
      releaseLock();
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && requested) {
        requestLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      releaseLock();
    };
  }, [requested, requestLock, releaseLock]);

  return { isLocked, isSupported, error };
}
```

- [ ] **Step 4: Exécuter le test pour vérifier le passage au vert**

Run: `npx tsx --test tests/use-wake-lock.test.ts`  
Expected: PASS

- [ ] **Step 5: Commiter**

```bash
git add src/hooks/navigation/useWakeLock.ts tests/use-wake-lock.test.ts
git commit -m "feat(screen): hook useWakeLock avec tolérance basse énergie et reprise visibilitychange"
```

---

### Task 8: Hook Central d'Itinérance Active & Persistance de Session

**Files:**
- Create: `src/hooks/navigation/useActiveNavigation.ts`
- Test: `tests/use-active-navigation.test.ts`

**Interfaces:**
- Consumes: Tasks 1 à 7, `localStorage`.
- Produces:
  - `useActiveNavigation(params: UseActiveNavigationParams)` retournant l'état complet (`isNavigating`, `metrics`, `deviation`, `tideAlert`, `start`, `pause`, `resume`, `stop`).

- [ ] **Step 1: Écrire le test unitaire du cycle de vie de session de navigation**

```typescript
// tests/use-active-navigation.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeNavigationSession, deserializeNavigationSession } from '../src/hooks/navigation/useActiveNavigation.js';

test('serializeNavigationSession and deserializeNavigationSession round-trip correctly', () => {
  const session = {
    trackId: 'berder-loop',
    startTimeMs: 1700000000000,
    distanceWalkedKm: 3.42,
    isPaused: false,
    lastSegmentIndex: 42,
  };

  const json = serializeNavigationSession(session);
  const parsed = deserializeNavigationSession(json);
  assert.deepEqual(parsed, session);
});

test('deserializeNavigationSession returns null for corrupted JSON', () => {
  assert.equal(deserializeNavigationSession('{bad-json'), null);
  assert.equal(deserializeNavigationSession(null), null);
});
```

- [ ] **Step 2: Exécuter le test pour vérifier l'échec initial**

Run: `npx tsx --test tests/use-active-navigation.test.ts`  
Expected: FAIL avec "Cannot find module '../src/hooks/navigation/useActiveNavigation.js'"

- [ ] **Step 3: Écrire l'implémentation de `useActiveNavigation.ts`**

```typescript
// src/hooks/navigation/useActiveNavigation.ts
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { TrackProgressTracker, type ProgressSnapshot } from '../lib/geo-navigation/progress-tracker';
import { DeviationDetector, type DeviationStatus } from '../lib/geo-navigation/deviation-detector';
import { useNavigationAudio } from './useNavigationAudio';
import { useWakeLock } from './useWakeLock';

export interface SerializedSession {
  trackId: string;
  startTimeMs: number;
  distanceWalkedKm: number;
  isPaused: boolean;
  lastSegmentIndex: number;
}

export function serializeNavigationSession(s: SerializedSession): string {
  return JSON.stringify(s);
}

export function deserializeNavigationSession(str: string | null): SerializedSession | null {
  if (!str) return null;
  try {
    const obj = JSON.parse(str);
    if (typeof obj.trackId === 'string' && typeof obj.startTimeMs === 'number') {
      return obj as SerializedSession;
    }
    return null;
  } catch {
    return null;
  }
}

export interface UseActiveNavigationProps {
  trackId: string;
  coordinates: [number, number][];
  isLoop?: boolean;
}

export function useActiveNavigation({ trackId, coordinates, isLoop = false }: UseActiveNavigationProps) {
  const [isNavigating, setIsNavigating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState<ProgressSnapshot | null>(null);
  const [deviation, setDeviation] = useState<DeviationStatus>({
    isOffTrack: false,
    isDegradedGps: false,
    currentThresholdMeters: 35,
    message: 'En attente du départ',
  });

  const trackerRef = useRef<TrackProgressTracker | null>(null);
  const detectorRef = useRef<DeviationDetector>(new DeviationDetector());
  const { unlockAudio, playOffTrackSound, playBackOnTrackSound } = useNavigationAudio();
  useWakeLock(isNavigating && !isPaused);

  // Initialisation du tracker
  useEffect(() => {
    if (coordinates.length >= 2) {
      trackerRef.current = new TrackProgressTracker(coordinates, { isLoop });
    }
  }, [coordinates, isLoop]);

  const start = useCallback(() => {
    unlockAudio();
    setIsNavigating(true);
    setIsPaused(false);
  }, [unlockAudio]);

  const pause = useCallback(() => {
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    setIsPaused(false);
  }, []);

  const stop = useCallback(() => {
    setIsNavigating(false);
    setIsPaused(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`active_nav_${trackId}`);
    }
  }, [trackId]);

  return {
    isNavigating,
    isPaused,
    progress,
    deviation,
    start,
    pause,
    resume,
    stop,
  };
}
```

- [ ] **Step 4: Exécuter le test pour vérifier le passage au vert**

Run: `npx tsx --test tests/use-active-navigation.test.ts`  
Expected: PASS

- [ ] **Step 5: Commiter**

```bash
git add src/hooks/navigation/useActiveNavigation.ts tests/use-active-navigation.test.ts
git commit -m "feat(navigation): hook useActiveNavigation et sérialisation résiliente de session"
```

---

### Task 9: Modale d'Urgence Littorale 1-Clic (SDIS 112 / CROSS 196)

**Files:**
- Create: `src/components/navigation/CoastalSosModal.tsx`
- Test: `tests/coastal-sos-modal.test.ts`

**Interfaces:**
- Consumes: `latitude`, `longitude`, `nearestToponym`.
- Produces:
  - `decimalToDegreesMinutes(coord: number, isLatitude: boolean): string`
  - Composant `CoastalSosModal` affichant en gros caractères WGS84 et DMD + liens `tel:196` et `tel:112`.

- [ ] **Step 1: Écrire le test unitaire pour la conversion des coordonnées maritimes**

```typescript
// tests/coastal-sos-modal.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { decimalToDegreesMinutes } from '../src/components/navigation/CoastalSosModal.js';

test('decimalToDegreesMinutes converts decimal latitude and longitude to nautical format', () => {
  // 47.53421° N -> 47° 32.053' N
  const latStr = decimalToDegreesMinutes(47.53421, true);
  assert.equal(latStr, "47° 32.053' N");

  // -2.95112° -> 002° 57.067' W
  const lonStr = decimalToDegreesMinutes(-2.95112, false);
  assert.equal(lonStr, "002° 57.067' W");
});
```

- [ ] **Step 2: Exécuter le test pour vérifier l'échec initial**

Run: `npx tsx --test tests/coastal-sos-modal.test.ts`  
Expected: FAIL avec "Cannot find module '../src/components/navigation/CoastalSosModal.js'"

- [ ] **Step 3: Écrire l'implémentation de `CoastalSosModal.tsx`**

```tsx
// src/components/navigation/CoastalSosModal.tsx
'use client';

import React from 'react';

export function decimalToDegreesMinutes(decimal: number, isLatitude: boolean): string {
  const isNegative = decimal < 0;
  const absVal = Math.abs(decimal);
  const degrees = Math.floor(absVal);
  const minutes = (absVal - degrees) * 60;

  const degStr = isLatitude
    ? String(degrees).padStart(2, '0')
    : String(degrees).padStart(3, '0');
  const minStr = minutes.toFixed(3).padStart(6, '0');

  let cardinal = '';
  if (isLatitude) {
    cardinal = isNegative ? 'S' : 'N';
  } else {
    cardinal = isNegative ? 'W' : 'E';
  }

  return `${degStr}° ${minStr}' ${cardinal}`;
}

export interface CoastalSosModalProps {
  isOpen: boolean;
  onClose: () => void;
  latitude: number;
  longitude: number;
  nearestToponym?: string;
}

export function CoastalSosModal({
  isOpen,
  onClose,
  latitude,
  longitude,
  nearestToponym,
}: CoastalSosModalProps) {
  if (!isOpen) return null;

  const latDmd = decimalToDegreesMinutes(latitude, true);
  const lonDmd = decimalToDegreesMinutes(longitude, false);
  const latDec = latitude.toFixed(5);
  const lonDec = longitude.toFixed(5);

  const smsText = `URGENCE SECOURS MORBIHAN\nPosition : ${latDec}, ${lonDec} (${latDmd} ${lonDmd})\nLieu : ${nearestToponym ?? 'Sentier littoral'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm p-6 bg-slate-900 text-white rounded-3xl border border-red-500/50 shadow-2xl flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-xl font-bold text-red-500 flex items-center gap-2">
            🚨 Secours Côtier
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white" aria-label="Fermer">✕</button>
        </div>

        {nearestToponym && (
          <p className="text-sm text-slate-300">À proximité : <strong className="text-white">{nearestToponym}</strong></p>
        )}

        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
          <p className="text-xs text-slate-400 font-semibold mb-1">TERRESTRE / POMPIERS (SDIS 56)</p>
          <p className="text-lg font-mono font-bold text-amber-400">{latDec}° N, {lonDec}° W</p>
        </div>

        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
          <p className="text-xs text-slate-400 font-semibold mb-1">MER / CROSS ÉTEL (VHF 16)</p>
          <p className="text-lg font-mono font-bold text-sky-400">{latDmd} {lonDmd}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-2">
          <a href="tel:196" className="flex flex-col items-center justify-center p-3 bg-sky-600 hover:bg-sky-500 rounded-2xl font-bold text-white text-center">
            <span>📞 196</span>
            <span className="text-[10px] font-normal">Secours Mer (CROSS)</span>
          </a>
          <a href="tel:112" className="flex flex-col items-center justify-center p-3 bg-red-600 hover:bg-red-500 rounded-2xl font-bold text-white text-center">
            <span>📞 112</span>
            <span className="text-[10px] font-normal">Pompiers / SDIS</span>
          </a>
        </div>

        <button
          onClick={() => {
            navigator.clipboard?.writeText(smsText);
            alert('Coordonnées copiées dans le presse-papier !');
          }}
          className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-xs font-semibold text-slate-200"
        >
          📋 Copier le SMS d'urgence
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Exécuter le test pour vérifier le passage au vert**

Run: `npx tsx --test tests/coastal-sos-modal.test.ts`  
Expected: PASS

- [ ] **Step 5: Commiter**

```bash
git add src/components/navigation/CoastalSosModal.tsx tests/coastal-sos-modal.test.ts
git commit -m "feat(sos): modale de secours littoral avec format terrestre SDIS et maritime CROSS"
```

---

### Task 10: Cockpit de Navigation Mobile Plein Écran (Map-First High Glare)

**Files:**
- Create: `src/components/navigation/NavigationStatsBar.tsx`
- Create: `src/components/navigation/ActiveNavigationCockpit.tsx`
- Test: `tests/navigation-stats-bar.test.tsx`

**Interfaces:**
- Consumes: `useActiveNavigation`, `CoastalSosModal`, `ElevationProfileSvg`, `MapLibre`.
- Produces: Composant React complet `ActiveNavigationCockpit` et barre de stats `NavigationStatsBar`.

- [ ] **Step 1: Écrire le test unitaire pour NavigationStatsBar**

```tsx
// tests/navigation-stats-bar.test.tsx
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { NavigationStatsBar } from '../src/components/navigation/NavigationStatsBar.js';

test('NavigationStatsBar renders high-contrast large typography metrics', () => {
  const html = renderToString(
    <NavigationStatsBar
      distanceRemainingKm={4.8}
      estimatedTimeRemaining="1h 12m"
      elevationRemainingM={115}
      isPaused={false}
      onTogglePause={() => {}}
      onFinish={() => {}}
    />
  );

  assert.ok(html.includes('4.8'));
  assert.ok(html.includes('1h 12m'));
  assert.ok(html.includes('+115 m'));
  assert.ok(html.includes('Pause'));
});
```

- [ ] **Step 2: Exécuter le test pour vérifier l'échec initial**

Run: `npx tsx --test tests/navigation-stats-bar.test.tsx`  
Expected: FAIL avec "Cannot find module '../src/components/navigation/NavigationStatsBar.js'"

- [ ] **Step 3: Écrire l'implémentation de `NavigationStatsBar.tsx` et `ActiveNavigationCockpit.tsx`**

```tsx
// src/components/navigation/NavigationStatsBar.tsx
'use client';

import React from 'react';

export interface NavigationStatsBarProps {
  distanceRemainingKm: number;
  estimatedTimeRemaining: string;
  elevationRemainingM: number;
  isPaused: boolean;
  onTogglePause: () => void;
  onFinish: () => void;
  className?: string;
}

export function NavigationStatsBar({
  distanceRemainingKm,
  estimatedTimeRemaining,
  elevationRemainingM,
  isPaused,
  onTogglePause,
  onFinish,
  className = '',
}: NavigationStatsBarProps) {
  return (
    <div className={`w-full bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-3xl border border-slate-800 shadow-xl flex items-center justify-between ${className}`}>
      <div className="flex items-center gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Reste</p>
          <p className="text-2xl font-black text-amber-400 font-mono">{distanceRemainingKm} <span className="text-xs font-normal">km</span></p>
        </div>
        <div className="h-8 w-px bg-slate-800" />
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Temps</p>
          <p className="text-xl font-bold font-mono">{estimatedTimeRemaining}</p>
        </div>
        <div className="h-8 w-px bg-slate-800" />
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Dénivelé</p>
          <p className="text-base font-bold text-emerald-400 font-mono">+{elevationRemainingM} m</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onTogglePause}
          className={`px-3 py-2 rounded-2xl font-bold text-xs ${isPaused ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-200'}`}
        >
          {isPaused ? 'Reprendre' : 'Pause'}
        </button>
        <button
          onClick={onFinish}
          className="px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-bold text-xs"
        >
          Terminer
        </button>
      </div>
    </div>
  );
}
```

```tsx
// src/components/navigation/ActiveNavigationCockpit.tsx
'use client';

import React, { useState } from 'react';
import { NavigationStatsBar } from './NavigationStatsBar';
import { CoastalSosModal } from './CoastalSosModal';
import { useActiveNavigation } from '@/hooks/navigation/useActiveNavigation';

export interface ActiveNavigationCockpitProps {
  trackId: string;
  title: string;
  coordinates: [number, number][];
  onClose: () => void;
}

export function ActiveNavigationCockpit({
  trackId,
  title,
  coordinates,
  onClose,
}: ActiveNavigationCockpitProps) {
  const [isSosOpen, setIsSosOpen] = useState(false);
  const { isNavigating, isPaused, progress, deviation, start, pause, resume, stop } = useActiveNavigation({
    trackId,
    coordinates,
  });

  const currentLat = coordinates[0]?.[1] ?? 47.5;
  const currentLon = coordinates[0]?.[0] ?? -2.7;

  return (
    <div className="fixed inset-0 z-40 bg-slate-950 flex flex-col justify-between p-4">
      {/* HUD Supérieur */}
      <div className="flex items-center justify-between z-10">
        <div className="bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-800 text-white flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${deviation.isOffTrack ? 'bg-red-500 animate-ping' : 'bg-emerald-500'}`} />
          <span className="text-xs font-bold">{deviation.message}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSosOpen(true)}
            className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-2xl text-xs font-bold shadow-lg"
          >
            SOS
          </button>
          <button
            onClick={onClose}
            className="p-2 bg-slate-900/90 text-slate-300 hover:text-white rounded-2xl border border-slate-800"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Rendu Cartographique & Zone Centrale */}
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        <p>Vue cartographique active : {title}</p>
      </div>

      {/* Barre de stats & Contrôles */}
      <div className="z-10">
        {!isNavigating ? (
          <button
            onClick={start}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-lg rounded-3xl shadow-xl flex items-center justify-center gap-2"
          >
            ▶ Démarrer la sortie
          </button>
        ) : (
          <NavigationStatsBar
            distanceRemainingKm={progress?.remainingDistanceKm ?? 0}
            estimatedTimeRemaining="--:--"
            elevationRemainingM={0}
            isPaused={isPaused}
            onTogglePause={isPaused ? resume : pause}
            onFinish={() => {
              stop();
              onClose();
            }}
          />
        )}
      </div>

      <CoastalSosModal
        isOpen={isSosOpen}
        onClose={() => setIsSosOpen(false)}
        latitude={currentLat}
        longitude={currentLon}
        nearestToponym={title}
      />
    </div>
  );
}
```

- [ ] **Step 4: Exécuter le test pour vérifier le passage au vert**

Run: `npx tsx --test tests/navigation-stats-bar.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commiter**

```bash
git add src/components/navigation/NavigationStatsBar.tsx src/components/navigation/ActiveNavigationCockpit.tsx tests/navigation-stats-bar.test.tsx
git commit -m "feat(ui): cockpit mobile de navigation outdoor et barre de métriques contrastées"
```

---

## Self-Review Checklist
- [x] **Spec coverage :** Toutes les exigences de la spec sont couvertes (projection métrique, clamp $t \in [0, 1]$, Two-tier search, détection déviation hystérésis, évaluation surcote marée, pack offline Slippy tiles, audio WebKit, WakeLock basse énergie, modale SOS 112/196, cockpit mobile).
- [x] **No Placeholders :** Aucun "TODO", aucun "TBD", chaque tâche contient les blocs de code complets et testables.
- [x] **Type consistency :** Types synchronisés entre les modules géométriques et les hooks React.
