import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ParkingDirectButton } from '../src/components/places/ParkingDirectButton';
import { PhotoGallery } from '../src/components/places/PhotoGallery';
import { PlaceDetailView } from '../src/components/places/PlaceDetailView';
import type { Place, ContextEvaluationResult } from '../src/lib/types/context';

describe('PlaceDetailView Subcomponents & Main View', () => {
  describe('ParkingDirectButton', () => {
    it('renders ParkingDirectButton with Waze and Google Maps links when coordinates exist', () => {
      const html = renderToStaticMarkup(
        React.createElement(ParkingDirectButton, {
          parkingLat: 47.5872,
          parkingLng: -2.8941,
          placeName: 'Île de Berder',
        })
      );
      assert.ok(html.includes('maps.google.com'), 'Must contain Google Maps URL');
      assert.ok(html.includes('waze.com') || html.includes('waze://'), 'Must contain Waze link');
      assert.ok(html.includes('Parking') || html.includes('Stationnement'), 'Must display Parking/Stationnement label');
      assert.ok(html.includes('47.5872'), 'Must include latitude in URL');
      assert.ok(html.includes('-2.8941'), 'Must include longitude in URL');
    });

    it('returns null when parking coordinates are missing or null', () => {
      const html = renderToStaticMarkup(
        React.createElement(ParkingDirectButton, {
          parkingLat: null,
          parkingLng: null,
          placeName: 'Spot sans parking',
        })
      );
      assert.strictEqual(html, '', 'Must render nothing when coordinates are null');
    });
  });

  describe('PhotoGallery', () => {
    it('renders PhotoGallery with fallback image if gallery is empty', () => {
      const html = renderToStaticMarkup(
        React.createElement(PhotoGallery, {
          photos: [],
          placeName: 'Spot de test',
        })
      );
      assert.ok(html.includes('<img'), 'Must render at least one fallback image tag');
      assert.ok(html.includes('alt="Spot de test"'), 'Must render spot name as alt text');
    });

    it('renders multiple photos with captions and credits when provided', () => {
      const photos = [
        {
          url: 'https://example.com/photo1.jpg',
          caption: 'Vue panoramique au couchant',
          credit: 'Jean Guide',
          isCover: true,
        },
        {
          url: 'https://example.com/photo2.jpg',
          caption: 'Crique abritée du vent',
          credit: 'Office de Tourisme',
          isCover: false,
        },
      ];
      const html = renderToStaticMarkup(
        React.createElement(PhotoGallery, {
          photos,
          placeName: 'Plage du Fogeo',
        })
      );
      assert.ok(html.includes('https://example.com/photo1.jpg'));
      assert.ok(html.includes('https://example.com/photo2.jpg'));
      assert.ok(html.includes('Vue panoramique au couchant'));
      assert.ok(html.includes('© Jean Guide'));
      assert.ok(html.includes('1 / 2'), 'Must show slide counter for multi-photo gallery');
    });

    it('does not display slide counter when only one photo exists', () => {
      const html = renderToStaticMarkup(
        React.createElement(PhotoGallery, {
          photos: [{ url: 'https://example.com/single.jpg' }],
          placeName: 'Spot unique',
        })
      );
      assert.ok(!html.includes('1 / 1'), 'Should not display slide counter for single photo');
    });
  });

  describe('PlaceDetailView', () => {
    const mockPlace: Place = {
      slug: 'ile-de-berder',
      name: 'Île de Berder',
      shortDescription: 'Joyau boisé accessible à pied uniquement à marée basse.',
      fullDescription: 'Située face au courant de la Jument, Berder offre une boucle piétonne magnifique.',
      category: 'TIDAL_PASSAGE',
      commune: 'Larmor-Baden',
      communeSlug: 'larmor-baden',
      sector: 'ARRADON',
      latitude: 47.5794,
      longitude: -2.8887,
      parkingLat: 47.5872,
      parkingLng: -2.8941,
      sourceType: 'CURATED',
      contextualRules: {
        tideConstraint: 'LOW_TIDE_ONLY',
        dogsAllowedSummer: true,
        strollerFriendly: false,
        rainFriendly: false,
        shelteredFromWindDirections: ['N', 'NE'],
      },
      practicalInfo: {
        recommendedDurationMinutes: 90,
        pricing: 'Gratuit',
        amenities: ['parking', 'toilets', 'picnic_table'],
        insiderTip: "Ne tentez jamais la traversée si l'eau commence à recouvrir les pavés.",
        goodToKnow: 'Stationnement obligatoire sur les parkings balisés en amont.',
      },
      tideDetails: {
        highTideAdvantage: 'Observation spectaculaire du courant.',
        lowTideAdvantage: 'Passage à pied au sec.',
        warningNote: 'Chaussée submersible coupée à marée haute.',
      },
      photoGallery: [
        {
          url: 'https://example.com/berder1.jpg',
          caption: 'Chaussée submersible pavée',
          credit: 'Morbihan Photo',
        },
      ],
    };

    const mockContext: ContextEvaluationResult = {
      placeSlug: 'ile-de-berder',
      badge: 'IDEAL',
      status: 'IDEAL',
      badgeLabel: 'Passage ouvert actuellement',
      score: 95,
      titleReason: 'Marée basse favorable',
      reasons: ['Chaussée praticable pour 2h'],
      isSheltered: true,
    };

    it('renders PlaceDetailView with complete content and accessibility structure', () => {
      let closed = false;
      const html = renderToStaticMarkup(
        React.createElement(PlaceDetailView, {
          place: mockPlace,
          context: mockContext,
          onClose: () => {
            closed = true;
          },
        })
      );

      // Spot Name & Commune
      assert.ok(html.includes('Île de Berder'), 'Must render place name');
      assert.ok(html.includes('Larmor-Baden'), 'Must render commune');

      // Category badge & Context badge
      assert.ok(html.includes('Passage ouvert actuellement'), 'Must render context badge label');

      // Descriptions
      assert.ok(html.includes('Située face au courant de la Jument'), 'Must render full description');

      // Practical Info
      assert.ok(html.includes('90 min') || html.includes('1h30') || html.includes('90'), 'Must render duration');
      assert.ok(html.includes('Gratuit'), 'Must render pricing');
      assert.ok(html.includes('Toilettes') || html.includes('toilets'), 'Must render amenities');

      // Insider Tip callout box
      assert.ok(html.includes("Ne tentez jamais la traversée si l&#x27;eau") || html.includes("Ne tentez jamais la traversée si l'eau"), 'Must render insider tip');
      assert.ok(html.includes("Conseil d&#x27;initié") || html.includes("Avis de la rédaction") || html.includes("Conseil d'initié"), 'Must render tip badge');

      // Tide Details
      assert.ok(html.includes('Observation spectaculaire du courant'), 'Must render tide details');

      // Parking Direct Button
      assert.ok(html.includes('maps.google.com'), 'Must embed parking button with Google Maps');
      assert.ok(html.includes('waze.com') || html.includes('waze://'), 'Must embed parking button with Waze');

      // Close button
      assert.ok(html.includes('aria-label="Fermer la fiche"') || html.includes('Fermer') || html.includes('Retour'), 'Must render accessible close button');
    });

    it('renders gracefully with minimal place data without crashing', () => {
      const minimalPlace: Place = {
        slug: 'point-de-vue-simple',
        name: 'Panorama Simple',
        category: 'VIEWPOINT',
        contextualRules: {
          tideConstraint: 'ALL_TIDES',
          dogsAllowedSummer: true,
          strollerFriendly: true,
          rainFriendly: true,
        },
      };

      const html = renderToStaticMarkup(
        React.createElement(PlaceDetailView, {
          place: minimalPlace,
        })
      );

      assert.ok(html.includes('Panorama Simple'), 'Must render spot name');
      assert.ok(!html.includes('maps.google.com'), 'Should not render parking button without coords');
    });

    it('falls back to coverImageUrl when photoGallery is absent or empty', () => {
      const placeWithCover: Place = {
        slug: 'spot-avec-cover',
        name: 'Spot avec Cover Uniquement',
        category: 'HERITAGE',
        coverImageUrl: 'https://images.example.com/cover-custom.jpg',
        contextualRules: {
          tideConstraint: 'ALL_TIDES',
          dogsAllowedSummer: true,
          strollerFriendly: true,
          rainFriendly: true,
        },
      };

      const html = renderToStaticMarkup(
        React.createElement(PlaceDetailView, {
          place: placeWithCover,
        })
      );

      assert.ok(
        html.includes('https://images.example.com/cover-custom.jpg'),
        'Must render coverImageUrl when photoGallery is missing'
      );
    });

    it('renders affiliate booking link when present', () => {
      const placeWithAffiliate: Place = {
        ...mockPlace,
        slug: 'croisiere-golfe',
        name: 'Croisière des Îles',
        affiliateBookingUrl: 'https://partner.example.com/book',
        affiliateLabel: 'Réserver la traversée',
      };

      const html = renderToStaticMarkup(
        React.createElement(PlaceDetailView, {
          place: placeWithAffiliate,
        })
      );

      assert.ok(html.includes('https://partner.example.com/book'), 'Must render affiliate booking link');
      assert.ok(html.includes('Réserver la traversée'), 'Must render affiliate label');
    });

    it('renders without close button when onClose is omitted', () => {
      const html = renderToStaticMarkup(
        React.createElement(PlaceDetailView, {
          place: mockPlace,
        })
      );
      assert.ok(!html.includes('aria-label="Fermer la fiche"'), 'Should not render close button when onClose omitted');
    });

    it('renders closed tidal passage alert when passageContext is not open', () => {
      const closedContext: ContextEvaluationResult = {
        placeSlug: 'ile-de-berder',
        badge: 'UNSUITABLE',
        status: 'DISCOURAGED',
        badgeLabel: 'Chaussée fermée',
        score: 10,
        titleReason: 'Submersion marée haute',
        reasons: ['Passage sous eau'],
        isSheltered: false,
        passageContext: {
          slug: 'berder',
          name: 'Île de Berder',
          isOpen: false,
          status: 'CLOSED',
          minutesRemaining: 0,
          source: 'OFFICIAL',
          window: {
            start: new Date(),
            end: new Date(),
          },
          hazardNotice: 'Courant dangereux de la Jument actif.',
        },
      };

      const html = renderToStaticMarkup(
        React.createElement(PlaceDetailView, {
          place: mockPlace,
          context: closedContext,
        })
      );

      assert.ok(html.includes('Passage actuellement submergé par la marée'));
      assert.ok(html.includes('Courant dangereux de la Jument actif'));
    });

    it('renders all amenities icons and format short duration correctly', () => {
      const placeWithAllAmenities: Place = {
        ...mockPlace,
        practicalInfo: {
          recommendedDurationMinutes: 45,
          amenities: ['toilets', 'water', 'parking', 'food', 'picnic_table', 'shade'],
          bestSeason: ['SUMMER', 'AUTUMN'],
        },
      };

      const html = renderToStaticMarkup(
        React.createElement(PlaceDetailView, {
          place: placeWithAllAmenities,
        })
      );

      assert.ok(html.includes('45 min'), 'Duration under 60 min formatted simply');
      assert.ok(html.includes('Toilettes publiques'));
      assert.ok(html.includes("Point d&#x27;eau potable") || html.includes("Point d'eau potable"));
      assert.ok(html.includes('Parking à proximité'));
      assert.ok(html.includes('Dégustation / Restauration'));
      assert.ok(html.includes('Table de pique-nique'));
      assert.ok(html.includes('Coins ombragés'));
      assert.ok(html.includes('Été, Automne'));
    });
  });
});
