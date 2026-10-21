import { db as defaultDb } from '../db/index.js';
import { weatherSnapshots } from '../db/schema.js';
import { degreesToCardinal } from './utils/geo.js';
import type {
  CoastalSectorKey,
  SectorConfig,
  OpenMeteoCurrentResponse,
  TransformedWeatherSnapshot,
  WeatherSyncReport,
} from './types/weather.js';

export const COASTAL_SECTORS: Record<CoastalSectorKey, SectorConfig> = {
  VANNES: {
    sector: 'VANNES',
    name: 'Fond de Golfe (Vannes / Séné)',
    latitude: 47.6586,
    longitude: -2.7599,
  },
  ARRADON: {
    sector: 'ARRADON',
    name: 'Golfe Intérieur (Arradon / Îles / Baden)',
    latitude: 47.6258,
    longitude: -2.8277,
  },
  LOCMARIAQUER: {
    sector: 'LOCMARIAQUER',
    name: 'Entrée de Golfe Ouest & Baie de Quiberon',
    latitude: 47.5695,
    longitude: -2.9443,
  },
  SARZEAU: {
    sector: 'SARZEAU',
    name: "Presqu'île de Rhuys (Sarzeau / Port-Navalo)",
    latitude: 47.5278,
    longitude: -2.7694,
  },
  QUIBERON: {
    sector: 'QUIBERON',
    name: "Presqu'île de Quiberon & Océan",
    latitude: 47.4839,
    longitude: -3.1206,
  },
  ETEL: {
    sector: 'ETEL',
    name: "Ria d'Étel & Côte Sauvage Nord",
    latitude: 47.6575,
    longitude: -3.2003,
  },
};

/**
 * Codes WMO indiquant des précipitations (bruine, pluie, neige, averses, orages).
 */
const RAIN_WMO_CODES = new Set([
  51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99,
]);

/**
 * Transforme la réponse brute Open-Meteo en snapshot normalisé.
 */
export function mapOpenMeteoResponseToSnapshot(
  sector: CoastalSectorKey,
  data: OpenMeteoCurrentResponse
): TransformedWeatherSnapshot {
  const current = data.current;
  const isRaining = current.precipitation > 0.1 || RAIN_WMO_CODES.has(current.weather_code);
  const windCardinal = degreesToCardinal(current.wind_direction_10m);

  return {
    sector,
    tempCelsius: Math.round(current.temperature_2m * 10) / 10,
    windSpeedKnots: Math.round(current.wind_speed_10m * 10) / 10,
    windDirectionDeg: Math.round(current.wind_direction_10m),
    windCardinal,
    weatherCode: current.weather_code,
    isRaining,
    updatedAt: new Date(),
  };
}

/**
 * Récupère les prévisions actuelles pour un secteur via l'API Open-Meteo (modèle AROME).
 */
export async function fetchSectorWeather(
  config: SectorConfig
): Promise<TransformedWeatherSnapshot> {
  const params = new URLSearchParams({
    latitude: config.latitude.toString(),
    longitude: config.longitude.toString(),
    current:
      'temperature_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    wind_speed_unit: 'kn',
    models: 'meteofrance_arome_france_hd,meteofrance_arome_france',
  });

  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo error (${response.status}): ${response.statusText}`);
  }

  const raw = (await response.json()) as OpenMeteoCurrentResponse;
  return mapOpenMeteoResponseToSnapshot(config.sector, raw);
}

/**
 * Synchronise les 6 secteurs côtiers en base de données de manière résiliente.
 */
export async function syncWeatherSnapshots(
  dbClient = defaultDb
): Promise<WeatherSyncReport> {
  const report: WeatherSyncReport = {
    success: true,
    sectorsUpdated: 0,
    sectorsFailed: 0,
    errors: [],
  };

  const sectors = Object.values(COASTAL_SECTORS);

  await Promise.all(
    sectors.map(async (cfg) => {
      try {
        const snapshot = await fetchSectorWeather(cfg);
        await dbClient
          .insert(weatherSnapshots)
          .values(snapshot)
          .onConflictDoUpdate({
            target: weatherSnapshots.sector,
            set: {
              tempCelsius: snapshot.tempCelsius,
              windSpeedKnots: snapshot.windSpeedKnots,
              windDirectionDeg: snapshot.windDirectionDeg,
              windCardinal: snapshot.windCardinal,
              weatherCode: snapshot.weatherCode,
              isRaining: snapshot.isRaining,
              updatedAt: snapshot.updatedAt,
            },
          });
        report.sectorsUpdated++;
      } catch (err) {
        report.sectorsFailed++;
        report.errors.push({
          sector: cfg.sector,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })
  );

  report.success = report.sectorsFailed === 0;
  return report;
}
