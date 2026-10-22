// tests/territories-schema.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { territories, territoryClusters, itineraries, places } from '../src/db/schema';
import {
  seedMorbihanTerritory,
  seedTerritories,
  HISTORICAL_SECTOR_CLUSTER_MAP,
  MORBIHAN_TERRITORY,
} from '../src/db/seed-territories';

test('Schema defines territories, territory_clusters, and itineraries tables with expected columns', () => {
  assert.ok(territories, 'territories table must be exported');
  assert.ok(territoryClusters, 'territoryClusters table must be exported');
  assert.ok(itineraries, 'itineraries table must be exported');

  // Verify columns exist on territories
  assert.ok(territories.slug, 'territories.slug must exist');
  assert.ok(territories.hasTides, 'territories.hasTides must exist');
  assert.ok(territories.centerLatitude, 'territories.centerLatitude must exist');
  assert.ok(territories.centerLongitude, 'territories.centerLongitude must exist');
  assert.ok(territories.defaultZoom, 'territories.defaultZoom must exist');

  // Verify columns exist on territoryClusters
  assert.ok(territoryClusters.territoryId, 'territoryClusters.territoryId must exist');
  assert.ok(territoryClusters.barrierGroupId, 'territoryClusters.barrierGroupId must exist');
  assert.ok(territoryClusters.weatherSectorSlug, 'territoryClusters.weatherSectorSlug must exist');

  // Verify columns exist on itineraries
  assert.ok(itineraries.slug, 'itineraries.slug must exist');
  assert.ok(itineraries.territoryId, 'itineraries.territoryId must exist');
  assert.ok(itineraries.title, 'itineraries.title must exist');
  assert.ok(itineraries.durationDays, 'itineraries.durationDays must exist');
  assert.ok(itineraries.itineraryData, 'itineraries.itineraryData must exist');

  // Verify places has optional foreign keys
  assert.ok('territoryId' in places, 'places.territoryId must exist');
  assert.ok('clusterId' in places, 'places.clusterId must exist');
  assert.ok('sector' in places, 'places.sector must be preserved for backward compatibility');
});

test('HISTORICAL_SECTOR_CLUSTER_MAP maps all 4 historical sectors to barrier groups 1 through 4', () => {
  assert.equal(MORBIHAN_TERRITORY.slug, 'morbihan-sud');
  assert.equal(MORBIHAN_TERRITORY.hasTides, true);

  const sectors = Object.keys(HISTORICAL_SECTOR_CLUSTER_MAP);
  assert.equal(sectors.length, 4);

  assert.equal(HISTORICAL_SECTOR_CLUSTER_MAP['Golfe'].barrierGroupId, 1);
  assert.equal(HISTORICAL_SECTOR_CLUSTER_MAP['Golfe'].slug, 'golfe');
  assert.equal(HISTORICAL_SECTOR_CLUSTER_MAP['Golfe'].weatherSectorSlug, 'VANNES');

  assert.equal(HISTORICAL_SECTOR_CLUSTER_MAP['Presqu-ile de Rhuys'].barrierGroupId, 2);
  assert.equal(HISTORICAL_SECTOR_CLUSTER_MAP['Presqu-ile de Rhuys'].slug, 'rhuys');
  assert.equal(HISTORICAL_SECTOR_CLUSTER_MAP['Presqu-ile de Rhuys'].weatherSectorSlug, 'SARZEAU');

  assert.equal(HISTORICAL_SECTOR_CLUSTER_MAP['Presqu-ile de Quiberon'].barrierGroupId, 3);
  assert.equal(HISTORICAL_SECTOR_CLUSTER_MAP['Presqu-ile de Quiberon'].slug, 'quiberon');
  assert.equal(HISTORICAL_SECTOR_CLUSTER_MAP['Presqu-ile de Quiberon'].weatherSectorSlug, 'QUIBERON');

  assert.equal(HISTORICAL_SECTOR_CLUSTER_MAP['Ria d-Etel'].barrierGroupId, 4);
  assert.equal(HISTORICAL_SECTOR_CLUSTER_MAP['Ria d-Etel'].slug, 'ria-etel');
  assert.equal(HISTORICAL_SECTOR_CLUSTER_MAP['Ria d-Etel'].weatherSectorSlug, 'ETEL');
});

test('seedMorbihanTerritory performs upsert and links historical places via mock db', async () => {
  const updates: Array<{ table: any; values: any; where: any }> = [];

  const mockDb = {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve([]),
      }),
    }),
    insert: (table: any) => ({
      values: (values: any) => ({
        returning: () => Promise.resolve([{ id: `mock-${values.slug || 'id'}`, ...values }]),
      }),
    }),
    update: (table: any) => ({
      set: (values: any) => ({
        where: (whereClause: any) => {
          updates.push({ table, values, where: whereClause });
          return Promise.resolve();
        },
      }),
    }),
  };

  const result = await seedMorbihanTerritory(mockDb);

  assert.equal(result.territory.slug, 'morbihan-sud');
  assert.equal(Object.keys(result.clusters).length, 4);
  // Updates for places table: 4 historical sectors
  assert.equal(updates.length, 4);
  for (const update of updates) {
    assert.ok(update.values.territoryId, 'update must set territoryId');
    assert.ok(update.values.clusterId, 'update must set clusterId');
  }

  // Verify seedTerritories alias is identical
  assert.strictEqual(seedTerritories, seedMorbihanTerritory);
});
