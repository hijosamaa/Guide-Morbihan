import test from 'node:test';
import assert from 'node:assert/strict';
import { places, tideEvents, weatherSnapshots, categoryEnum, tideConstraintEnum } from '../src/db/schema';

test('Schema defines all expected tables and enums', () => {
  assert.ok(places, 'places table must be defined');
  assert.ok(tideEvents, 'tideEvents table must be defined');
  assert.ok(weatherSnapshots, 'weatherSnapshots table must be defined');

  assert.equal(categoryEnum.enumValues.length, 7);
  assert.equal(tideConstraintEnum.enumValues.length, 4);

  assert.ok(places.slug);
  assert.ok(places.latitude);
  assert.ok(places.longitude);
  assert.ok(places.contextualRules);
});
