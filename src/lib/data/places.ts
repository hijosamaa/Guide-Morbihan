import { db } from '../../db';
import { places as placesTable } from '../../db/schema';
import type { Place, TideStatus } from '../types/context';
import type { PlaceMarkerData } from '../types/map';
import { evaluatePlaceContext } from '../context-matcher';
import { getTideStatus } from '../tide-engine';
import curatedSpotsData from '../../../data/curated-spots.json';
import { seedPlaces } from '../../db/seed-data';

export interface GetPlacesFilterOptions {
  category?: string;
  tideFilter?: string;
  shelteredFromWind?: boolean;
  rainOnly?: boolean;
  bbox?: [number, number, number, number];
}

/**
 * Charge la liste locale de secours fusionnant les 12 spots curés et les seeds de référence.
 */
export function getLocalFallbackPlaces(): Place[] {
  const curated = (curatedSpotsData as unknown as Place[]).map((p) => ({
    ...p,
    id: p.id || p.slug,
  }));

  const curatedSlugs = new Set(curated.map((c) => c.slug));

  const seeds: Place[] = seedPlaces
    .filter((s) => !curatedSlugs.has(s.slug))
    .map((s) => ({
      id: s.slug,
      slug: s.slug,
      name: s.name,
      shortDescription: s.shortDescription,
      fullDescription: s.fullDescription || undefined,
      category: s.category as any,
      commune: s.commune,
      communeSlug: s.communeSlug,
      sector: s.sector,
      latitude: s.latitude,
      longitude: s.longitude,
      parkingLat: s.parkingLat || undefined,
      parkingLng: s.parkingLng || undefined,
      contextualRules: s.contextualRules as any,
      isSponsored: s.isSponsored,
      affiliateBookingUrl: s.affiliateBookingUrl || undefined,
      affiliateLabel: s.affiliateLabel || undefined,
      photoGallery: [],
    }));

  return [...curated, ...seeds];
}

/**
 * Récupère tous les lieux (depuis Supabase avec fallback défensif local) et calcule leur contexte.
 */
export async function getAllPlaces(options: GetPlacesFilterOptions = {}): Promise<PlaceMarkerData[]> {
  let placesList: Place[] = [];

  try {
    // Timeout défensif de 2000ms sur la connexion DB pour éviter de bloquer en CI/hors-ligne
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB Timeout')), 2000)
    );

    const queryPromise = db.select().from(placesTable);
    const dbPlaces = await Promise.race([queryPromise, timeoutPromise]);

    if (dbPlaces && dbPlaces.length > 0) {
      placesList = dbPlaces.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        shortDescription: p.shortDescription,
        fullDescription: p.fullDescription || undefined,
        category: p.category as any,
        commune: p.commune,
        communeSlug: p.communeSlug,
        sector: p.sector,
        latitude: p.latitude,
        longitude: p.longitude,
        parkingLat: p.parkingLat || undefined,
        parkingLng: p.parkingLng || undefined,
        contextualRules: p.contextualRules as any,
        trailData: (p.trailData as any) || undefined,
        photoGallery: (p.photoGallery as any) || [],
        practicalInfo: (p.practicalInfo as any) || undefined,
        tideDetails: (p.tideDetails as any) || undefined,
        isSponsored: p.isSponsored,
        affiliateBookingUrl: p.affiliateBookingUrl || undefined,
        affiliateLabel: p.affiliateLabel || undefined,
      }));
    } else {
      placesList = getLocalFallbackPlaces();
    }
  } catch {
    // En cas d'erreur de connexion ou hors-ligne, bascule instantanément sur le fallback
    placesList = getLocalFallbackPlaces();
  }

  // Filtrage catégorie
  if (options.category && options.category !== 'ALL') {
    placesList = placesList.filter((p) => p.category === options.category);
  }

  // Calcul du contexte marégraphique actuel
  const now = new Date();

  const defaultTide: TideStatus = {
    harbor: 'PORT_NAVALO',
    timestamp: now,
    waterHeightMeters: 4.2,
    phase: 'FLOOD',
    coefficient: 78,
    previousEvent: {
      harbor: 'PORT_NAVALO',
      eventType: 'LOW',
      eventTimestamp: new Date(now.getTime() - 2 * 3600 * 1000),
      heightMeters: 1.2,
      coefficient: 78,
    },
    nextEvent: {
      harbor: 'PORT_NAVALO',
      eventType: 'HIGH',
      eventTimestamp: new Date(now.getTime() + 4 * 3600 * 1000),
      heightMeters: 4.8,
      coefficient: 78,
    },
    minutesToNextEvent: 240,
    tidalRangeMeters: 3.6,
  };

  const defaultWeather = {
    sector: 'VANNES',
    tempCelsius: 19,
    windSpeedKnots: 12,
    windDirectionDeg: 315,
    windCardinal: 'NW' as const,
    weatherCode: 1,
    isRaining: options.rainOnly ?? false,
    updatedAt: now,
  };

  return placesList.map((place) => {
    const context = evaluatePlaceContext(place, now, defaultTide, defaultWeather);

    return {
      id: place.id || place.slug,
      slug: place.slug,
      name: place.name,
      latitude: place.latitude ?? 0,
      longitude: place.longitude ?? 0,
      category: place.category as any,
      status: context.status,
      score: context.score,
      label: context.badgeLabel,
      isSponsored: place.isSponsored,
      imageUrl: place.photoGallery?.[0]?.url,
    };
  });
}

/**
 * Récupère les détails enrichis d'un lieu à partir de son slug ou alias.
 */
export async function getPlaceBySlug(slug: string): Promise<Place | null> {
  if (!slug) return null;
  const normalized = slug.toLowerCase().trim();

  // Recherche dans les données locales en premier pour rapidité et robustesse hors-ligne
  const fallbackList = getLocalFallbackPlaces();
  const directMatch = fallbackList.find(
    (p) =>
      p.slug === normalized ||
      p.slug.replace(/-/g, '').includes(normalized.replace(/-/g, '')) ||
      normalized.replace(/-/g, '').includes(p.slug.replace(/-/g, ''))
  );

  if (directMatch && directMatch.photoGallery && directMatch.photoGallery.length > 0) {
    return directMatch;
  }

  // Si pas de fiche locale enrichie ou si requête DB disponible
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB Timeout')), 2000)
    );

    const queryPromise = db.select().from(placesTable);
    const dbPlaces = await Promise.race([queryPromise, timeoutPromise]);
    const found = dbPlaces.find(
      (p) =>
        p.slug === normalized ||
        p.slug.replace(/-/g, '').includes(normalized.replace(/-/g, '')) ||
        normalized.replace(/-/g, '').includes(p.slug.replace(/-/g, ''))
    );

    if (found) {
      return {
        id: found.id,
        slug: found.slug,
        name: found.name,
        shortDescription: found.shortDescription,
        fullDescription: found.fullDescription || undefined,
        category: found.category as any,
        commune: found.commune,
        communeSlug: found.communeSlug,
        sector: found.sector,
        latitude: found.latitude,
        longitude: found.longitude,
        parkingLat: found.parkingLat || undefined,
        parkingLng: found.parkingLng || undefined,
        contextualRules: found.contextualRules as any,
        trailData: (found.trailData as any) || undefined,
        photoGallery: (found.photoGallery as any) || [],
        practicalInfo: (found.practicalInfo as any) || undefined,
        tideDetails: (found.tideDetails as any) || undefined,
        isSponsored: found.isSponsored,
        affiliateBookingUrl: found.affiliateBookingUrl || undefined,
        affiliateLabel: found.affiliateLabel || undefined,
      };
    }
  } catch {
    // fallback on directMatch
  }

  return directMatch || null;
}
