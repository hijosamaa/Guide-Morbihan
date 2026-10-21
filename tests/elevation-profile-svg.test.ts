import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { ElevationProfileSvg } from '../src/components/map/ElevationProfileSvg';
import type { ElevationPoint } from '../src/lib/types/map';

const sampleProfile: ElevationPoint[] = [
  { distanceKm: 0.0, elevationM: 5, lat: 47.58, lon: -2.78 },
  { distanceKm: 2.5, elevationM: 28, lat: 47.59, lon: -2.79 },
  { distanceKm: 5.0, elevationM: 12, lat: 47.60, lon: -2.80 },
];

test('ElevationProfileSvg renders valid SVG structure and header stats', () => {
  const html = renderToString(
    React.createElement(ElevationProfileSvg, {
      points: sampleProfile,
      totalDistanceKm: 5.0,
      elevationGainM: 35,
      showStats: true,
    })
  );

  // SVG structure
  assert.ok(html.includes('<svg'));
  assert.ok(html.includes('viewBox="0 0 800 160"'));
  assert.ok(html.includes('linearGradient'));
  assert.ok(html.includes('id="elevation-gradient"'));

  // Header metrics
  assert.ok(html.includes('5 km') || html.includes('5.0 km'));
  assert.ok(html.includes('+35 m') || html.includes('35 m'));
  assert.ok(html.includes('Alt. max'));
  assert.ok(html.includes('28 m')); // max elevation
  assert.ok(html.includes('Temps estimé'));
});

test('ElevationProfileSvg handles empty profile gracefully', () => {
  const html = renderToString(
    React.createElement(ElevationProfileSvg, {
      points: [],
      totalDistanceKm: 0,
      elevationGainM: 0,
    })
  );

  assert.ok(html.includes('<svg'));
});

test('ElevationProfileSvg respects showStats false', () => {
  const html = renderToString(
    React.createElement(ElevationProfileSvg, {
      points: sampleProfile,
      totalDistanceKm: 5.0,
      elevationGainM: 35,
      showStats: false,
    })
  );

  assert.ok(html.includes('<svg'));
  assert.strictEqual(html.includes('Temps estimé'), false);
  assert.strictEqual(html.includes('Dénivelé D+'), false);
});

test('ElevationProfileSvg renders custom className and accessibility attributes', () => {
  const html = renderToString(
    React.createElement(ElevationProfileSvg, {
      points: sampleProfile,
      totalDistanceKm: 5.0,
      elevationGainM: 35,
      className: 'custom-elevation-class',
    })
  );

  assert.ok(html.includes('custom-elevation-class'));
  assert.ok(html.includes('role="region"'));
  assert.ok(html.includes('aria-label="Profil altimétrique"'));
  assert.ok(html.includes('role="img"'));
  assert.ok(html.includes('stroke="#0284c7"'));
});

test('ElevationProfileSvg handles flat elevation routes cleanly', () => {
  const flatProfile: ElevationPoint[] = [
    { distanceKm: 0.0, elevationM: 10, lat: 47.58, lon: -2.78 },
    { distanceKm: 3.0, elevationM: 10, lat: 47.59, lon: -2.79 },
  ];

  const html = renderToString(
    React.createElement(ElevationProfileSvg, {
      points: flatProfile,
      totalDistanceKm: 3.0,
      elevationGainM: 0,
      showStats: true,
    })
  );

  assert.ok(html.includes('10 m'));
  assert.ok(html.includes('+0 m'));
  assert.ok(html.includes('<path'));
});

