import fs from 'node:fs';
import path from 'node:path';
import { PhotoItem, PracticalInfo, TideDetails, PlaceSourceType } from './types/context';

export interface CuratedSpotRecord {
  slug: string;
  name: string;
  shortDescription: string;
  fullDescription: string;
  category: 'BEACH' | 'TRAIL' | 'TIDAL_PASSAGE' | 'HERITAGE' | 'GASTRONOMY' | 'NAUTICAL' | 'VIEWPOINT';
  commune: string;
  communeSlug: string;
  sector: string;
  latitude: number;
  longitude: number;
  parkingLat?: number;
  parkingLng?: number;
  sourceType: PlaceSourceType;
  contextualRules: {
    tideConstraint: 'ALL_TIDES' | 'HIGH_TIDE_ONLY' | 'LOW_TIDE_ONLY' | 'MID_TIDE_FLOW';
    tideOffsetHours?: { beforeHigh?: number; afterHigh?: number; beforeLow?: number; afterLow?: number };
    shelteredFromWindDirections?: ('N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW')[];
    minWaterHeightMeters?: number;
    dogsAllowedSummer: boolean;
    strollerFriendly: boolean;
    rainFriendly: boolean;
  };
  practicalInfo?: PracticalInfo;
  tideDetails?: TideDetails;
  photoGallery?: PhotoItem[];
}

/**
 * Charge la liste des pépites et spots curés de manière souveraine depuis le fichier JSON local.
 * Opération synchrone zéro-coût runtime sans dépendance réseau.
 */
export function getCuratedSpots(): CuratedSpotRecord[] {
  const candidates = [
    path.resolve(process.cwd(), 'data/curated-spots.json'),
    path.resolve(process.cwd(), '../data/curated-spots.json'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const raw = fs.readFileSync(candidate, 'utf-8');
      return JSON.parse(raw) as CuratedSpotRecord[];
    }
  }

  return [];
}

/**
 * Recherche un spot curé par son identifiant unique (slug).
 * @param slug Identifiant URL du lieu (ex: 'ile-de-berder')
 */
export function findCuratedSpotBySlug(slug: string): CuratedSpotRecord | undefined {
  return getCuratedSpots().find((s) => s.slug === slug);
}
