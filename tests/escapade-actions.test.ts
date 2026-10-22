// tests/escapade-actions.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toggleDayRainMode, swapMomentPlace } from '../src/lib/escapade/actions';
import type { EscapadePlan, EscapadePlace } from '../src/lib/escapade/types';

test('toggleDayRainMode replaces outdoor spots with rainFriendly spots in same sector', () => {
  const plan: EscapadePlan = {
    profile: { baseSector: 'Presqu-ile de Rhuys', durationDays: 1, profileType: 'FAMILY' },
    days: [
      {
        dayIndex: 1,
        date: '2026-07-15',
        sector: 'Presqu-ile de Rhuys',
        isRainMode: false,
        moments: [
          {
            momentType: 'APRES_MIDI',
            title: 'Après-midi marée',
            place: { id: 'p2', name: 'Plage', contextualRules: { rainFriendly: false } } as any,
            alternatives: [{ id: 'p1', name: 'Château Suscinio', contextualRules: { rainFriendly: true } }] as any,
          },
        ],
      },
    ],
  };

  const rainyPlan = toggleDayRainMode(plan, 1);
  assert.strictEqual(rainyPlan.days[0].isRainMode, true);
  assert.strictEqual(rainyPlan.days[0].moments[0].place.contextualRules?.rainFriendly, true);
  // Verify former place was preserved in alternatives
  assert.strictEqual(rainyPlan.days[0].moments[0].alternatives[0].id, 'p2');
});

test('toggleDayRainMode toggling off restores outdoor spots', () => {
  const plan: EscapadePlan = {
    profile: { baseSector: 'Presqu-ile de Rhuys', durationDays: 1, profileType: 'FAMILY' },
    days: [
      {
        dayIndex: 1,
        date: '2026-07-15',
        sector: 'Presqu-ile de Rhuys',
        isRainMode: false,
        moments: [
          {
            momentType: 'APRES_MIDI',
            title: 'Après-midi marée',
            place: { id: 'p2', name: 'Plage', contextualRules: { rainFriendly: false } } as any,
            alternatives: [{ id: 'p1', name: 'Château Suscinio', contextualRules: { rainFriendly: true } }] as any,
          },
        ],
      },
    ],
  };

  const rainyPlan = toggleDayRainMode(plan, 1);
  assert.strictEqual(rainyPlan.days[0].isRainMode, true);
  assert.strictEqual(rainyPlan.days[0].moments[0].place.id, 'p1');

  const dryPlan = toggleDayRainMode(rainyPlan, 1);
  assert.strictEqual(dryPlan.days[0].isRainMode, false);
  assert.strictEqual(dryPlan.days[0].moments[0].place.id, 'p2');
  assert.strictEqual(dryPlan.days[0].moments[0].place.contextualRules?.rainFriendly, false);
});

test('toggleDayRainMode uses placesPool when alternatives lack rain-friendly spot in sector', () => {
  const plan: EscapadePlan = {
    profile: { baseSector: 'Presqu-ile de Rhuys', durationDays: 1, profileType: 'FAMILY' },
    days: [
      {
        dayIndex: 1,
        date: '2026-07-15',
        sector: 'Presqu-ile de Rhuys',
        isRainMode: false,
        moments: [
          {
            momentType: 'APRES_MIDI',
            title: 'Après-midi marée',
            place: { id: 'p2', name: 'Plage', sector: 'Presqu-ile de Rhuys', contextualRules: { rainFriendly: false } } as any,
            alternatives: [{ id: 'p3', name: 'Sentier côtier', sector: 'Presqu-ile de Rhuys', contextualRules: { rainFriendly: false } }] as any,
          },
        ],
      },
    ],
  };

  const pool: EscapadePlace[] = [
    { id: 'p10', name: 'Maison du Golfe', sector: 'Presqu-ile de Rhuys', contextualRules: { rainFriendly: true } },
    { id: 'p11', name: 'Aquarium Vannes', sector: 'Golfe', contextualRules: { rainFriendly: true } },
  ];

  const rainyPlan = toggleDayRainMode(plan, 1, pool);
  assert.strictEqual(rainyPlan.days[0].isRainMode, true);
  assert.strictEqual(rainyPlan.days[0].moments[0].place.id, 'p10');
  assert.strictEqual(rainyPlan.days[0].moments[0].place.sector, 'Presqu-ile de Rhuys');
});

test('toggleDayRainMode only updates target day in multi-day plan', () => {
  const plan: EscapadePlan = {
    profile: { baseSector: 'Presqu-ile de Rhuys', durationDays: 2, profileType: 'NATURE' },
    days: [
      {
        dayIndex: 1,
        date: '2026-07-15',
        sector: 'Presqu-ile de Rhuys',
        isRainMode: false,
        moments: [
          {
            momentType: 'APRES_MIDI',
            title: 'Après-midi',
            place: { id: 'p1', name: 'Spot Outdoor 1', contextualRules: { rainFriendly: false } } as any,
            alternatives: [{ id: 'p2', name: 'Spot Indoor 1', contextualRules: { rainFriendly: true } }] as any,
          },
        ],
      },
      {
        dayIndex: 2,
        date: '2026-07-16',
        sector: 'Golfe',
        isRainMode: false,
        moments: [
          {
            momentType: 'APRES_MIDI',
            title: 'Après-midi',
            place: { id: 'p3', name: 'Spot Outdoor 2', contextualRules: { rainFriendly: false } } as any,
            alternatives: [{ id: 'p4', name: 'Spot Indoor 2', contextualRules: { rainFriendly: true } }] as any,
          },
        ],
      },
    ],
  };

  const updated = toggleDayRainMode(plan, 1);
  assert.strictEqual(updated.days[0].isRainMode, true);
  assert.strictEqual(updated.days[0].moments[0].place.id, 'p2');

  // Day 2 must remain untouched
  assert.strictEqual(updated.days[1].isRainMode, false);
  assert.strictEqual(updated.days[1].moments[0].place.id, 'p3');
});

test('swapMomentPlace updates specific moment without altering other moments', () => {
  const plan: any = {
    days: [
      {
        dayIndex: 1,
        moments: [
          { momentType: 'MATIN', place: { id: 'p1', name: 'Spot 1' }, alternatives: [{ id: 'p2', name: 'Spot 2' }] },
          { momentType: 'DEJEUNER', place: { id: 'd1', name: 'Lunch 1' }, alternatives: [{ id: 'd2', name: 'Lunch 2' }] },
        ],
      },
    ],
  };

  const updated = swapMomentPlace(plan, 1, 'MATIN', 'p2');
  assert.strictEqual(updated.days[0].moments[0].place.id, 'p2');
  assert.strictEqual(updated.days[0].moments[0].alternatives[0].id, 'p1', 'Former place moved to alternatives');

  // Lunch moment remains untouched
  assert.strictEqual(updated.days[0].moments[1].place.id, 'd1');
  assert.strictEqual(updated.days[0].moments[1].alternatives[0].id, 'd2');
});

test('swapMomentPlace supports lookup by slug or id and preserves pool alternatives', () => {
  const plan: any = {
    days: [
      {
        dayIndex: 1,
        moments: [
          {
            momentType: 'APRES_MIDI',
            place: { slug: 'suscinio', name: 'Suscinio' },
            alternatives: [
              { slug: 'plage-landrezac', name: 'Landrezac' },
              { slug: 'arzon-port', name: 'Port du Crouesty' },
            ],
          },
        ],
      },
    ],
  };

  const updated = swapMomentPlace(plan, 1, 'APRES_MIDI', 'plage-landrezac');
  assert.strictEqual(updated.days[0].moments[0].place.slug, 'plage-landrezac');
  assert.strictEqual(updated.days[0].moments[0].alternatives[0].slug, 'suscinio');
  assert.strictEqual(updated.days[0].moments[0].alternatives[1].slug, 'arzon-port');
});

test('swapMomentPlace looks up from placesPool if not in alternatives', () => {
  const plan: any = {
    days: [
      {
        dayIndex: 1,
        moments: [
          {
            momentType: 'MATIN',
            place: { id: 'p1', name: 'Spot 1' },
            alternatives: [{ id: 'p2', name: 'Spot 2' }],
          },
        ],
      },
    ],
  };

  const pool: EscapadePlace[] = [
    { id: 'p99', name: 'Extra Spot 99', sector: 'Presqu-ile de Rhuys' },
  ];

  const updated = swapMomentPlace(plan, 1, 'MATIN', 'p99', pool);
  assert.strictEqual(updated.days[0].moments[0].place.id, 'p99');
  assert.strictEqual(updated.days[0].moments[0].alternatives[0].id, 'p1');
});

test('immutability: toggleDayRainMode and swapMomentPlace do not mutate input plan', () => {
  const originalPlan: EscapadePlan = {
    profile: { baseSector: 'Presqu-ile de Rhuys', durationDays: 1, profileType: 'FAMILY' },
    days: [
      {
        dayIndex: 1,
        date: '2026-07-15',
        sector: 'Presqu-ile de Rhuys',
        isRainMode: false,
        moments: [
          {
            momentType: 'MATIN',
            title: 'Matinée',
            place: { id: 'p1', name: 'Spot 1', contextualRules: { rainFriendly: false } } as any,
            alternatives: [{ id: 'p2', name: 'Spot 2', contextualRules: { rainFriendly: true } }] as any,
          },
        ],
      },
    ],
  };

  const deepClone = JSON.parse(JSON.stringify(originalPlan));
  const swapped = swapMomentPlace(originalPlan, 1, 'MATIN', 'p2');
  assert.deepStrictEqual(originalPlan, deepClone, 'swapMomentPlace must not mutate originalPlan');
  assert.notStrictEqual(swapped, originalPlan);

  const rainToggled = toggleDayRainMode(originalPlan, 1);
  assert.deepStrictEqual(originalPlan, deepClone, 'toggleDayRainMode must not mutate originalPlan');
  assert.notStrictEqual(rainToggled, originalPlan);
});

test('swapMomentPlace returns original plan when target place is unknown or same', () => {
  const plan: any = {
    days: [
      {
        dayIndex: 1,
        moments: [
          { momentType: 'MATIN', place: { id: 'p1', name: 'Spot 1' }, alternatives: [{ id: 'p2', name: 'Spot 2' }] },
        ],
      },
    ],
  };

  const same = swapMomentPlace(plan, 1, 'MATIN', 'p1');
  assert.strictEqual(same, plan);

  const unknown = swapMomentPlace(plan, 1, 'MATIN', 'unknown-place-999');
  assert.strictEqual(unknown, plan);
});

test('performance: 1000 spot swaps and rain toggles complete in under 20ms (< 0.02ms each)', () => {
  let plan: EscapadePlan = {
    profile: { baseSector: 'Presqu-ile de Rhuys', durationDays: 1, profileType: 'FAMILY' },
    days: [
      {
        dayIndex: 1,
        date: '2026-07-15',
        sector: 'Presqu-ile de Rhuys',
        isRainMode: false,
        moments: [
          {
            momentType: 'MATIN',
            title: 'Matinée',
            place: { id: 'p1', name: 'Spot 1', contextualRules: { rainFriendly: false } } as any,
            alternatives: [{ id: 'p2', name: 'Spot 2', contextualRules: { rainFriendly: true } }] as any,
          },
        ],
      },
    ],
  };

  const start = performance.now();
  for (let i = 0; i < 500; i++) {
    plan = swapMomentPlace(plan, 1, 'MATIN', i % 2 === 0 ? 'p2' : 'p1');
    plan = toggleDayRainMode(plan, 1);
  }
  const elapsed = performance.now() - start;
  assert.ok(elapsed < 20, `1000 operations took ${elapsed.toFixed(2)}ms, expected < 20ms`);
});
