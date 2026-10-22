import type { Place } from '../../db/schema';
import type { DayTidesSummary } from '../tide-engine';

export type BaseSector =
  | 'Golfe'
  | 'Presqu-ile de Rhuys'
  | 'Presqu-ile de Quiberon'
  | 'Ria d-Etel';

export type ProfileType = 'FAMILY' | 'NATURE' | 'HERITAGE_GOURMET';

export type MomentType = 'MATIN' | 'DEJEUNER' | 'APRES_MIDI' | 'FIN_JOURNEE';

export interface EscapadeProfile {
  baseSector: BaseSector;
  durationDays: number;
  profileType: ProfileType;
}

export type EscapadePlace = Place | {
  id?: string;
  slug?: string;
  name: string;
  category?: string;
  sector?: string;
  commune?: string;
  communeSlug?: string;
  shortDescription?: string;
  fullDescription?: string;
  latitude?: number;
  longitude?: number;
  parkingLat?: number | null;
  parkingLng?: number | null;
  coverImageUrl?: string | null;
  isSponsored?: boolean;
  affiliateBookingUrl?: string | null;
  affiliateLabel?: string | null;
  contextualRules?: {
    tideConstraint?: string;
    shelteredFromWindDirections?: string[];
    minWaterHeightMeters?: number;
    dogsAllowedSummer?: boolean;
    strollerFriendly?: boolean;
    rainFriendly?: boolean;
    tideOffsetHours?: {
      beforeHigh?: number;
      afterHigh?: number;
      beforeLow?: number;
      afterLow?: number;
    };
  };
  [key: string]: any;
};

export interface EscapadeMoment {
  momentType: MomentType;
  title: string;
  place: EscapadePlace;
  alternatives: EscapadePlace[];
  tideNotice?: string;
  originalPlace?: EscapadePlace;
}

export interface EscapadeDay {
  dayIndex: number;
  date: string;
  sector: BaseSector;
  moments: EscapadeMoment[];
  tideSummary?: DayTidesSummary | string | Record<string, any>;
  isRainMode?: boolean;
}

export interface EscapadePlan {
  id?: string;
  profile: EscapadeProfile;
  days: EscapadeDay[];
  createdAt?: string;
}
