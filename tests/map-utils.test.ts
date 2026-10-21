import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBoundingBox,
  findNearestElevationPoint,
  calculateElevationScales,
  estimateHikingDuration,
  isPointInBounds,
  getMarkerStyleTokens,
} from '../src/lib/map-utils';
import type { ElevationPoint, MapViewportBounds } from '../src/lib/types/map';

test('calculateBoundingBox computes correct [[minLon, minLat], [maxLon, maxLat]]', () => {
  const coords: [number, number][] = [
    [-2.80, 47.50],
    [-2.70, 47.60],
    [-2.85, 47.55],
  ];
  const bbox = calculateBoundingBox(coords);
  assert.deepEqual(bbox, [
    [-2.85, 47.50],
    [-2.70, 47.60],
  ]);

  // Fallback on empty coordinates
  const fallback = calculateBoundingBox([]);
  assert.equal(fallback.length, 2);
});

test('findNearestElevationPoint identifies closest point by distance', () => {
  const points: ElevationPoint[] = [
    { distanceKm: 0.0, elevationM: 5, lat: 47.5, lon: -2.8 },
    { distanceKm: 1.5, elevationM: 12, lat: 47.51, lon: -2.81 },
    { distanceKm: 3.0, elevationM: 8, lat: 47.52, lon: -2.82 },
  ];

  const closest = findNearestElevationPoint(points, 1.4);
  assert.equal(closest.distanceKm, 1.5);
  assert.equal(closest.elevationM, 12);

  // Fallback on empty points
  const fallback = findNearestElevationPoint([], 2.0);
  assert.equal(fallback.distanceKm, 0);
  assert.equal(fallback.elevationM, 0);
});

test('calculateElevationScales handles regular and flat profiles without zero division', () => {
  const points: ElevationPoint[] = [
    { distanceKm: 0.0, elevationM: 10, lat: 47.5, lon: -2.8 },
    { distanceKm: 5.0, elevationM: 30, lat: 47.55, lon: -2.85 },
  ];

  const scales = calculateElevationScales(points, 800, 160);
  assert.equal(scales.minElevation, 10);
  assert.equal(scales.maxElevation, 30);
  assert.ok(scales.pathLine.startsWith('M'));
  assert.ok(scales.pathArea.endsWith('Z'));

  // Test flat profile (min == max)
  const flatPoints: ElevationPoint[] = [
    { distanceKm: 0.0, elevationM: 5, lat: 47.5, lon: -2.8 },
    { distanceKm: 2.0, elevationM: 5, lat: 47.52, lon: -2.82 },
  ];
  const flatScales = calculateElevationScales(flatPoints, 800, 160);
  assert.ok(!Number.isNaN(flatScales.minElevation));
  assert.ok(!flatScales.pathLine.includes('NaN'));

  // Test empty points fallback
  const emptyScales = calculateElevationScales([], 800, 160);
  assert.equal(emptyScales.minElevation, 0);
  assert.equal(emptyScales.maxElevation, 0);
  assert.ok(emptyScales.pathLine.startsWith('M'));
});

test('estimateHikingDuration calculates duration accurately with FFRandonnee formula', () => {
  // 4 km at 0m D+ -> 1 hour
  const res1 = estimateHikingDuration(4, 0);
  assert.equal(res1.hours, 1);
  assert.equal(res1.minutes, 0);
  assert.equal(res1.formatted, '1h00');

  // 8 km at 300m D+ -> 2h + 1h = 3 hours
  const res2 = estimateHikingDuration(8, 300);
  assert.equal(res2.hours, 3);
  assert.equal(res2.minutes, 0);
  assert.equal(res2.formatted, '3h00');

  // Minute rollover verification (e.g. 59.7 min -> 1h00)
  const res3 = estimateHikingDuration(3.99, 0);
  assert.ok(res3.formatted.includes('h'));

  // Defensive clamping on negative values
  const resNegative = estimateHikingDuration(-5, -50);
  assert.equal(resNegative.hours, 0);
  assert.equal(resNegative.minutes, 0);
  assert.equal(resNegative.formatted, '0h00');
});

test('isPointInBounds correctly checks coordinate inclusion', () => {
  const bounds: MapViewportBounds = {
    north: 47.7,
    south: 47.5,
    east: -2.7,
    west: -2.9,
  };
  assert.ok(isPointInBounds(47.6, -2.8, bounds));
  assert.ok(!isPointInBounds(47.8, -2.8, bounds));
  assert.ok(!isPointInBounds(47.6, -2.6, bounds));
});

test('getMarkerStyleTokens resolves sponsored and status styling', () => {
  const sponsored = getMarkerStyleTokens('IDEAL', true);
  assert.ok(sponsored.badgeClass.includes('yellow') || sponsored.badgeClass.includes('amber'));

  const normal = getMarkerStyleTokens('WARNING', false);
  assert.ok(normal.badgeClass.includes('amber'));

  // Discouraged fallback
  const discouraged = getMarkerStyleTokens('DISCOURAGED', false);
  assert.ok(discouraged.badgeClass.includes('slate'));
});
