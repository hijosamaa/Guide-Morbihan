import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { GolfeMap } from '../src/components/map/GolfeMap';
import { GpxTrackViewer } from '../src/components/map/GpxTrackViewer';
import type { PlaceMarkerData, ElevationPoint } from '../src/lib/types/map';

const samplePlaces: PlaceMarkerData[] = [
  {
    id: 'place-1',
    slug: 'port-navalo',
    name: 'Port Navalo',
    latitude: 47.55,
    longitude: -2.91,
    category: 'PORT',
    status: 'IDEAL',
  },
];

const sampleGeojson: GeoJSON.Feature<GeoJSON.LineString> = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'LineString',
    coordinates: [
      [-2.78, 47.58],
      [-2.79, 47.59],
    ],
  },
};

const sampleProfile: ElevationPoint[] = [
  { distanceKm: 0.0, elevationM: 5, lat: 47.58, lon: -2.78 },
  { distanceKm: 1.5, elevationM: 15, lat: 47.59, lon: -2.79 },
];

test('GolfeMap renders container div with appropriate aria role and class', () => {
  const html = renderToString(
    React.createElement(GolfeMap, {
      places: samplePlaces,
      className: 'h-96 w-full',
    })
  );

  assert.ok(html.includes('<div'));
  assert.ok(html.includes('role="region"'));
  assert.ok(html.includes('aria-label="Carte interactive'));
});

test('GpxTrackViewer renders map container and elevation profile section', () => {
  const html = renderToString(
    React.createElement(GpxTrackViewer, {
      geojson: sampleGeojson,
      elevationProfile: sampleProfile,
      totalDistanceKm: 1.5,
      elevationGainM: 10,
    })
  );

  assert.ok(html.includes('<div'));
  assert.ok(html.includes('<svg'));
  assert.ok(html.includes('1.5 km'));
});

test('GolfeMap renders without controls when showControls is false', () => {
  const html = renderToString(
    React.createElement(GolfeMap, {
      places: [],
      showControls: false,
    })
  );

  assert.ok(html.includes('role="region"'));
  assert.ok(!html.includes('role="toolbar"'));
});

test('GolfeMap renders controls with locate button disabled or omitted when enableUserLocation is false', () => {
  const html = renderToString(
    React.createElement(GolfeMap, {
      places: samplePlaces,
      showControls: true,
      enableUserLocation: false,
    })
  );

  assert.ok(html.includes('role="toolbar"'));
  assert.ok(!html.includes('aria-label="Autour de moi"'));
});

test('GpxTrackViewer renders title and supports hiding stats', () => {
  const html = renderToString(
    React.createElement(GpxTrackViewer, {
      geojson: sampleGeojson,
      elevationProfile: sampleProfile,
      totalDistanceKm: 1.5,
      elevationGainM: 10,
      title: 'Sentier côtier de l’Île-aux-Moines',
      showStats: false,
    })
  );

  assert.ok(html.includes('Sentier côtier de l’Île-aux-Moines'));
  assert.ok(!html.includes('D+ 10 m'));
});

test('GpxTrackViewer handles empty coordinates gracefully without crashing', () => {
  const emptyGeojson: GeoJSON.Feature<GeoJSON.LineString> = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: [],
    },
  };

  const html = renderToString(
    React.createElement(GpxTrackViewer, {
      geojson: emptyGeojson,
      elevationProfile: [],
      totalDistanceKm: 0,
      elevationGainM: 0,
    })
  );

  assert.ok(html.includes('<div'));
  assert.ok(html.includes('<svg'));
});
