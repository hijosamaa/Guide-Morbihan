import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toLocalMetric,
  fromLocalMetric,
  projectPointOnSegment,
  pointToLineDistanceMeters,
} from '../src/lib/geo-navigation/projection.js';

test('toLocalMetric applies cosine correction for 47.5°N latitude', () => {
  const refLat = 47.5;
  // 1 degree longitude at 47.5N should be ~75.1 km, latitude should be ~111.2 km
  const p1 = toLocalMetric(-2.7, 47.5, refLat);
  const p2 = toLocalMetric(-1.7, 47.5, refLat);
  const dx = p2.x - p1.x;
  assert.ok(dx > 74000 && dx < 76000, `Expected ~75100m, got ${dx}`);

  const p3 = toLocalMetric(-2.7, 48.5, refLat);
  const dy = p3.y - p1.y;
  assert.ok(dy > 111000 && dy < 112000, `Expected ~111200m, got ${dy}`);

  // Vérification également pour 0.1° (~7.51 km)
  const p01 = toLocalMetric(-2.6, 47.5, refLat);
  const dx01 = p01.x - p1.x;
  assert.ok(dx01 > 7400 && dx01 < 7600, `Expected ~7510m, got ${dx01}`);
});

test('fromLocalMetric inverts toLocalMetric accurately', () => {
  const refLat = 47.5;
  const lon = -2.7543;
  const lat = 47.5891;
  const metric = toLocalMetric(lon, lat, refLat);
  const [invLon, invLat] = fromLocalMetric(metric.x, metric.y, refLat);
  assert.ok(Math.abs(invLon - lon) < 1e-9, `lon diff: ${Math.abs(invLon - lon)}`);
  assert.ok(Math.abs(invLat - lat) < 1e-9, `lat diff: ${Math.abs(invLat - lat)}`);
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

test('projectPointOnSegment handles zero-length segments safely', () => {
  const a: [number, number] = [-2.80, 47.50];
  const b: [number, number] = [-2.80, 47.50];
  const p: [number, number] = [-2.80, 47.501];

  const res = projectPointOnSegment(p, a, b);
  assert.equal(res.t, 0);
  assert.equal(res.projected[0], a[0]);
  assert.equal(res.projected[1], a[1]);
  assert.ok(res.crossTrackDistanceMeters > 100 && res.crossTrackDistanceMeters < 120);
});

test('pointToLineDistanceMeters returns crossTrackDistanceMeters', () => {
  const a: [number, number] = [-2.80, 47.50];
  const b: [number, number] = [-2.78, 47.50];
  const p: [number, number] = [-2.79, 47.5005];

  const dist = pointToLineDistanceMeters(p, a, b);
  const proj = projectPointOnSegment(p, a, b);
  assert.equal(dist, proj.crossTrackDistanceMeters);
});
