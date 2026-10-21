import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { MapSkeleton } from '../src/components/map/MapSkeleton';
import { DynamicGolfeMap, DynamicGpxTrackViewer } from '../src/components/map/DynamicMapWrappers';
import * as MapExports from '../src/components/map/index';

test('MapSkeleton renders server-side without window dependency', () => {
  const html = renderToString(
    React.createElement(MapSkeleton, {
      message: 'Chargement du Golfe...',
      height: 'h-64',
    })
  );

  assert.ok(html.includes('Chargement du Golfe...'));
  assert.ok(html.includes('animate-pulse'));
  assert.ok(html.includes('bg-slate-100'));
  assert.ok(html.includes('h-64'));
  assert.ok(html.includes('role="status"'));
});

test('MapSkeleton uses sensible defaults for message and height', () => {
  const html = renderToString(React.createElement(MapSkeleton));

  assert.ok(html.includes('Chargement de la carte interactive...'));
  assert.ok(html.includes('min-h-[350px]'));
});

test('Dynamic wrappers are properly defined components', () => {
  assert.equal(typeof DynamicGolfeMap, 'function');
  assert.equal(typeof DynamicGpxTrackViewer, 'function');
});

test('Map index barrel exports all essential map components', () => {
  assert.ok(typeof MapExports.GolfeMap === 'function');
  assert.ok(typeof MapExports.GpxTrackViewer === 'function');
  assert.ok(typeof MapExports.ElevationProfileSvg === 'function');
  assert.ok(typeof MapExports.MapControls === 'function');
  assert.ok(typeof MapExports.MapSkeleton === 'function');
  assert.ok(typeof MapExports.createPlaceMarkerElement === 'function');
  assert.ok(typeof MapExports.createMarkerDescriptor === 'function');
  assert.ok(typeof MapExports.DynamicGolfeMap === 'function');
  assert.ok(typeof MapExports.DynamicGpxTrackViewer === 'function');
});
