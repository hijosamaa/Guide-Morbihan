import test from 'node:test';
import assert from 'node:assert/strict';
import { filterPlacesInMemory, type FilterCriteria } from '../src/lib/hooks/useFilteredPlaces';
import { filterParsers, searchParamsCache } from '../src/lib/search-params';
import type { PlaceMarkerData } from '../src/lib/types/map';

const mockPlaces: PlaceMarkerData[] = [
  {
    id: '1',
    slug: 'plage-fogeo',
    name: 'Plage du Fogeo',
    latitude: 47.53,
    longitude: -2.89,
    category: 'BEACH',
    status: 'IDEAL',
    score: 95,
  },
  {
    id: '2',
    slug: 'sentier-berder',
    name: 'Tour de Berder',
    latitude: 47.58,
    longitude: -2.88,
    category: 'TRAIL',
    status: 'WARNING',
    score: 60,
  },
  {
    id: '3',
    slug: 'chateau-suscinio',
    name: 'Château de Suscinio',
    latitude: 47.51,
    longitude: -2.73,
    category: 'HERITAGE',
    status: 'IDEAL',
    score: 85,
  },
];

test('filterPlacesInMemory filters by category', () => {
  const criteria: FilterCriteria = {
    category: 'BEACH',
    tideFilter: 'ALL',
    shelteredFromWind: false,
    strollerOnly: false,
    dogsOnly: false,
    rainOnly: false,
  };

  const results = filterPlacesInMemory(mockPlaces, criteria);
  assert.equal(results.length, 1);
  assert.equal(results[0].slug, 'plage-fogeo');
});

test('filterPlacesInMemory returns all places when category is ALL', () => {
  const criteria: FilterCriteria = {
    category: 'ALL',
    tideFilter: 'ALL',
    shelteredFromWind: false,
    strollerOnly: false,
    dogsOnly: false,
    rainOnly: false,
  };

  const results = filterPlacesInMemory(mockPlaces, criteria);
  assert.equal(results.length, 3);
});

test('filterPlacesInMemory filters ideal tide status', () => {
  const criteria: FilterCriteria = {
    category: 'ALL',
    tideFilter: 'IDEAL_NOW',
    shelteredFromWind: false,
    strollerOnly: false,
    dogsOnly: false,
    rainOnly: false,
  };

  const results = filterPlacesInMemory(mockPlaces, criteria);
  assert.equal(results.length, 2);
  assert.ok(results.every((p) => p.status === 'IDEAL'));
});

test('filterParsers defines default parameters correctly', () => {
  assert.ok(filterParsers.cat);
  assert.ok(filterParsers.maree);
  assert.ok(filterParsers.vent);
  assert.ok(filterParsers.pmr);
  assert.ok(filterParsers.chiens);
  assert.ok(filterParsers.pluie);
  assert.ok(filterParsers.spot);
  assert.ok(searchParamsCache);
});
