import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  TidalPhase,
  PassageStatusKind,
  ContextBadge,
  TidePoint,
  TideStatus,
  OfficialPassageWindow,
  PassageStatus,
  WeatherContext,
  ContextEvaluationResult,
} from '../src/lib/types/context';

test('Context Types can be instantiated and typed strictly', () => {
  const tidePoint: TidePoint = {
    harbor: 'PORT_NAVALO',
    eventType: 'HIGH',
    eventTimestamp: new Date('2026-10-21T05:12:00Z'),
    heightMeters: 4.85,
    coefficient: 74,
  };
  assert.equal(tidePoint.harbor, 'PORT_NAVALO');
  assert.equal(tidePoint.eventType, 'HIGH');
  assert.equal(tidePoint.coefficient, 74);

  const officialWindow: OfficialPassageWindow = {
    passageSlug: 'passage-ile-de-berder',
    openAt: new Date('2026-10-21T09:30:00Z'),
    closeAt: new Date('2026-10-21T13:30:00Z'),
    source: 'MAIRIE_LARMOR_BADEN',
  };
  assert.equal(officialWindow.passageSlug, 'passage-ile-de-berder');

  const weather: WeatherContext = {
    sector: 'VANNES',
    tempCelsius: 18.5,
    windSpeedKnots: 11.2,
    windDirectionDeg: 315,
    windCardinal: 'NW',
    weatherCode: 1,
    isRaining: false,
  };
  assert.equal(weather.windCardinal, 'NW');
  assert.equal(weather.isRaining, false);
});
