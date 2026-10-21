import type { CardinalDirection } from '../utils/geo.js';

export type CoastalSectorKey =
  | 'VANNES'
  | 'ARRADON'
  | 'LOCMARIAQUER'
  | 'SARZEAU'
  | 'QUIBERON'
  | 'ETEL';

export interface SectorConfig {
  sector: CoastalSectorKey;
  name: string;
  latitude: number;
  longitude: number;
}

export interface OpenMeteoCurrentResponse {
  latitude: number;
  longitude: number;
  current: {
    time: string;
    interval: number;
    temperature_2m: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    wind_gusts_10m?: number;
  };
}

export interface TransformedWeatherSnapshot {
  sector: CoastalSectorKey;
  tempCelsius: number;
  windSpeedKnots: number;
  windDirectionDeg: number;
  windCardinal: CardinalDirection;
  weatherCode: number;
  isRaining: boolean;
  updatedAt: Date;
}

export interface WeatherSyncReport {
  success: boolean;
  sectorsUpdated: number;
  sectorsFailed: number;
  errors: { sector: CoastalSectorKey; error: string }[];
}
