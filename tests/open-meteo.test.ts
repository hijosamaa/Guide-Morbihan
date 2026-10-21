import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COASTAL_SECTORS,
  mapOpenMeteoResponseToSnapshot,
} from '../src/lib/open-meteo.js';
import type { OpenMeteoCurrentResponse } from '../src/lib/types/weather.js';

test('COASTAL_SECTORS contains all 6 required strategic zones', () => {
  const expectedKeys = ['VANNES', 'ARRADON', 'LOCMARIAQUER', 'SARZEAU', 'QUIBERON', 'ETEL'];
  assert.deepEqual(Object.keys(COASTAL_SECTORS).sort(), expectedKeys.sort());
  assert.equal(COASTAL_SECTORS.LOCMARIAQUER.sector, 'LOCMARIAQUER');
  assert.equal(COASTAL_SECTORS.ETEL.sector, 'ETEL');
});

test('mapOpenMeteoResponseToSnapshot correctly parses weather data and rain codes', () => {
  const mockApiData: OpenMeteoCurrentResponse = {
    latitude: 47.6586,
    longitude: -2.7599,
    current: {
      time: '2026-10-21T14:00:00Z',
      interval: 900,
      temperature_2m: 19.4,
      precipitation: 0.0,
      weather_code: 3, // Nuageux sans pluie
      wind_speed_10m: 12.5,
      wind_direction_10m: 240, // Ouest / Sud-Ouest -> SW
      wind_gusts_10m: 18.2,
    },
  };

  const snapshot = mapOpenMeteoResponseToSnapshot('VANNES', mockApiData);

  assert.equal(snapshot.sector, 'VANNES');
  assert.equal(snapshot.tempCelsius, 19.4);
  assert.equal(snapshot.windSpeedKnots, 12.5);
  assert.equal(snapshot.windDirectionDeg, 240);
  assert.equal(snapshot.windCardinal, 'SW');
  assert.equal(snapshot.weatherCode, 3);
  assert.equal(snapshot.isRaining, false);
});

test('mapOpenMeteoResponseToSnapshot detects rain when precipitation or WMO code triggers it', () => {
  // Cas avec WMO 61 (pluie légère)
  const rainyData: OpenMeteoCurrentResponse = {
    latitude: 47.4839,
    longitude: -3.1206,
    current: {
      time: '2026-10-21T14:00:00Z',
      interval: 900,
      temperature_2m: 15.0,
      precipitation: 1.2,
      weather_code: 61,
      wind_speed_10m: 22.0,
      wind_direction_10m: 290, // WNW -> W
    },
  };

  const snapshot = mapOpenMeteoResponseToSnapshot('QUIBERON', rainyData);
  assert.equal(snapshot.isRaining, true);
  assert.equal(snapshot.windCardinal, 'W');
});
