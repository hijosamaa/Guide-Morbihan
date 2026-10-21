import type { MarkerStyleTokens } from './types/map';
import type { EvaluationStatus } from './types/context';

export const GOLFE_MAP_CONFIG = {
  defaultCenter: [-2.7800, 47.5850] as [number, number],
  defaultZoom: 10.5,
  minZoom: 9.0,
  maxZoom: 18.0,

  maxBounds: [
    [-3.3000, 47.2500], // Sud-Ouest
    [-2.3500, 47.8800], // Nord-Est
  ] as [[number, number], [number, number]],

  styles: {
    liberty: 'https://tiles.openfreemap.org/styles/liberty',
    bright: 'https://tiles.openfreemap.org/styles/bright',
    fallbackRaster: {
      version: 8 as const,
      sources: {
        'osm-tiles': {
          type: 'raster' as const,
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap Contributors',
        },
      },
      layers: [
        {
          id: 'osm-tiles-layer',
          type: 'raster' as const,
          source: 'osm-tiles',
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
  },
};

export const STATUS_STYLE_CONFIG: Record<EvaluationStatus | 'SPONSORED', MarkerStyleTokens> = {
  IDEAL: {
    badgeClass: 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-white',
    dotClass: 'bg-emerald-400',
    ringClass: 'ring-emerald-500',
  },
  WARNING: {
    badgeClass: 'bg-amber-500 text-white shadow-md shadow-amber-500/30 ring-2 ring-white',
    dotClass: 'bg-amber-300',
    ringClass: 'ring-amber-400',
  },
  DISCOURAGED: {
    badgeClass: 'bg-slate-400 text-slate-100 opacity-75 ring-1 ring-white/60',
    dotClass: 'bg-slate-300',
    ringClass: 'ring-slate-400',
  },
  SPONSORED: {
    badgeClass: 'bg-gradient-to-tr from-amber-500 to-yellow-400 text-amber-950 font-bold ring-2 ring-yellow-200 shadow-lg shadow-amber-400/40',
    dotClass: 'bg-amber-200',
    ringClass: 'ring-yellow-400',
  },
};
