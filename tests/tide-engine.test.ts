import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTwelfthsFraction,
  interpolateWaterHeight,
  resolveHarborForCommune,
  getTideStatus,
} from '../src/lib/tide-engine';
import type { TidePoint } from '../src/lib/types/context';

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
