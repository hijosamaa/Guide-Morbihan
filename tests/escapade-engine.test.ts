// tests/escapade-engine.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateEscapade, SECTOR_ROTATION } from '../src/lib/escapade/engine';
import type { EscapadeProfile } from '../src/lib/escapade/types';
import { seedPlaces } from '../src/db/seed-data';

const mockPlaces = [
  {
    id: 'p1',
    slug: 'chateau-suscinio',
    name: 'Château de Suscinio',
    category: 'HERITAGE',
    sector: 'Presqu-ile de Rhuys',
    commune: 'Sarzeau',
    latitude: 47.53,
    longitude: -2.72,
    shortDescription: 'Forteresse ducale',
    contextualRules: { tideConstraint: 'ALL_TIDES', rainFriendly: true, strollerFriendly: true, dogsAllowedSummer: false },
  },
  {
    id: 'p2',
    slug: 'plage-landrezac',
    name: 'Plage de Landrezac',
    category: 'BEACH',
    sector: 'Presqu-ile de Rhuys',
    commune: 'Sarzeau',
    latitude: 47.51,
    longitude: -2.71,
    shortDescription: 'Grande plage familiale',
    contextualRules: { tideConstraint: 'HIGH_TIDE_ONLY', rainFriendly: false, strollerFriendly: true, dogsAllowedSummer: false },
  },
  {
    id: 'p3',
    slug: 'chantier-ostreicole-tour-du-parc',
    name: 'Chantier ostréicole du Tour-du-Parc',
    category: 'GASTRONOMY',
    sector: 'Presqu-ile de Rhuys',
    commune: 'Le Tour-du-Parc',
    latitude: 47.52,
    longitude: -2.65,
    shortDescription: 'Dégustation d’huîtres face au golfe',
    contextualRules: { tideConstraint: 'ALL_TIDES', rainFriendly: true, strollerFriendly: true, dogsAllowedSummer: true },
  },
  {
    id: 'p4',
    slug: 'pointe-bilgroix',
    name: 'Pointe de Bilgroix',
    category: 'VIEWPOINT',
    sector: 'Presqu-ile de Rhuys',
    commune: 'Arzon',
    latitude: 47.55,
    longitude: -2.89,
    shortDescription: 'Panorama coucher de soleil sur le goulet',
    contextualRules: { tideConstraint: 'ALL_TIDES', rainFriendly: false, strollerFriendly: true, dogsAllowedSummer: true },
  },
];

test('generateEscapade produces 1-day plan with 4 natural moments in same sector', () => {
  const profile: EscapadeProfile = {
    baseSector: 'Presqu-ile de Rhuys',
    durationDays: 1,
    profileType: 'FAMILY',
  };

  const plan = generateEscapade(profile, mockPlaces as any, new Date('2026-07-15T10:00:00Z'));

  assert.strictEqual(plan.days.length, 1, 'Must have 1 day');
  assert.strictEqual(plan.days[0].sector, 'Presqu-ile de Rhuys', 'Day sector must match baseSector');
  assert.strictEqual(plan.days[0].moments.length, 4, 'Must have 4 natural moments');
  
  const [matin, midi, aprem, soir] = plan.days[0].moments;
  assert.strictEqual(matin.momentType, 'MATIN');
  assert.strictEqual(midi.momentType, 'DEJEUNER');
  assert.strictEqual(aprem.momentType, 'APRES_MIDI');
  assert.strictEqual(soir.momentType, 'FIN_JOURNEE');
  
  assert.ok(matin.place, 'Morning moment must have a place');
  assert.ok(midi.place, 'Lunch moment must have a place');
  assert.strictEqual(matin.place.slug, 'chateau-suscinio');
  assert.strictEqual(midi.place.slug, 'chantier-ostreicole-tour-du-parc');
  assert.strictEqual(aprem.place.slug, 'plage-landrezac');
  assert.strictEqual(soir.place.slug, 'pointe-bilgroix');
});

test('generateEscapade anti-bouchons: 3-day plan has 1 sector per day rotating on adjacent zones', () => {
  const profile: EscapadeProfile = {
    baseSector: 'Presqu-ile de Rhuys',
    durationDays: 3,
    profileType: 'NATURE',
  };

  const plan = generateEscapade(profile, seedPlaces as any, new Date('2026-10-21T08:00:00Z'));

  assert.strictEqual(plan.days.length, 3, 'Must have 3 days');
  assert.strictEqual(plan.days[0].sector, 'Presqu-ile de Rhuys');
  assert.strictEqual(plan.days[1].sector, 'Golfe');
  assert.strictEqual(plan.days[2].sector, 'Ria d-Etel');

  // Verify all moments in day 1 belong to Day 1 sector
  for (const moment of plan.days[0].moments) {
    assert.strictEqual(moment.place.sector, 'Presqu-ile de Rhuys', 'Day 1 places must be in Rhuys');
    for (const alt of moment.alternatives) {
      assert.strictEqual(alt.sector, 'Presqu-ile de Rhuys', 'Day 1 alternatives must be in Rhuys');
    }
  }

  // Verify all moments in day 2 belong to Day 2 sector
  for (const moment of plan.days[1].moments) {
    assert.strictEqual(moment.place.sector, 'Golfe', 'Day 2 places must be in Golfe');
  }
});

test('generateEscapade alternatives: each moment includes up to 2 alternatives from same sector', () => {
  const profile: EscapadeProfile = {
    baseSector: 'Presqu-ile de Rhuys',
    durationDays: 1,
    profileType: 'FAMILY',
  };

  const plan = generateEscapade(profile, mockPlaces as any, new Date('2026-07-15T10:00:00Z'));
  const day = plan.days[0];

  for (const moment of day.moments) {
    assert.ok(moment.alternatives.length <= 2, 'Must have at most 2 alternatives');
    assert.ok(moment.alternatives.length > 0, 'Must have at least 1 alternative when available');
    for (const alt of moment.alternatives) {
      assert.notStrictEqual(alt.id, moment.place.id, 'Alternative cannot be the active place');
      assert.strictEqual(alt.sector, day.sector, 'Alternative must be in same sector');
    }
  }
});

test('generateEscapade tide anchoring: low tide afternoon promotes tidal passage in Golfe', () => {
  const profile: EscapadeProfile = {
    baseSector: 'Golfe',
    durationDays: 1,
    profileType: 'NATURE',
  };

  // On 2026-10-21, low tide at Vannes is at 13:20 (early afternoon)
  const plan = generateEscapade(profile, seedPlaces as any, new Date('2026-10-21T10:00:00Z'));
  const aprem = plan.days[0].moments.find((m) => m.momentType === 'APRES_MIDI');

  assert.ok(aprem, 'Must have afternoon moment');
  assert.strictEqual(aprem.place.slug, 'passage-ile-de-berder', 'Berder passage must be favored at low tide');
  assert.ok(aprem.tideNotice?.includes('Basse mer') || aprem.tideNotice?.includes('optimal'), 'Tide notice must mention low tide');
});

test('generateEscapade performance: generates 100 plans in under 50ms (< 0.5ms each)', () => {
  const profile: EscapadeProfile = {
    baseSector: 'Presqu-ile de Quiberon',
    durationDays: 3,
    profileType: 'HERITAGE_GOURMET',
  };

  const start = performance.now();
  for (let i = 0; i < 100; i++) {
    generateEscapade(profile, seedPlaces as any, new Date('2026-07-15T10:00:00Z'));
  }
  const duration = performance.now() - start;

  assert.ok(duration < 50, `100 runs took ${duration.toFixed(2)}ms, expected < 50ms`);
});
