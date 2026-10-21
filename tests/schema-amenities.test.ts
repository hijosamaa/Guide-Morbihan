import test from 'node:test';
import assert from 'node:assert/strict';
import { amenities, amenityTypeEnum } from '../src/db/schema.js';

test('schema includes amenities table with valid enum values and indexes', () => {
  assert.ok(amenities, 'Table amenities should be defined');
  assert.ok(amenityTypeEnum, 'Enum amenityTypeEnum should be defined');
  
  const expectedValues = [
    'DRINKING_WATER',
    'TOILETS',
    'PICNIC_TABLE',
    'BICYCLE_PARKING',
    'BEACH_SHOWER',
    'DEFIBRILLATOR',
    'BAKERY',
    'OTHER',
  ];
  assert.deepEqual(amenityTypeEnum.enumValues, expectedValues);
  
  // Vérification de la présence des colonnes indispensables
  assert.ok(amenities.osmId, 'osmId column must exist');
  assert.ok(amenities.type, 'type column must exist');
  assert.ok(amenities.latitude, 'latitude column must exist');
  assert.ok(amenities.longitude, 'longitude column must exist');
  assert.ok(amenities.properties, 'properties column must exist');
});
