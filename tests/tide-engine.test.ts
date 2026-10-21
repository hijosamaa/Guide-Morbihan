import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTwelfthsFraction,
  interpolateWaterHeight,
  resolveHarborForCommune,
  getTideStatus,
  evaluatePassageStatus,
} from '../src/lib/tide-engine';
import type { OfficialPassageWindow, TidePoint } from '../src/lib/types/context';

test('Rule of twelfths fractional checkpoints', () => {
  // Check exact 1/12, 3/12, 6/12, 9/12, 11/12, 12/12
  assert.equal(calculateTwelfthsFraction(0), 0);
  assert.equal(calculateTwelfthsFraction(1 / 6), 1 / 12);
  assert.equal(calculateTwelfthsFraction(2 / 6), 3 / 12);
  assert.equal(calculateTwelfthsFraction(3 / 6), 6 / 12);
  assert.equal(calculateTwelfthsFraction(4 / 6), 9 / 12);
  assert.equal(calculateTwelfthsFraction(5 / 6), 11 / 12);
  assert.equal(calculateTwelfthsFraction(1), 1);
});

test('Continuous height interpolation during flood and ebb', () => {
  const low: TidePoint = {
    harbor: 'PORT_NAVALO',
    eventType: 'LOW',
    eventTimestamp: new Date('2026-10-21T11:34:00Z'),
    heightMeters: 1.12,
  };
  const high: TidePoint = {
    harbor: 'PORT_NAVALO',
    eventType: 'HIGH',
    eventTimestamp: new Date('2026-10-21T17:42:00Z'),
    heightMeters: 5.02,
    coefficient: 78,
  };

  // At low tide: exact low height
  const hStart = interpolateWaterHeight(low.eventTimestamp, low, high);
  assert.equal(Math.round(hStart * 100) / 100, 1.12);

  // At high tide: exact high height
  const hEnd = interpolateWaterHeight(high.eventTimestamp, low, high);
  assert.equal(Math.round(hEnd * 100) / 100, 5.02);

  // Half duration (mid-tide, 3/6 progress): should equal low + 0.5 * range
  const midTime = new Date(low.eventTimestamp.getTime() + (high.eventTimestamp.getTime() - low.eventTimestamp.getTime()) / 2);
  const hMid = interpolateWaterHeight(midTime, low, high);
  const expectedMid = 1.12 + (5.02 - 1.12) * 0.5;
  assert.equal(Math.abs(hMid - expectedMid) < 0.001, true);

  // Ebb interpolation (descending from high at 05:12 to low at 11:34)
  const prevHigh: TidePoint = {
    harbor: 'PORT_NAVALO',
    eventType: 'HIGH',
    eventTimestamp: new Date('2026-10-21T05:12:00Z'),
    heightMeters: 5.02,
  };
  const midEbbTime = new Date(prevHigh.eventTimestamp.getTime() + (low.eventTimestamp.getTime() - prevHigh.eventTimestamp.getTime()) / 2);
  const hEbbMid = interpolateWaterHeight(midEbbTime, prevHigh, low);
  const expectedEbbMid = 5.02 - (5.02 - 1.12) * 0.5;
  assert.equal(Math.abs(hEbbMid - expectedEbbMid) < 0.001, true);
});

test('Resolve harbor for commune correctly assigns outer vs inner gulf', () => {
  assert.equal(resolveHarborForCommune('arzon'), 'PORT_NAVALO');
  assert.equal(resolveHarborForCommune('quiberon'), 'PORT_NAVALO');
  assert.equal(resolveHarborForCommune('etel'), 'PORT_NAVALO');
  assert.equal(resolveHarborForCommune('vannes'), 'VANNES');
  assert.equal(resolveHarborForCommune('arradon'), 'VANNES');
  assert.equal(resolveHarborForCommune('larmor-baden'), 'VANNES');
  assert.equal(resolveHarborForCommune('saint-armel'), 'VANNES');
  assert.equal(resolveHarborForCommune('unknown-commune', 'Presqu-ile de Quiberon'), 'PORT_NAVALO');
});

test('getTideStatus returns complete phase and state', () => {
  const events: TidePoint[] = [
    {
      harbor: 'PORT_NAVALO',
      eventType: 'HIGH',
      eventTimestamp: new Date('2026-10-21T05:12:00Z'),
      heightMeters: 4.85,
      coefficient: 74,
    },
    {
      harbor: 'PORT_NAVALO',
      eventType: 'LOW',
      eventTimestamp: new Date('2026-10-21T11:34:00Z'),
      heightMeters: 1.12,
      coefficient: null,
    },
    {
      harbor: 'PORT_NAVALO',
      eventType: 'HIGH',
      eventTimestamp: new Date('2026-10-21T17:42:00Z'),
      heightMeters: 5.02,
      coefficient: 78,
    },
  ];

  // 14:00 is between LOW (11:34) and HIGH (17:42) -> FLOOD
  const status = getTideStatus(new Date('2026-10-21T14:00:00Z'), 'PORT_NAVALO', events);
  assert.equal(status.harbor, 'PORT_NAVALO');
  assert.equal(status.phase, 'FLOOD');
  assert.equal(status.coefficient, 78);
  assert.equal(status.waterHeightMeters > 1.12, true);
  assert.equal(status.waterHeightMeters < 5.02, true);
  assert.equal(status.previousEvent.eventType, 'LOW');
  assert.equal(status.nextEvent.eventType, 'HIGH');

  // Slack low within 20 mins of LOW (11:34) -> 11:45
  const slackLowStatus = getTideStatus(new Date('2026-10-21T11:45:00Z'), 'PORT_NAVALO', events);
  assert.equal(slackLowStatus.phase, 'SLACK_LOW');

  // Slack high within 20 mins before HIGH (17:42) -> 17:30
  const slackHighStatus = getTideStatus(new Date('2026-10-21T17:30:00Z'), 'PORT_NAVALO', events);
  assert.equal(slackHighStatus.phase, 'SLACK_HIGH');

  // Throws if insufficient events
  assert.throws(() => {
    getTideStatus(new Date('2026-10-21T14:00:00Z'), 'VANNES', events);
  }, /Insufficient tide events/);
});

test('Berder passage prioritizes official window when provided', () => {
  const officialWindows: OfficialPassageWindow[] = [
    {
      passageSlug: 'passage-ile-de-berder',
      openAt: new Date('2026-10-21T09:30:00Z'),
      closeAt: new Date('2026-10-21T13:30:00Z'),
      source: 'MAIRIE_LARMOR_BADEN',
    },
  ];

  // At 11:00: open with official source
  const statusOpen = evaluatePassageStatus('passage-ile-de-berder', new Date('2026-10-21T11:00:00Z'), {
    officialWindows,
  });
  assert.equal(statusOpen.isOpen, true);
  assert.equal(statusOpen.status, 'OPEN');
  assert.equal(statusOpen.source, 'OFFICIAL');
  assert.equal(statusOpen.minutesRemaining, 150); // 2h30 before 13:30

  // At 13:15: closing soon (< 30 min before 13:30)
  const statusClosing = evaluatePassageStatus('passage-ile-de-berder', new Date('2026-10-21T13:15:00Z'), {
    officialWindows,
  });
  assert.equal(statusClosing.isOpen, true);
  assert.equal(statusClosing.status, 'CLOSING_SOON');
  assert.equal(statusClosing.minutesRemaining, 15);

  // At 14:00: closed
  const statusClosed = evaluatePassageStatus('passage-ile-de-berder', new Date('2026-10-21T14:00:00Z'), {
    officialWindows,
  });
  assert.equal(statusClosed.isOpen, false);
  assert.equal(statusClosed.status, 'CLOSED');
});

test('Berder passage falls back to calculation when no official window provided', () => {
  const tideEvents: TidePoint[] = [
    {
      harbor: 'VANNES',
      eventType: 'HIGH',
      eventTimestamp: new Date('2026-10-21T06:55:00Z'),
      heightMeters: 4.25,
      coefficient: 74,
    },
    {
      harbor: 'VANNES',
      eventType: 'LOW',
      eventTimestamp: new Date('2026-10-21T13:20:00Z'),
      heightMeters: 1.45,
      coefficient: null,
    },
    {
      harbor: 'VANNES',
      eventType: 'HIGH',
      eventTimestamp: new Date('2026-10-21T19:25:00Z'),
      heightMeters: 4.4,
      coefficient: 78,
    },
  ];

  // At 13:20 (exact low tide): open via fallback
  const statusFallback = evaluatePassageStatus('passage-ile-de-berder', new Date('2026-10-21T13:20:00Z'), {
    tideEvents,
  });
  assert.equal(statusFallback.isOpen, true);
  assert.equal(statusFallback.source, 'CALCULATED_FALLBACK');
  assert.equal(statusFallback.hazardNotice !== undefined, true);
});

test('Tascon passage fallback calculation and port-navalo commune resolution', () => {
  assert.equal(resolveHarborForCommune('port-navalo'), 'PORT_NAVALO');

  const tideEvents: TidePoint[] = [
    {
      harbor: 'VANNES',
      eventType: 'HIGH',
      eventTimestamp: new Date('2026-10-21T06:55:00Z'),
      heightMeters: 4.25,
      coefficient: 74,
    },
    {
      harbor: 'VANNES',
      eventType: 'LOW',
      eventTimestamp: new Date('2026-10-21T13:20:00Z'),
      heightMeters: 1.45,
    },
    {
      harbor: 'VANNES',
      eventType: 'HIGH',
      eventTimestamp: new Date('2026-10-21T19:25:00Z'),
      heightMeters: 4.4,
      coefficient: 78,
    },
  ];

  const tasconStatus = evaluatePassageStatus('passage-ile-tascon', new Date('2026-10-21T13:20:00Z'), {
    tideEvents,
  });
  assert.equal(tasconStatus.isOpen, true);
  assert.equal(tasconStatus.name, "Passage de l'Île Tascon");
  assert.equal(tasconStatus.source, 'CALCULATED_FALLBACK');
});

test('Monotonicity and strict bounds during flood and ebb', () => {
  const low: TidePoint = {
    harbor: 'PORT_NAVALO',
    eventType: 'LOW',
    eventTimestamp: new Date('2026-10-21T11:00:00Z'),
    heightMeters: 1.0,
  };
  const high: TidePoint = {
    harbor: 'PORT_NAVALO',
    eventType: 'HIGH',
    eventTimestamp: new Date('2026-10-21T17:00:00Z'),
    heightMeters: 5.0,
    coefficient: 80,
  };

  let prevHeight = 0.99;
  for (let mins = 0; mins <= 360; mins += 15) {
    const t = new Date(low.eventTimestamp.getTime() + mins * 60000);
    const height = interpolateWaterHeight(t, low, high);
    assert.equal(height >= prevHeight, true, `Height at ${mins}m (${height}) must be >= previous (${prevHeight})`);
    prevHeight = height;
  }
  assert.equal(Math.round(prevHeight * 100) / 100, 5.0);
});

test('Handles midnight crossing and high spring vs low neap tides', () => {
  // Spring tide across midnight: LOW 23:00 (0.6m) -> HIGH 05:15 next day (5.8m, coeff 115)
  const springLow: TidePoint = {
    harbor: 'PORT_NAVALO',
    eventType: 'LOW',
    eventTimestamp: new Date('2026-10-21T23:00:00Z'),
    heightMeters: 0.6,
  };
  const springHigh: TidePoint = {
    harbor: 'PORT_NAVALO',
    eventType: 'HIGH',
    eventTimestamp: new Date('2026-10-22T05:15:00Z'),
    heightMeters: 5.8,
    coefficient: 115,
  };

  const statusMidnight = getTideStatus(new Date('2026-10-22T01:00:00Z'), 'PORT_NAVALO', [springLow, springHigh]);
  assert.equal(statusMidnight.phase, 'FLOOD');
  assert.equal(statusMidnight.coefficient, 115);
  assert.equal(statusMidnight.tidalRangeMeters, 5.2);
  assert.equal(statusMidnight.waterHeightMeters > 0.6 && statusMidnight.waterHeightMeters < 5.8, true);

  // Neap tide: range is much smaller (coeff 35, range 1.8m)
  const neapLow: TidePoint = {
    harbor: 'VANNES',
    eventType: 'LOW',
    eventTimestamp: new Date('2026-10-21T12:00:00Z'),
    heightMeters: 2.2,
  };
  const neapHigh: TidePoint = {
    harbor: 'VANNES',
    eventType: 'HIGH',
    eventTimestamp: new Date('2026-10-21T18:10:00Z'),
    heightMeters: 4.0,
    coefficient: 35,
  };

  const statusNeap = getTideStatus(new Date('2026-10-21T15:05:00Z'), 'VANNES', [neapLow, neapHigh]);
  assert.equal(statusNeap.coefficient, 35);
  assert.equal(statusNeap.tidalRangeMeters, 1.8);
});

