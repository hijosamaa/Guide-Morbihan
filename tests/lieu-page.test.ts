import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LieuPage, { generateMetadata, generateStaticParams } from '../src/app/lieu/[slug]/page';

describe('Standalone /lieu/[slug] Page', () => {
  it('renders PlaceDetailView with Schema.org JSON-LD tag', async () => {
    const pageJsx = await LieuPage({ params: Promise.resolve({ slug: 'ile-de-berder' }) });
    const html = renderToStaticMarkup(pageJsx);

    assert.ok(html.includes('Île de Berder'), 'Must render spot name');
    assert.ok(html.includes('application/ld+json'), 'Must include JSON-LD script tag');
    assert.ok(html.includes('TouristAttraction'), 'JSON-LD must specify TouristAttraction');
    assert.ok(html.includes('GeoCoordinates'), 'JSON-LD must include GeoCoordinates');
    assert.ok(html.includes('PostalAddress'), 'JSON-LD must include PostalAddress');
  });

  it('renders navigation bar with links back to /carte?spot=${slug}', async () => {
    const pageJsx = await LieuPage({ params: Promise.resolve({ slug: 'ile-de-berder' }) });
    const html = renderToStaticMarkup(pageJsx);

    assert.ok(html.includes('/carte?spot=ile-de-berder'), 'Must link back to carte with spot param');
    assert.ok(html.includes('Voir sur la carte'), 'Must have back link text');
    assert.ok(html.includes('Ouvrir la Carte'), 'Must have CTA button');
  });

  it('generates rich metadata with OpenGraph tags for a spot', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ slug: 'ile-de-berder' }) });

    assert.ok(meta.title?.toString().includes('Île de Berder'), 'Metadata title must include spot name');
    assert.ok(meta.description, 'Metadata description must be present');
    assert.ok(meta.openGraph?.title?.toString().includes('Île de Berder'), 'OG title must include spot name');
  });

  it('generates fallback metadata when spot does not exist', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ slug: 'spot-inexistant' }) });

    assert.strictEqual(meta.title, 'Lieu non trouvé | Guide Morbihan');
  });

  it('generateStaticParams returns all curated spots slugs', async () => {
    const staticParams = await generateStaticParams();

    assert.ok(Array.isArray(staticParams), 'Must return an array');
    assert.ok(staticParams.length > 0, 'Must contain spots');
    assert.ok(staticParams.some((p) => p.slug === 'ile-de-berder'), 'Must contain ile-de-berder');
    assert.ok(staticParams.some((p) => p.slug === 'chateau-de-suscinio'), 'Must contain chateau-de-suscinio');
  });

  it('invokes notFound() when spot is invalid', async () => {
    await assert.rejects(
      async () => {
        await LieuPage({ params: Promise.resolve({ slug: 'spot-fantome' }) });
      },
      (err: any) => {
        return err?.digest?.includes('404') || err?.message?.includes('NEXT_HTTP_ERROR_FALLBACK') || err?.message?.includes('NEXT_NOT_FOUND');
      },
      'Should throw notFound() error for invalid slug'
    );
  });
});
