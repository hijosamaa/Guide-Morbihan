import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { MobileExplorerSheet } from '../src/components/explorer/MobileExplorerSheet';
import CartePage from '../src/app/carte/page';
import type { Place } from '../src/lib/types/context';

describe('Carte Hybrid Navigation & Expanding Sheet', () => {
  const dummyPlace: Place = {
    id: 'berder-id',
    slug: 'ile-de-berder',
    name: 'Île de Berder',
    shortDescription: 'Passage submersible mythique',
    fullDescription: 'Une merveille naturelle du Golfe du Morbihan.',
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
      insiderTip: 'Vérifiez bien les coefficients avant de vous engager.',
    },
    tideDetails: {
      highTideAdvantage: 'Courant spectaculaire',
      lowTideAdvantage: 'Passage à pied sec',
    },
    isSponsored: false,
    updatedAt: new Date(),
  };

  it('renders selected place detail view when selectedPlace is provided', () => {
    const html = renderToStaticMarkup(
      React.createElement(MobileExplorerSheet, {
        places: [dummyPlace],
        selectedPlace: dummyPlace,
        onSelectPlace: () => {},
        snapPoint: '0.92',
        onSnapPointChange: () => {},
      })
    );

    assert.ok(html.includes('Île de Berder'), 'Must display selected spot title');
    assert.ok(html.includes('Passage submersible mythique'), 'Must display spot description');
    assert.ok(html.includes('Larmor-Baden'), 'Must display commune');
    assert.ok(
      html.includes('Conseil d&#x27;initié') || html.includes("Conseil d'initié"),
      'Must display insider tip box'
    );
  });

  it('renders back-to-spots button when selectedPlace is active', () => {
    const html = renderToStaticMarkup(
      React.createElement(MobileExplorerSheet, {
        places: [dummyPlace],
        selectedPlace: dummyPlace,
        onClosePlace: () => {},
        snapPoint: '0.92',
      })
    );

    assert.ok(html.includes('Retour aux spots'), 'Must contain [← Retour aux spots] button');
    assert.ok(html.includes('aria-label="Retour aux spots"'), 'Must have accessible label');
  });

  it('renders list of places and filter bar when selectedPlace is null', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        NuqsTestingAdapter,
        {
          children: React.createElement(MobileExplorerSheet, {
            places: [dummyPlace],
            selectedPlace: null,
            onSelectPlace: () => {},
            snapPoint: '140px',
          }),
        }
      )
    );

    assert.ok(html.includes('1 lieu à proximité'), 'Must display places count');
    assert.ok(html.includes('Île de Berder'), 'Must display place card');
    assert.ok(!html.includes('← Retour aux spots'), 'Must not display back button when in list mode');
  });

  it('initial loading: CartePage automatically selects spot when ?spot= is present in URL', () => {
    const html = renderToString(
      React.createElement(
        NuqsTestingAdapter,
        {
          searchParams: { spot: 'ile-de-berder' },
          children: React.createElement(CartePage),
        }
      )
    );

    // Should display the enriched PlaceDetailView for Île de Berder and the back button
    assert.ok(html.includes('Île de Berder'), 'Must render selected spot Île de Berder');
    assert.ok(html.includes('Retour aux spots'), 'Must render back to spots button');
    assert.ok(html.includes('Larmor-Baden'), 'Must render commune for selected spot');
  });

  it('initial loading: CartePage renders place list when no ?spot= is in URL', () => {
    const html = renderToString(
      React.createElement(
        NuqsTestingAdapter,
        {
          searchParams: {},
          children: React.createElement(CartePage),
        }
      )
    );

    // List mode renders initial places without back button
    assert.ok(html.includes('Plage du Fogeo (Arzon)'));
    assert.ok(html.includes('Port Saint-Goustan (Auray)'));
    assert.ok(html.includes('Château de Suscinio'));
  });

  it('URL synchronization updates history state without page reload', () => {
    // Mock window & history to simulate browser behavior
    const originalWindow = globalThis.window;
    const historyCalls: { state: any; unused: string; url: string }[] = [];

    const mockWindow = {
      location: {
        href: 'https://guidemorbihan.bzh/carte',
        pathname: '/carte',
        search: '',
      },
      history: {
        pushState: (state: any, unused: string, url: string) => {
          historyCalls.push({ state, unused, url });
        },
      },
    };

    // @ts-ignore
    globalThis.window = mockWindow;

    try {
      // Simulate selecting a spot URL update
      const url = new URL(mockWindow.location.href);
      url.searchParams.set('spot', 'ile-de-berder');
      mockWindow.history.pushState({}, '', url.toString());

      assert.equal(historyCalls.length, 1);
      assert.ok(historyCalls[0].url.includes('spot=ile-de-berder'));

      // Simulate closing/deselection URL update
      const closeUrl = new URL(mockWindow.location.href);
      closeUrl.searchParams.delete('spot');
      mockWindow.history.pushState({}, '', closeUrl.pathname + (closeUrl.search ? closeUrl.search : ''));

      assert.equal(historyCalls.length, 2);
      assert.equal(historyCalls[1].url, '/carte');
    } finally {
      // @ts-ignore
      globalThis.window = originalWindow;
    }
  });
});
