export type TidalPhase = 'FLOOD' | 'EBB' | 'SLACK_HIGH' | 'SLACK_LOW';
export type PassageStatusKind = 'OPEN' | 'CLOSING_SOON' | 'CLOSED' | 'OPENING_SOON';
export type ContextBadge = 'IDEAL' | 'WARNING' | 'UNSUITABLE';
export type EvaluationStatus = 'IDEAL' | 'WARNING' | 'DISCOURAGED';
export type WindCardinal = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export interface TidePoint {
  harbor: 'PORT_NAVALO' | 'VANNES';
  eventType: 'HIGH' | 'LOW';
  eventTimestamp: Date;
  heightMeters: number;
  coefficient?: number | null;
}

export interface TideStatus {
  harbor: 'PORT_NAVALO' | 'VANNES';
  timestamp: Date;
  waterHeightMeters: number;
  phase: TidalPhase;
  coefficient: number;
  previousEvent: TidePoint;
  nextEvent: TidePoint;
  minutesToNextEvent: number;
  tidalRangeMeters: number;
}

export interface OfficialPassageWindow {
  passageSlug: string;
  openAt: Date;
  closeAt: Date;
  source?: string;
}

export interface PassageStatus {
  slug: string;
  name: string;
  isOpen: boolean;
  status: PassageStatusKind;
  minutesRemaining: number;
  source: 'OFFICIAL' | 'CALCULATED_FALLBACK';
  window: {
    start: Date;
    end: Date;
  };
  hazardNotice?: string;
}

export interface WeatherContext {
  sector: string;
  tempCelsius: number;
  windSpeedKnots: number;
  windDirectionDeg: number;
  windCardinal: WindCardinal;
  weatherCode: number;
  isRaining: boolean;
}

export interface ContextEvaluationResult {
  placeSlug: string;
  badge: ContextBadge;
  score: number;
  titleReason: string;
  reasons: string[];
  isSheltered: boolean;
  isSponsored?: boolean;
  tideContext?: {
    harbor: 'PORT_NAVALO' | 'VANNES';
    waterHeightMeters: number;
    phase: TidalPhase;
  };
  passageContext?: PassageStatus;
}

export interface PhotoItem {
  url: string;
  caption?: string;
  credit?: string;
  isCover?: boolean;
}

export interface PracticalInfo {
  recommendedDurationMinutes?: number;
  pricing?: string;
  amenities?: ('toilets' | 'water' | 'parking' | 'food' | 'picnic_table' | 'shade')[];
  insiderTip?: string;
  goodToKnow?: string;
  bestSeason?: ('SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER')[];
}

export interface TideDetails {
  highTideAdvantage?: string;
  lowTideAdvantage?: string;
  warningNote?: string;
}

export type PlaceSourceType = 'DATATOURISME' | 'CURATED' | 'MANUAL';

