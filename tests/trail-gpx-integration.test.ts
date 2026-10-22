import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { parseGpxTrack } from '../src/lib/gpx-parser';
import RandoPage, { generateStaticParams, generateMetadata } from '../src/app/rando/[slug]/page';

describe('GPX Tracks & Trail Integration', () => {
  it('parses berder.gpx into valid GeoJSON and elevation profile', () => {
    const xml = fs.readFileSync('public/tracks/berder.gpx', 'utf8');
    const result = parseGpxTrack(xml);
    assert.ok(result.distanceKm > 1.0 && result.distanceKm < 4.0, `Distance was ${result.distanceKm}`);
    assert.ok(result.elevationProfile.length > 5, 'Must have elevation profile points');
    assert.equal(result.track.geometry.type, 'LineString');
    assert.ok(result.elevationGainM >= 0, 'Elevation gain must be valid');
  });

  it('parses ile-aux-moines.gpx correctly', () => {
    const xml = fs.readFileSync('public/tracks/ile-aux-moines.gpx', 'utf8');
    const result = parseGpxTrack(xml);
    assert.ok(result.distanceKm > 10, `Distance was ${result.distanceKm}`);
    assert.equal(result.track.geometry.type, 'LineString');
  });

  it('parses conguel.gpx correctly', () => {
    const xml = fs.readFileSync('public/tracks/conguel.gpx', 'utf8');
    const result = parseGpxTrack(xml);
    assert.ok(result.distanceKm > 2.0, `Distance was ${result.distanceKm}`);
    assert.equal(result.track.geometry.type, 'LineString');
  });

  it('RandoPage generates static params and renders trail header', async () => {
    const params = await generateStaticParams();
    assert.ok(params.length >= 3);
    assert.ok(params.some((p) => p.slug === 'ile-de-berder'));

    const meta = await generateMetadata({ params: Promise.resolve({ slug: 'ile-de-berder' }) });
    assert.ok(meta.title?.toString().includes('Navigation GPS'));

    const page = await RandoPage({ params: Promise.resolve({ slug: 'ile-de-berder' }) });
    const html = renderToString(page);
    assert.ok(html.includes('Île de Berder'));
    assert.ok(html.includes('Fiche lieu'));
  });
});

