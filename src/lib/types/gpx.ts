export interface ElevationPoint {
  distKm: number;
  altM: number;
}

export interface ParsedGpxResult {
  track: GeoJSON.Feature<GeoJSON.LineString>;
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  minElevationM: number;
  maxElevationM: number;
  estimatedDurationMinutes: number;
  elevationProfile: ElevationPoint[];
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
}
