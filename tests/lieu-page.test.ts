import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import { renderToString } from 'react-dom/server';
import LieuPage, { generateMetadata, generateStaticParams } from '../src/app/lieu/[slug]/page';

describe('Standalone Place Page (/lieu/[slug])', () => {
  it('generateStaticParams returns an array of known spot slugs', async () => {
    const params = await generateStaticParams();
    assert.ok(Array.isArray(params));
    assert.ok(params.length >= 12);
    assert.ok(params.some((p) => p.slug === 'ile-de-berder'));
  });

  it('renders PlaceDetailView with Schema.org JSON-LD tag for valid slug', async () => {
    const pageComponent = await LieuPage({ params: Promise.resolve({ slug: 'ile-de-berder' }) });
    const html = renderToString(pageComponent);

    assert.ok(html.includes('Île de Berder'), 'Must render place title');
    assert.ok(html.includes('application/ld+json'), 'Must contain JSON-LD script tag');
    assert.ok(html.includes('TouristAttraction'), 'Must declare TouristAttraction schema');
    assert.ok(html.includes('Voir sur la carte'), 'Must contain back to map CTA');
  });

  it('generates rich metadata with OpenGraph image', async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: 'ile-de-berder' }) });
    assert.ok(metadata.title?.toString().includes('Île de Berder'));
    assert.ok(metadata.description);
    assert.ok(metadata.openGraph?.images);
  });
});
