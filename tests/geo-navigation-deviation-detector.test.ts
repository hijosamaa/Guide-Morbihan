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

test('DeviationDetector handles dynamic threshold based on accuracy (max(35, 1.5 * accuracy))', () => {
  const detector = new DeviationDetector();

  // With accuracy = 10m: threshold is max(35, 15) = 35m.
  let res = detector.evaluate(30, 10, 1000);
  assert.equal(res.currentThresholdMeters, 35);
  assert.equal(res.isOffTrack, false);

  // With accuracy = 30m: threshold is max(35, 45) = 45m.
  // A crossTrack of 40m is within tolerance since threshold is 45m.
  res = detector.evaluate(40, 30, 2000);
  assert.equal(res.currentThresholdMeters, 45);
  assert.equal(res.isOffTrack, false);
  assert.equal(res.isDegradedGps, false);

  // Accuracy exactly 40m: threshold is max(35, 60) = 60m. Not degraded yet.
  res = detector.evaluate(50, 40, 3000);
  assert.equal(res.currentThresholdMeters, 60);
  assert.equal(res.isDegradedGps, false);
  assert.equal(res.isOffTrack, false);
});

test('DeviationDetector resets deviation timer if user returns within threshold before 10s', () => {
  const detector = new DeviationDetector();
  let time = 1000;

  // Deviation starts
  detector.evaluate(40, 10, time);
  // 6s in deviation
  time += 6000;
  let res = detector.evaluate(40, 10, time);
  assert.equal(res.isOffTrack, false);

  // Return below threshold for 1 sample
  time += 1000;
  res = detector.evaluate(25, 10, time);
  assert.equal(res.isOffTrack, false);

  // Deviate again: timer should restart from 0, not continue previous 6s
  time += 1000;
  detector.evaluate(40, 10, time);
  time += 6000; // 6s after restart
  res = detector.evaluate(40, 10, time);
  assert.equal(res.isOffTrack, false, 'Should not trigger because timer was reset');

  time += 4000; // 10s reached
  res = detector.evaluate(40, 10, time);
  assert.equal(res.isOffTrack, true, 'Should trigger once 10s continuous deviation is reached');
});

test('DeviationDetector reset clears off-track state immediately', () => {
  const detector = new DeviationDetector();
  detector.evaluate(50, 10, 1000);
  let res = detector.evaluate(50, 10, 12000);
  assert.equal(res.isOffTrack, true);

  detector.reset();
  res = detector.evaluate(10, 10, 13000);
  assert.equal(res.isOffTrack, false);
});

