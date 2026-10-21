/**
 * Types pour les connecteurs OpenStreetMap Overpass API
 */

export interface OverpassElement {
  type: 'node' | 'way';
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: Record<string, string>;
}

export interface OverpassResponse {
  version: number;
  generator: string;
  elements: OverpassElement[];
}

export interface OsmSyncReport {
  success: boolean;
  slipwaysUpserted: number;
  amenitiesUpserted: number;
  totalParsed: number;
  errors: string[];
}
