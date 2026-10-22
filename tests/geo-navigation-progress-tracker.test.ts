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

test('TrackProgressTracker throws when coordinates length is less than 2', () => {
  assert.throws(
    () => new TrackProgressTracker([[-2.80, 47.50]]),
    /Track must contain at least 2 points/
  );
  assert.throws(
    () => new TrackProgressTracker([]),
    /Track must contain at least 2 points/
  );
});

test('TrackProgressTracker detects completion when near finish with >85% progress', () => {
  // Tracé régulier de 11 points (10 segments)
  const coords: [number, number][] = [];
  for (let i = 0; i <= 10; i++) {
    coords.push([-2.80 + i * 0.01, 47.50]);
  }

  const tracker = new TrackProgressTracker(coords);

  // Utilisateur avance progressivement
  tracker.updatePosition([-2.75, 47.50]); // ~50%
  const snapMid = tracker.updatePosition([-2.71, 47.50]); // ~90%
  assert.equal(snapMid.isCompleted, false);

  // Utilisateur arrive à moins de 25m de la fin (le dernier point est à -2.70, 47.50)
  // 0.0001° de longitude à 47.5°N équivaut à ~7.5m (< 25m)
  const snapEnd = tracker.updatePosition([-2.7001, 47.50]);
  assert.ok(snapEnd.progressRatio > 0.85);
  assert.ok(snapEnd.remainingDistanceKm < 0.025);
  assert.equal(snapEnd.isCompleted, true);
});

test('TrackProgressTracker falls back to global Tier 2 search when jump exceeds sliding window', () => {
  // Tracé long avec 20 segments
  const coords: [number, number][] = [];
  for (let i = 0; i <= 20; i++) {
    coords.push([-2.80 + i * 0.01, 47.50]);
  }

  const tracker = new TrackProgressTracker(coords);

  // Positionné au segment 0
  const snapStart = tracker.updatePosition([-2.80, 47.50]);
  assert.equal(snapStart.currentSegmentIndex, 0);

  // Saut brusque vers segment 16 (hors de la fenêtre [0, 10], à plus de 10km)
  const snapJump = tracker.updatePosition([-2.635, 47.50]);
  assert.equal(snapJump.currentSegmentIndex, 16);
  assert.ok(snapJump.crossTrackDistanceMeters < 10);
});
