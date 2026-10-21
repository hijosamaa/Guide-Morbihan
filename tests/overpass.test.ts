import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOverpassQuery,
  routeOsmElements,
  fetchOverpassElements,
  syncOsmData,
  MORBIHAN_BBOX,
} from '../src/lib/overpass.js';
import type { OverpassElement } from '../src/lib/types/osm.js';

test('buildOverpassQuery includes correct bounding box and amenity tags', () => {
  const query = buildOverpassQuery();
  assert.ok(query.includes('leisure"="slipway"'));
  assert.ok(query.includes('amenity"="drinking_water"'));
  assert.ok(query.includes('amenity"="toilets"'));
  assert.ok(query.includes('leisure"="picnic_table"'));
  assert.ok(query.includes('amenity"="bicycle_parking"'));
  assert.ok(query.includes(MORBIHAN_BBOX));
  assert.ok(query.includes('47.45,-3.25,47.75,-2.60'));
});

test('routeOsmElements partitions slipways into places and amenities into amenities table', () => {
  const mockElements: OverpassElement[] = [
    // 1. Cale de mise à l'eau (node)
    {
      type: 'node',
      id: 1001,
      lat: 47.6001,
      lon: -2.8501,
      tags: { leisure: 'slipway', name: 'Cale de Toulindac', tidal: 'yes' },
    },
    // 2. Fontaine d'eau potable
    {
      type: 'node',
      id: 2001,
      lat: 47.6010,
      lon: -2.8510,
      tags: { amenity: 'drinking_water', name: 'Fontaine du Port' },
    },
    // 3. Toilettes publiques (way avec centre)
    {
      type: 'way',
      id: 3001,
      center: { lat: 47.6020, lon: -2.8520 },
      tags: { amenity: 'toilets', wheelchair: 'yes', fee: 'no' },
    },
    // 4. Table de pique-nique
    {
      type: 'node',
      id: 4001,
      lat: 47.6030,
      lon: -2.8530,
      tags: { leisure: 'picnic_table' },
    },
  ];

  const routed = routeOsmElements(mockElements);

  assert.equal(routed.slipways.length, 1);
  assert.equal(routed.slipways[0].externalId, 'osm:node:1001');
  assert.equal(routed.slipways[0].category, 'NAUTICAL');
  assert.equal(routed.slipways[0].contextualRules.tideConstraint, 'HIGH_TIDE_ONLY');

  assert.equal(routed.amenities.length, 3);
  assert.equal(routed.amenities[0].type, 'DRINKING_WATER');
  assert.equal(routed.amenities[1].type, 'TOILETS');
  assert.equal(routed.amenities[1].osmId, 'way:3001');
  assert.equal(routed.amenities[2].type, 'PICNIC_TABLE');
});

test('routeOsmElements maps various amenity types and ignores elements without coordinates', () => {
  const mockElements: OverpassElement[] = [
    {
      type: 'node',
      id: 5001,
      lat: 47.6040,
      lon: -2.8540,
      tags: { amenity: 'bicycle_parking' },
    },
    {
      type: 'node',
      id: 5002,
      lat: 47.6050,
      lon: -2.8550,
      tags: { amenity: 'shower' },
    },
    {
      type: 'node',
      id: 5003,
      lat: 47.6060,
      lon: -2.8560,
      tags: { emergency: 'defibrillator' },
    },
    {
      type: 'node',
      id: 5004,
      lat: 47.6070,
      lon: -2.8570,
      tags: { shop: 'bakery', name: 'Boulangerie du Port' },
    },
    {
      type: 'node',
      id: 5005,
      lat: 47.6080,
      lon: -2.8580,
      tags: { something: 'unknown' },
    },
    {
      type: 'node',
      id: 5006,
      // no lat / lon
      tags: { amenity: 'toilets' },
    },
    {
      type: 'node',
      id: 5007,
      lat: 47.6090,
      lon: -2.8590,
      tags: { leisure: 'slipway', tide: 'high' },
    },
    {
      type: 'node',
      id: 5008,
      lat: 47.6100,
      lon: -2.8600,
      tags: { leisure: 'slipway' }, // not high tide
    },
  ];

  const routed = routeOsmElements(mockElements);

  assert.equal(routed.slipways.length, 2);
  assert.equal(routed.slipways[0].contextualRules.tideConstraint, 'HIGH_TIDE_ONLY');
  assert.equal(routed.slipways[1].contextualRules.tideConstraint, 'ALL_TIDES');

  assert.equal(routed.amenities.length, 5); // 5006 skipped because no coordinates
  assert.equal(routed.amenities[0].type, 'BICYCLE_PARKING');
  assert.equal(routed.amenities[1].type, 'BEACH_SHOWER');
  assert.equal(routed.amenities[2].type, 'DEFIBRILLATOR');
  assert.equal(routed.amenities[3].type, 'BAKERY');
  assert.equal(routed.amenities[3].name, 'Boulangerie du Port');
  assert.equal(routed.amenities[4].type, 'OTHER');
});

test('fetchOverpassElements falls back to second mirror when first fails', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = (async (url: string | URL | Request) => {
    calls++;
    if (calls === 1) {
      throw new Error('Connection timed out on primary mirror');
    }
    return new Response(
      JSON.stringify({
        version: 0.6,
        generator: 'Overpass API',
        elements: [
          { type: 'node', id: 999, lat: 47.5, lon: -2.8, tags: { leisure: 'slipway' } },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof fetch;

  try {
    const elements = await fetchOverpassElements();
    assert.equal(calls, 2);
    assert.equal(elements.length, 1);
    assert.equal(elements[0].id, 999);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('syncOsmData handles success and db error resilience gracefully', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    return new Response(
      JSON.stringify({
        version: 0.6,
        generator: 'Overpass API',
        elements: [
          { type: 'node', id: 101, lat: 47.5, lon: -2.8, tags: { leisure: 'slipway' } },
          { type: 'node', id: 102, lat: 47.6, lon: -2.9, tags: { leisure: 'slipway' } },
          { type: 'node', id: 201, lat: 47.5, lon: -2.8, tags: { amenity: 'toilets' } },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof fetch;

  const insertedTables: string[] = [];
  const mockDb = {
    insert: (table: any) => ({
      values: (val: any) => ({
        onConflictDoUpdate: async () => {
          if (val.externalId === 'osm:node:102') {
            throw new Error('DB constraint error simulation');
          }
          insertedTables.push(table === undefined ? 'unknown' : 'table');
          return Promise.resolve();
        },
      }),
    }),
  };

  try {
    const report = await syncOsmData(mockDb);
    assert.equal(report.success, true);
    assert.equal(report.totalParsed, 3);
    assert.equal(report.slipwaysUpserted, 1);
    assert.equal(report.amenitiesUpserted, 1);
    assert.equal(report.errors.length, 1);
    assert.ok(report.errors[0].includes('osm:node:102'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
