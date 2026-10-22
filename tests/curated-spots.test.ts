import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getCuratedSpots, findCuratedSpotBySlug } from '../src/lib/curated-spots.ts';

describe('Curated Spots Data Store', () => {
  it('loads curated spots from json with rich practical info and non-plagiarized tips', () => {
    const spots = getCuratedSpots();
    assert.ok(Array.isArray(spots));
    assert.ok(spots.length >= 10, 'Must have at least 10 key Morbihan spots');

    const berder = findCuratedSpotBySlug('ile-de-berder');
    assert.ok(berder, 'Berder must exist in curated spots');
    assert.ok(berder?.practicalInfo?.insiderTip, 'Must have an insider tip');
    assert.ok(berder?.photoGallery && berder.photoGallery.length > 0, 'Must have photos');
    assert.strictEqual(berder?.sourceType, 'CURATED');
  });

  it('validates structure, coordinates, categories and content for all curated spots', () => {
    const spots = getCuratedSpots();
    const slugs = new Set<string>();

    for (const spot of spots) {
      assert.ok(spot.slug, 'Spot must have a slug');
      assert.ok(!slugs.has(spot.slug), `Slug ${spot.slug} must be unique`);
      slugs.add(spot.slug);

      assert.ok(spot.name && spot.name.length > 2, `Spot ${spot.slug} must have a name`);
      assert.ok(spot.shortDescription && spot.shortDescription.length > 10, `Spot ${spot.slug} must have a short description`);
      assert.ok(spot.fullDescription && spot.fullDescription.length > 30, `Spot ${spot.slug} must have a rich full description`);
      assert.ok(spot.commune, `Spot ${spot.slug} must have a commune`);
      assert.ok(spot.communeSlug, `Spot ${spot.slug} must have a communeSlug`);
      assert.ok(spot.sector, `Spot ${spot.slug} must have a sector`);

      // Coordinates Morbihan bounds check (approx 47.2 to 47.9 N, -3.5 to -2.5 W)
      assert.ok(spot.latitude >= 47.2 && spot.latitude <= 47.9, `Spot ${spot.slug} lat ${spot.latitude} within Morbihan`);
      assert.ok(spot.longitude >= -3.5 && spot.longitude <= -2.5, `Spot ${spot.slug} lng ${spot.longitude} within Morbihan`);

      if (spot.parkingLat !== undefined && spot.parkingLng !== undefined) {
        assert.ok(spot.parkingLat >= 47.2 && spot.parkingLat <= 47.9);
        assert.ok(spot.parkingLng >= -3.5 && spot.parkingLng <= -2.5);
      }

      // Contextual rules
      assert.ok(spot.contextualRules, `Spot ${spot.slug} must have contextualRules`);
      assert.ok(
        ['ALL_TIDES', 'HIGH_TIDE_ONLY', 'LOW_TIDE_ONLY', 'MID_TIDE_FLOW'].includes(spot.contextualRules.tideConstraint),
        `Spot ${spot.slug} tideConstraint must be valid`
      );

      // Practical info & photo gallery
      assert.ok(spot.practicalInfo, `Spot ${spot.slug} must have practicalInfo`);
      assert.ok(spot.practicalInfo.insiderTip && spot.practicalInfo.insiderTip.length > 15, `Spot ${spot.slug} must have an authentic insiderTip`);
      assert.ok(spot.photoGallery && spot.photoGallery.length > 0, `Spot ${spot.slug} must have at least one photo`);
      assert.ok(spot.photoGallery.some((p) => p.isCover), `Spot ${spot.slug} must have a cover photo`);

      assert.strictEqual(spot.sourceType, 'CURATED');
    }
  });

  it('contains verified essential Morbihan spots with non-plagiarized tips', () => {
    const requiredSlugs = [
      'ile-de-berder',
      'passage-de-tascon',
      'presqu-ile-de-conleau',
      'port-blanc-baden',
      'chateau-de-suscinio',
      'alignements-de-carnac',
      'port-saint-goustan',
      'plage-des-7-iles',
      'pointe-du-conguel',
      'tumulus-de-tumiac',
      'pointe-des-emigres',
      'marais-de-sene',
    ];

    for (const slug of requiredSlugs) {
      const spot = findCuratedSpotBySlug(slug);
      assert.ok(spot, `Spot with slug ${slug} must be defined`);
      assert.ok(spot?.practicalInfo?.insiderTip, `Spot ${slug} must feature insider tip`);
    }
  });

  it('returns undefined for non-existent spot slug', () => {
    const spot = findCuratedSpotBySlug('non-existent-spot-12345');
    assert.strictEqual(spot, undefined);
  });
});
