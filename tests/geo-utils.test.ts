import test from 'node:test';
import assert from 'node:assert/strict';
import {
  haversineDistanceKm,
  degreesToCardinal,
  calculateElevationGainWithHysteresis,
  estimateTrailDurationMinutes,
} from '../src/lib/utils/geo.js';

test('haversineDistanceKm calculates accurate distance between known points', () => {
  // Distance entre Vannes (Port) et Port-Navalo : ~15.2 km à vol d'oiseau
  const dist = haversineDistanceKm(47.6433, -2.7667, 47.5486, -2.9142);
  assert.ok(dist > 14.5 && dist < 16.0, `Expected ~15.2km, got ${dist}`);
  
  // Distance nulle pour un point identique
  assert.equal(haversineDistanceKm(47.5, -2.8, 47.5, -2.8), 0);
});

test('degreesToCardinal converts angles correctly into 8 cardinal directions', () => {
  assert.equal(degreesToCardinal(0), 'N');
  assert.equal(degreesToCardinal(15), 'N');
  assert.equal(degreesToCardinal(350), 'N');
  assert.equal(degreesToCardinal(45), 'NE');
  assert.equal(degreesToCardinal(90), 'E');
  assert.equal(degreesToCardinal(135), 'SE');
  assert.equal(degreesToCardinal(180), 'S');
  assert.equal(degreesToCardinal(225), 'SW');
  assert.equal(degreesToCardinal(270), 'W');
  assert.equal(degreesToCardinal(315), 'NW');
});

test('calculateElevationGainWithHysteresis filters out small GPS noise', () => {
  // Parcours littoral avec micro-bruit altimétrique GPS (+/- 1.5m)
  const noisyElevations = [5, 6.2, 4.8, 5.5, 6.1, 5.2, 5.0];
  const result = calculateElevationGainWithHysteresis(noisyElevations, 3.0);
  assert.equal(result.gainM, 0, 'Small vertical GPS noise must yield 0m D+');
  assert.equal(result.lossM, 0, 'Small vertical GPS noise must yield 0m D-');
  assert.equal(result.minM, 4.8);
  assert.equal(result.maxM, 6.2);

  // Vraie colline : départ 5m -> montée à 25m -> descente à 10m
  const realHills = [5, 10, 18, 25, 20, 14, 10];
  const hillResult = calculateElevationGainWithHysteresis(realHills, 3.0);
  assert.equal(hillResult.gainM, 20, 'Expected 20m D+');
  assert.equal(hillResult.lossM, 15, 'Expected 15m D-');
});

test('calculateElevationGainWithHysteresis handles empty or 2D tracks', () => {
  const result = calculateElevationGainWithHysteresis([], 3.0);
  assert.equal(result.gainM, 0);
  assert.equal(result.lossM, 0);
});

test('estimateTrailDurationMinutes follows standard hiking calculation', () => {
  // 10 km à plat (4 km/h) = 150 minutes
  assert.equal(estimateTrailDurationMinutes(10, 0), 150);
  // 10 km avec 300m D+ = 150 min + 60 min = 210 minutes
  assert.equal(estimateTrailDurationMinutes(10, 300), 210);
});
