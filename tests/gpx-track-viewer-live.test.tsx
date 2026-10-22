import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { GpxTrackViewer } from '../src/components/map/GpxTrackViewer';
import type { ElevationPoint } from '../src/lib/types/map';

const sampleGeojson: GeoJSON.Feature<GeoJSON.LineString> = {
  type: 'Feature',
  properties: { name: 'Boucle de Berder' },
  geometry: {
    type: 'LineString',
    coordinates: [
      [-2.88, 47.58],
      [-2.87, 47.59],
      [-2.86, 47.60],
    ],
  },
};

const sampleProfile: ElevationPoint[] = [
  { distanceKm: 0.0, elevationM: 5, lat: 47.58, lon: -2.88 },
  { distanceKm: 1.5, elevationM: 18, lat: 47.59, lon: -2.87 },
  { distanceKm: 3.0, elevationM: 8, lat: 47.60, lon: -2.86 },
];

test('GpxTrackViewer renders title, map container, and elevation profile', () => {
  const html = renderToString(
    React.createElement(GpxTrackViewer, {
      geojson: sampleGeojson,
      elevationProfile: sampleProfile,
      totalDistanceKm: 3.0,
      elevationGainM: 25,
      title: 'Circuit des Pointes de Baden',
    })
  );

  assert.ok(html.includes('Circuit des Pointes de Baden'));
  assert.ok(html.includes('role="region"'));
  assert.ok(html.includes('Profil altimétrique'));
});

test('GpxTrackViewer renders tidal submersion alert banner when tideAlert is provided', () => {
  const html = renderToString(
    React.createElement(GpxTrackViewer, {
      geojson: sampleGeojson,
      elevationProfile: sampleProfile,
      totalDistanceKm: 3.0,
      elevationGainM: 25,
      tideAlert: {
        status: 'WARNING_CLOSING',
        message: 'Attention : Passage de Berder praticable mais se referme à 16h20.',
      },
    })
  );

  assert.ok(html.includes('Passage de Berder praticable mais se referme'));
  assert.ok(html.includes('data-testid="tidal-submersion-banner"'));
});

test('GpxTrackViewer renders GPS live tracking button when enableLiveTracking is true', () => {
  const html = renderToString(
    React.createElement(GpxTrackViewer, {
      geojson: sampleGeojson,
      elevationProfile: sampleProfile,
      totalDistanceKm: 3.0,
      elevationGainM: 25,
      enableLiveTracking: true,
    })
  );

  assert.ok(html.includes('data-testid="live-gps-toggle"'));
  assert.ok(html.includes('Suivi GPS'));
});
