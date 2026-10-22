import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { DesktopSplitExplorer } from '../src/components/explorer/DesktopSplitExplorer';
import type { Place } from '../src/lib/types/context';

describe('DesktopSplitExplorer Detail View Integration', () => {
  const mockPlace: Place = {
    id: 'berder-1',
    slug: 'ile-de-berder',
    name: 'Île de Berder',
    shortDescription: 'Passage submersible et tour de l ile.',
    category: 'TIDAL_PASSAGE',
    commune: 'Larmor-Baden',
    communeSlug: 'larmor-baden',
    sector: 'ARRADON',
    latitude: 47.579,
    longitude: -2.888,
    parkingLat: 47.58,
    parkingLng: -2.89,
    contextualRules: {
      tideConstraint: 'LOW_TIDE_ONLY',
      dogsAllowedSummer: true,
      strollerFriendly: false,
      rainFriendly: false,
    },
    practicalInfo: {
      recommendedDurationMinutes: 90,
      pricing: 'Gratuit',
      amenities: ['parking'],
      insiderTip: 'Attention au courant très puissant.',
    },
    isSponsored: false,
  };

  it('renders places list by default when selectedPlace is omitted or null', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        NuqsTestingAdapter,
        {
          children: React.createElement(DesktopSplitExplorer, {
            places: [
              {
                id: 'berder-1',
                slug: 'ile-de-berder',
                name: 'Île de Berder',
                latitude: 47.579,
                longitude: -2.888,
                category: 'TIDAL_PASSAGE',
                status: 'IDEAL',
              },
            ],
          }),
        }
      )
    );
    assert.ok(html.includes('Explorateur du Golfe'));
    assert.ok(html.includes('1 lieu trouvé'));
    assert.ok(!html.includes('← Retour aux spots'));
  });

  it('renders PlaceDetailView and back button when selectedPlace is provided', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        NuqsTestingAdapter,
        {
          children: React.createElement(DesktopSplitExplorer, {
            places: [],
            selectedPlace: mockPlace,
            onClosePlace: () => {},
          }),
        }
      )
    );
    assert.ok(html.includes('Retour aux spots'), 'Must render back button');
    assert.ok(html.includes('Île de Berder'), 'Must render place name in detail view');
    assert.ok(html.includes('Attention au courant très puissant'), 'Must render insider tip');
    assert.ok(html.includes('Larmor-Baden'), 'Must render commune');
  });
});

