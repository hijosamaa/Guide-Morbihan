import test from 'node:test';
import assert from 'node:assert/strict';
import { seedPlaces, seedTides, seedWeather } from '../src/db/seed-data';

test('Seed places count and zone distribution', () => {
  assert.ok(seedPlaces.length >= 20, `Expected at least 20 places, got ${seedPlaces.length}`);

  const sectors = new Set(seedPlaces.map((p) => p.sector));
  assert.ok(sectors.has('Golfe'), 'Must contain Golfe places');
  assert.ok(sectors.has('Presqu-ile de Rhuys'), 'Must contain Rhuys places');
  assert.ok(sectors.has('Presqu-ile de Quiberon'), 'Must contain Quiberon places');
  assert.ok(sectors.has('Ria d-Etel'), 'Must contain Ria d-Etel places');

  // Coordonnées géographiques dans le Morbihan Sud (Lat: 47.45 à 47.75, Lng: -3.25 à -2.60)
  for (const place of seedPlaces) {
    assert.ok(place.latitude >= 47.45 && place.latitude <= 47.75, `Invalid lat for ${place.name}: ${place.latitude}`);
    assert.ok(place.longitude >= -3.25 && place.longitude <= -2.60, `Invalid lng for ${place.name}: ${place.longitude}`);
    assert.ok(place.slug.length > 0);
    assert.ok(place.contextualRules.tideConstraint);
  }
});

test('Seed tides include Port-Navalo and Vannes', () => {
  const harbors = new Set(seedTides.map((t) => t.harbor));
  assert.ok(harbors.has('PORT_NAVALO'));
  assert.ok(harbors.has('VANNES'));
  assert.ok(seedTides.length >= 8, 'Expected at least 8 tide events for 48h');
});

test('Seed weather covers 5 strategic zones', () => {
  assert.equal(seedWeather.length, 5);
});
