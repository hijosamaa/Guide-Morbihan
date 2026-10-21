import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePlaceContext, sortPlacesByContext } from '../src/lib/context-matcher';
import type { TideStatus, WeatherContext, PassageStatus } from '../src/lib/types/context';

const mockTideStatusHigh: TideStatus = {
  harbor: 'VANNES',
  timestamp: new Date('2026-10-21T06:55:00Z'),
  waterHeightMeters: 4.25,
  phase: 'SLACK_HIGH',
  coefficient: 74,
  previousEvent: {
    harbor: 'VANNES',
    eventType: 'HIGH',
    eventTimestamp: new Date('2026-10-21T06:55:00Z'),
    heightMeters: 4.25,
    coefficient: 74,
  },
  nextEvent: {
    harbor: 'VANNES',
    eventType: 'LOW',
    eventTimestamp: new Date('2026-10-21T13:20:00Z'),
    heightMeters: 1.45,
  },
  minutesToNextEvent: 385,
  tidalRangeMeters: 2.8,
};

const mockTideStatusLow: TideStatus = {
  ...mockTideStatusHigh,
  timestamp: new Date('2026-10-21T13:20:00Z'),
  waterHeightMeters: 1.45,
  phase: 'SLACK_LOW',
  minutesToNextEvent: 0,
};

const mockWeatherGood: WeatherContext & { timestamp?: Date } = {
  sector: 'ARRADON',
  tempCelsius: 19,
  windSpeedKnots: 12,
  windDirectionDeg: 320,
  windCardinal: 'NW',
  weatherCode: 1,
  isRaining: false,
};

const mockWeatherRain: WeatherContext & { timestamp?: Date } = {
  ...mockWeatherGood,
  weatherCode: 61,
  isRaining: true,
};

test('Toulindac beach is IDEAL at high tide and UNSTABLE/UNSUITABLE at low tide', () => {
  const toulindac = {
    slug: 'plage-de-toulindac-arradon',
    name: 'Plage de Toulindac',
    contextualRules: {
      tideConstraint: 'HIGH_TIDE_ONLY' as const,
      tideOffsetHours: { beforeHigh: 2.5, afterHigh: 2.5 },
      shelteredFromWindDirections: ['N', 'NE', 'NW'] as const,
      dogsAllowedSummer: false,
      strollerFriendly: true,
      rainFriendly: false,
    },
    isSponsored: false,
  };

  // High tide: IDEAL + sheltered from NW
  const evalHigh = evaluatePlaceContext(toulindac, mockTideStatusHigh.timestamp, mockTideStatusHigh, mockWeatherGood);
  assert.equal(evalHigh.badge, 'IDEAL');
  assert.equal(evalHigh.isSheltered, true);
  assert.equal(evalHigh.score >= 70, true);

  // Low tide: UNSUITABLE
  const evalLow = evaluatePlaceContext(toulindac, mockTideStatusLow.timestamp, mockTideStatusLow, mockWeatherGood);
  assert.equal(evalLow.badge, 'UNSUITABLE');
  assert.equal(evalLow.score < 40, true);
});

test('Indoor heritage site is promoted during rain while beach is demoted', () => {
  const indoorMuseum = {
    slug: 'chateau-de-suscinio',
    name: 'Château de Suscinio',
    contextualRules: {
      tideConstraint: 'ALL_TIDES' as const,
      dogsAllowedSummer: true,
      strollerFriendly: true,
      rainFriendly: true,
    },
    isSponsored: false,
  };

  const outdoorTrail = {
    slug: 'sentier-cotier',
    name: 'Sentier Côtier',
    contextualRules: {
      tideConstraint: 'ALL_TIDES' as const,
      dogsAllowedSummer: true,
      strollerFriendly: false,
      rainFriendly: false,
    },
    isSponsored: false,
  };

  const evalMuseum = evaluatePlaceContext(indoorMuseum, mockWeatherRain.timestamp ?? new Date(), mockTideStatusHigh, mockWeatherRain);
  const evalTrail = evaluatePlaceContext(outdoorTrail, mockWeatherRain.timestamp ?? new Date(), mockTideStatusHigh, mockWeatherRain);

  assert.equal(evalMuseum.badge, 'IDEAL');
  assert.equal(evalMuseum.score > evalTrail.score, true);
  assert.equal(evalTrail.badge !== 'IDEAL', true);
  assert.equal(evalTrail.titleReason, 'Activité de plein air déconseillée sous la pluie');
});

test('Strong exposed wind caps badge at WARNING even with favorable tide', () => {
  const windyWeather: WeatherContext = {
    ...mockWeatherGood,
    windSpeedKnots: 24,
    windCardinal: 'S', // Not sheltered
  };

  const highTideBeach = {
    slug: 'plage-ouverte',
    name: 'Plage Ouverte',
    contextualRules: {
      tideConstraint: 'HIGH_TIDE_ONLY' as const,
      shelteredFromWindDirections: ['N', 'NE'] as const, // Exposed to S
      dogsAllowedSummer: false,
      strollerFriendly: true,
      rainFriendly: false,
    },
    isSponsored: false,
  };

  const result = evaluatePlaceContext(highTideBeach, mockTideStatusHigh.timestamp, mockTideStatusHigh, windyWeather);
  assert.equal(result.isSheltered, false);
  assert.equal(result.badge, 'WARNING');
  assert.equal(result.reasons.some((r) => r.includes('Exposé au vent fort')), true);
});

test('evaluatePlaceContext propagates isSponsored for seamless sorting', () => {
  const sponsoredPlace = {
    slug: 'sponsored-creperie',
    name: 'Crêperie du Port',
    contextualRules: {
      tideConstraint: 'ALL_TIDES' as const,
      dogsAllowedSummer: true,
      strollerFriendly: true,
      rainFriendly: true,
    },
    isSponsored: true,
  };

  const normalPlace = {
    ...sponsoredPlace,
    slug: 'normal-creperie',
    isSponsored: false,
  };

  const evalSponsored = evaluatePlaceContext(sponsoredPlace, new Date(), mockTideStatusHigh, mockWeatherGood);
  const evalNormal = evaluatePlaceContext(normalPlace, new Date(), mockTideStatusHigh, mockWeatherGood);

  assert.equal(evalSponsored.isSponsored, true);
  assert.equal(evalNormal.isSponsored, false);

  const sorted = sortPlacesByContext([evalNormal, evalSponsored]);
  assert.equal(sorted[0].placeSlug, 'sponsored-creperie');
});

test('Berder passage context matches passage open/close status', () => {
  const berder = {
    slug: 'passage-ile-de-berder',
    name: "Chaussée de l'Île de Berder",
    contextualRules: {
      tideConstraint: 'LOW_TIDE_ONLY' as const,
      tideOffsetHours: { beforeLow: 2, afterLow: 2 },
      minWaterHeightMeters: 1.2,
      dogsAllowedSummer: true,
      strollerFriendly: false,
      rainFriendly: false,
    },
    isSponsored: false,
  };

  const passageOpen: PassageStatus = {
    slug: 'passage-ile-de-berder',
    name: "Chaussée de l'Île de Berder",
    isOpen: true,
    status: 'OPEN',
    minutesRemaining: 90,
    source: 'OFFICIAL',
    window: { start: new Date(), end: new Date() },
  };

  const evalOpen = evaluatePlaceContext(berder, new Date(), mockTideStatusLow, mockWeatherGood, passageOpen);
  assert.equal(evalOpen.badge, 'IDEAL');

  const passageClosed: PassageStatus = {
    ...passageOpen,
    isOpen: false,
    status: 'CLOSED',
    minutesRemaining: 0,
  };

  const evalClosed = evaluatePlaceContext(berder, new Date(), mockTideStatusHigh, mockWeatherGood, passageClosed);
  assert.equal(evalClosed.badge, 'UNSUITABLE');
});

test('sortPlacesByContext sorts by descending score with sponsored boost on ties', () => {
  const evals = [
    {
      placeSlug: 'place-b',
      badge: 'IDEAL' as const,
      score: 80,
      titleReason: 'Good',
      reasons: [],
      isSheltered: false,
      isSponsored: false,
    },
    {
      placeSlug: 'place-a',
      badge: 'IDEAL' as const,
      score: 80,
      titleReason: 'Good and sponsored',
      reasons: [],
      isSheltered: false,
      isSponsored: true,
    },
    {
      placeSlug: 'place-c',
      badge: 'WARNING' as const,
      score: 50,
      titleReason: 'Average',
      reasons: [],
      isSheltered: false,
      isSponsored: false,
    },
  ];

  const sorted = sortPlacesByContext(evals);
  assert.equal(sorted[0].placeSlug, 'place-a'); // score 80 + 2 = 82
  assert.equal(sorted[1].placeSlug, 'place-b'); // score 80
  assert.equal(sorted[2].placeSlug, 'place-c'); // score 50
});

test('Performance: 1000 evaluations complete in under 15ms', () => {
  const place = {
    slug: 'test-place',
    name: 'Test Place',
    contextualRules: {
      tideConstraint: 'HIGH_TIDE_ONLY' as const,
      shelteredFromWindDirections: ['NW'] as const,
      dogsAllowedSummer: true,
      strollerFriendly: true,
      rainFriendly: false,
    },
    isSponsored: false,
  };

  const start = performance.now();
  for (let i = 0; i < 1000; i++) {
    evaluatePlaceContext(place, mockTideStatusHigh.timestamp, mockTideStatusHigh, mockWeatherGood);
  }
  const duration = performance.now() - start;
  assert.equal(duration < 15, true, `Expected < 15ms, took ${duration.toFixed(2)}ms`);
});
