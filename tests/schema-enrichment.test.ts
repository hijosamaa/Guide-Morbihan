import { describe, it } from 'node:test';
import assert from 'node:assert';
import { places, type Place, type NewPlace } from '../src/db/schema';
import type { PhotoItem, PracticalInfo, TideDetails, PlaceSourceType } from '../src/lib/types/context';

describe('Schema Enrichment for Rich Place Details', () => {
  it('defines photoGallery, practicalInfo, tideDetails, and sourceType columns', () => {
    assert.ok(places.photoGallery, 'photoGallery column should exist');
    assert.ok(places.practicalInfo, 'practicalInfo column should exist');
    assert.ok(places.tideDetails, 'tideDetails column should exist');
    assert.ok(places.sourceType, 'sourceType column should exist');

    assert.strictEqual(places.photoGallery.name, 'photo_gallery');
    assert.strictEqual(places.practicalInfo.name, 'practical_info');
    assert.strictEqual(places.tideDetails.name, 'tide_details');
    assert.strictEqual(places.sourceType.name, 'source_type');

    assert.deepStrictEqual(places.photoGallery.default, []);
    assert.strictEqual(places.sourceType.default, 'CURATED');

    assert.strictEqual(places.photoGallery.notNull, true);
    assert.strictEqual(places.sourceType.notNull, true);
    assert.strictEqual(places.practicalInfo.notNull, false);
    assert.strictEqual(places.tideDetails.notNull, false);
  });

  it('allows instantiating enriched domain types with strict typing', () => {
    const photo: PhotoItem = {
      url: 'https://images.unsplash.com/photo-example',
      caption: 'Vue splendide sur le Golfe',
      credit: 'Guide Morbihan',
      isCover: true,
    };

    const practical: PracticalInfo = {
      recommendedDurationMinutes: 60,
      pricing: 'Gratuit',
      amenities: ['toilets', 'parking', 'picnic_table'],
      insiderTip: 'Venir à marée descendante',
      goodToKnow: 'Zone protégée Natura 2000',
      bestSeason: ['SPRING', 'SUMMER'],
    };

    const tide: TideDetails = {
      highTideAdvantage: 'Baignade idéale',
      lowTideAdvantage: 'Pêche à pied et estran dégagé',
      warningNote: 'Attention aux courants vifs',
    };

    const source: PlaceSourceType = 'DATATOURISME';

    assert.strictEqual(photo.isCover, true);
    assert.strictEqual(practical.recommendedDurationMinutes, 60);
    assert.strictEqual(tide.highTideAdvantage, 'Baignade idéale');
    assert.strictEqual(source, 'DATATOURISME');
  });
});
