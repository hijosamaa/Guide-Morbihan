import { NextResponse } from 'next/server';
import { syncWeatherSnapshots } from '../../../../lib/open-meteo';
import { syncOsmData } from '../../../../lib/overpass';

/**
 * Interface pour l'injection optionnelle de dépendances de synchronisation (notamment pour les tests unitaires).
 */
export interface SyncDependencies {
  weatherSync?: () => Promise<{ success: boolean; [key: string]: unknown }>;
  osmSync?: () => Promise<{ success: boolean; [key: string]: unknown }>;
}

/**
 * Valide l'authentification de la requête entrante via CRON_SECRET.
 * Supporte soit l'en-tête Authorization: Bearer <token>, soit le paramètre d'URL ?token=<token>.
 *
 * @param request Requête HTTP entrante
 * @returns true si le jeton fourni correspond à process.env.CRON_SECRET, false sinon
 */
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Si CRON_SECRET n'est pas configuré, refus systématique en production
    return false;
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token === secret) return true;
  }

  const url = new URL(request.url, 'http://localhost');
  const queryToken = url.searchParams.get('token');
  if (queryToken && queryToken === secret) {
    return true;
  }

  return false;
}

/**
 * Gestionnaire principal de synchronisation exécuté par les méthodes GET et POST.
 *
 * @param request Requête HTTP entrante
 * @param deps Dépendances injectées (facultatif, utilisé principalement par les tests)
 * @returns NextResponse contenant le statut d'exécution et les détails des jobs
 */
export async function handleSync(request: Request, deps?: SyncDependencies) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing cron secret' },
      { status: 401 }
    );
  }

  const url = new URL(request.url, 'http://localhost');
  const job = url.searchParams.get('job') || 'all';
  const startTime = Date.now();

  const results: Record<string, unknown> = {};
  let globalSuccess = true;

  const weatherSync = deps?.weatherSync ?? syncWeatherSnapshots;
  const osmSync = deps?.osmSync ?? syncOsmData;

  if (job === 'weather' || job === 'all') {
    const weatherReport = await weatherSync();
    results.weather = weatherReport;
    if (!weatherReport.success) globalSuccess = false;
  }

  if (job === 'osm' || job === 'all') {
    const osmReport = await osmSync();
    results.osm = osmReport;
    if (!osmReport.success) globalSuccess = false;
  }

  const durationMs = Date.now() - startTime;
  const status = globalSuccess ? 200 : 207;

  return NextResponse.json(
    {
      success: globalSuccess,
      timestamp: new Date().toISOString(),
      durationMs,
      jobs: results,
    },
    { status }
  );
}

/**
 * Route GET /api/cron/sync
 */
export async function GET(request: Request) {
  return handleSync(request);
}

/**
 * Route POST /api/cron/sync
 */
export async function POST(request: Request) {
  return handleSync(request);
}
