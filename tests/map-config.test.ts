import test from 'node:test';
import assert from 'node:assert/strict';
import { GOLFE_MAP_CONFIG, STATUS_STYLE_CONFIG } from '../src/lib/map-config';
import type { PlaceMarkerData, MapViewportBounds, ElevationPoint } from '../src/lib/types/map';

test('GOLFE_MAP_CONFIG defines appropriate bounds and center for Golfe du Morbihan', () => {
  assert.equal(typeof GOLFE_MAP_CONFIG.defaultCenter[0], 'number');
  assert.equal(typeof GOLFE_MAP_CONFIG.defaultCenter[1], 'number');
  // Longitude West in Morbihan is negative
  assert.ok(GOLFE_MAP_CONFIG.defaultCenter[0] < -2.5 && GOLFE_MAP_CONFIG.defaultCenter[0] > -3.0);
  assert.ok(GOLFE_MAP_CONFIG.defaultCenter[1] > 47.4 && GOLFE_MAP_CONFIG.defaultCenter[1] < 47.7);

  // Bounds contain the center
  const [sw, ne] = GOLFE_MAP_CONFIG.maxBounds;
  assert.ok(sw[0] < GOLFE_MAP_CONFIG.defaultCenter[0]);
  assert.ok(ne[0] > GOLFE_MAP_CONFIG.defaultCenter[0]);
  assert.ok(sw[1] < GOLFE_MAP_CONFIG.defaultCenter[1]);
  assert.ok(ne[1] > GOLFE_MAP_CONFIG.defaultCenter[1]);

  // OpenFreeMap style URL
  assert.ok(GOLFE_MAP_CONFIG.styles.liberty.includes('openfreemap.org'));
});

test('STATUS_STYLE_CONFIG contains Tailwind classes for all context statuses', () => {
  const statuses = ['IDEAL', 'WARNING', 'DISCOURAGED', 'SPONSORED'];
  for (const status of statuses) {
    const config = STATUS_STYLE_CONFIG[status];
    assert.ok(config, `Missing status style for ${status}`);
    assert.ok(typeof config.badgeClass === 'string');
    assert.ok(typeof config.ringClass === 'string');
  }

  assert.ok(STATUS_STYLE_CONFIG.IDEAL.badgeClass.includes('emerald'));
  assert.ok(STATUS_STYLE_CONFIG.WARNING.badgeClass.includes('amber'));
  assert.ok(STATUS_STYLE_CONFIG.DISCOURAGED.badgeClass.includes('slate'));
  assert.ok(STATUS_STYLE_CONFIG.SPONSORED.badgeClass.includes('yellow') || STATUS_STYLE_CONFIG.SPONSORED.badgeClass.includes('amber'));
});

test('Map Types can be instantiated and typed strictly', () => {
  const marker: PlaceMarkerData = {
    id: 'place-1',
    slug: 'port-navalo',
    name: 'Port-Navalo',
    latitude: 47.545,
    longitude: -2.892,
    category: 'BEACH',
    status: 'IDEAL',
    isSponsored: false,
    score: 85,
  };
  assert.equal(marker.slug, 'port-navalo');

  const bounds: MapViewportBounds = {
    north: 47.6,
    south: 47.5,
    east: -2.7,
    west: -2.9,
  };
  assert.ok(bounds.north > bounds.south);

  const elevation: ElevationPoint = {
    distanceKm: 2.5,
    elevationM: 15,
    lat: 47.55,
    lon: -2.88,
  };
  assert.equal(elevation.elevationM, 15);
});
