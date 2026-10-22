import type { EvaluationStatus } from './context';

export interface PlaceMarkerData {
  id: string;
  slug: string;
  name: string;
  latitude: number;
  longitude: number;
  category: string;
  status: EvaluationStatus;
  isSponsored?: boolean;
  score?: number;
  label?: string;
  imageUrl?: string;
}

export interface MapViewportBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface ElevationPoint {
  distanceKm: number;
  elevationM: number;
  lat: number;
  lon: number;
}

export interface MarkerStyleTokens {
  badgeClass: string;
  dotClass: string;
  ringClass: string;
  iconName?: string;
}

export interface GolfeMapProps {
  places?: PlaceMarkerData[];
  selectedPlaceId?: string | null;
  onSelectPlace?: (place: PlaceMarkerData) => void;
  onBoundsChange?: (placesInView: PlaceMarkerData[], bounds: MapViewportBounds) => void;
  initialCenter?: [number, number];
  initialZoom?: number;
  interactive?: boolean;
  className?: string;
  showControls?: boolean;
  enableUserLocation?: boolean;
  activeSnapPoint?: string | number | null;
}

export interface SubmersiblePassageInfo {
  name: string;
  distanceKm: number;
  opensAt: Date | string;
  closesAt: Date | string;
  tideCoefficient?: number;
  windSpeedKnots?: number;
  windCardinal?: string;
}

export interface GpxTrackViewerProps {
  geojson: GeoJSON.Feature<GeoJSON.LineString>;
  elevationProfile: ElevationPoint[];
  totalDistanceKm: number;
  elevationGainM: number;
  elevationLossM?: number;
  title?: string;
  className?: string;
  showStats?: boolean;
  enableLiveTracking?: boolean;
  submersiblePassage?: SubmersiblePassageInfo;
  tideAlert?: {
    status: 'PASSABLE' | 'WARNING_CLOSING' | 'SUBMERGED';
    message: string;
  };
}
