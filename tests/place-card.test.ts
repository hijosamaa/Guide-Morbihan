import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ContextBadge } from '../src/components/places/ContextBadge';
import { PlaceCard } from '../src/components/places/PlaceCard';
import { PlaceCardSkeleton } from '../src/components/places/PlaceCardSkeleton';
import type { PlaceMarkerData } from '../src/lib/types/map';

const samplePlace: PlaceMarkerData = {
  id: 'spot-1',
  slug: 'anse-de-toulindac',
  name: 'Anse de Toulindac',
  latitude: 47.61,
  longitude: -2.87,
  category: 'BEACH',
  status: 'IDEAL',
  score: 92,
  label: 'Baignade idéale',
};

test('ContextBadge renders accessible text and classes for IDEAL status', () => {
  const html = renderToString(React.createElement(ContextBadge, { status: 'IDEAL' }));
  assert.ok(html.includes('Idéal'));
  assert.ok(html.includes('bg-emerald-50') || html.includes('emerald'));
});

test('ContextBadge renders accessible text for WARNING status', () => {
  const html = renderToString(React.createElement(ContextBadge, { status: 'WARNING' }));
  assert.ok(html.includes('Vigilance'));
  assert.ok(html.includes('amber'));
});

test('ContextBadge renders accessible text for DISCOURAGED and SPONSORED statuses', () => {
  const discouragedHtml = renderToString(React.createElement(ContextBadge, { status: 'DISCOURAGED' }));
  assert.ok(discouragedHtml.includes('Déconseillé'));
  assert.ok(discouragedHtml.includes('slate'));

  const sponsoredHtml = renderToString(React.createElement(ContextBadge, { status: 'SPONSORED' }));
  assert.ok(sponsoredHtml.includes('Coup de cœur'));
  assert.ok(sponsoredHtml.includes('yellow'));
});

test('ContextBadge supports customLabel override', () => {
  const html = renderToString(
    React.createElement(ContextBadge, { status: 'IDEAL', customLabel: 'Spot exceptionnel' })
  );
  assert.ok(html.includes('Spot exceptionnel'));
});

test('PlaceCard renders compact variant with name and category', () => {
  const html = renderToString(
    React.createElement(PlaceCard, {
      place: samplePlace,
      variant: 'compact',
    })
  );
  assert.ok(html.includes('Anse de Toulindac'));
  assert.ok(html.includes('spot-card-spot-1'));
  assert.ok(html.includes('Plage &amp; Crique') || html.includes('Plage & Crique'));
  assert.ok(html.includes('role="button"'));
  assert.ok(html.includes('tabindex="0"'));
  assert.ok(html.includes('aria-pressed="false"'));

  const selectedHtml = renderToString(
    React.createElement(PlaceCard, {
      place: samplePlace,
      variant: 'compact',
      isSelected: true,
    })
  );
  assert.ok(selectedHtml.includes('aria-pressed="true"'));
});

test('PlaceCard renders rich variant with image placeholder and details', () => {
  const html = renderToString(
    React.createElement(PlaceCard, {
      place: samplePlace,
      variant: 'rich',
      isSelected: true,
    })
  );
  assert.ok(html.includes('Anse de Toulindac'));
  assert.ok(html.includes('spot-card-spot-1'));
  assert.ok(html.includes('Golfe du Morbihan'));
  assert.ok(html.includes('ring-2 ring-emerald-500'));
  assert.ok(html.includes('aria-pressed="true"'));
});

test('PlaceCard renders image when imageUrl is provided', () => {
  const placeWithImage: PlaceMarkerData = {
    ...samplePlace,
    imageUrl: 'https://images.unsplash.com/photo-example.jpg',
  };

  const compactHtml = renderToString(
    React.createElement(PlaceCard, {
      place: placeWithImage,
      variant: 'compact',
    })
  );
  assert.ok(compactHtml.includes('https://images.unsplash.com/photo-example.jpg'));

  const richHtml = renderToString(
    React.createElement(PlaceCard, {
      place: placeWithImage,
      variant: 'rich',
    })
  );
  assert.ok(richHtml.includes('https://images.unsplash.com/photo-example.jpg'));
});

test('PlaceCard renders accessible Next.js Link when href is provided', () => {
  const linkRichHtml = renderToString(
    React.createElement(PlaceCard, {
      place: samplePlace,
      variant: 'rich',
      href: '/carte?spot=spot-1',
    })
  );
  assert.ok(linkRichHtml.includes('href="/carte?spot=spot-1"'));
  assert.ok(linkRichHtml.includes('<a'));
  assert.ok(!linkRichHtml.includes('role="button"'), 'Links should not have role=button');

  const linkCompactHtml = renderToString(
    React.createElement(PlaceCard, {
      place: samplePlace,
      variant: 'compact',
      href: '/carte?spot=spot-1',
    })
  );
  assert.ok(linkCompactHtml.includes('href="/carte?spot=spot-1"'));
  assert.ok(linkCompactHtml.includes('<a'));
});

test('PlaceCardSkeleton renders compact and rich skeletons', () => {
  const compactSkeleton = renderToString(React.createElement(PlaceCardSkeleton, { variant: 'compact' }));
  assert.ok(compactSkeleton.includes('animate-pulse'));
  assert.ok(compactSkeleton.includes('rounded-xl'));

  const richSkeleton = renderToString(React.createElement(PlaceCardSkeleton, { variant: 'rich' }));
  assert.ok(richSkeleton.includes('animate-pulse'));
  assert.ok(richSkeleton.includes('aspect-video bg-slate-200'));
  assert.ok(richSkeleton.includes('p-4 flex flex-col flex-1'));
  assert.ok(richSkeleton.includes('overflow-hidden'));
});
