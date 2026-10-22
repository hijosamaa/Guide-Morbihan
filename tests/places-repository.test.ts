import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getAllPlaces, getPlaceBySlug, getLocalFallbackPlaces } from '../src/lib/data/places';

describe('Places Data Repository & Fallback', () => {
  it('returns local fallback places when database is offline or unconfigured', () => {
    const places = getLocalFallbackPlaces();
    assert.ok(places.length >= 12, 'Must contain at least the 12 curated spots');
    const berder = places.find((p) => p.slug === 'ile-de-berder' || p.slug === 'passage-ile-de-berder');
    assert.ok(berder, 'Berder must be present in fallback dataset');
    assert.ok(berder.photoGallery && berder.photoGallery.length > 0, 'Must include photos');
    assert.ok(berder.practicalInfo?.insiderTip, 'Must include insider tip');
  });

  it('getAllPlaces returns evaluated PlaceMarkerData with real-time status and labels', async () => {
    const markers = await getAllPlaces();
    assert.ok(markers.length >= 12, 'Must return at least 12 markers');
    const berderMarker = markers.find((m) => m.slug === 'ile-de-berder' || m.slug === 'passage-ile-de-berder');
    assert.ok(berderMarker, 'Must return Berder marker');
    assert.ok(['IDEAL', 'WARNING', 'DISCOURAGED'].includes(berderMarker.status), 'Must calculate real-time evaluation status');
    assert.ok(typeof berderMarker.latitude === 'number', 'Latitude must be a valid number');
    assert.ok(typeof berderMarker.longitude === 'number', 'Longitude must be a valid number');
  });

  it('getPlaceBySlug retrieves enriched place by slug with alias resolution', async () => {
    const place = await getPlaceBySlug('ile-de-berder');
    assert.ok(place, 'Must find place by canonical slug');
    assert.equal(place.commune, 'Larmor-Baden');
    assert.ok(place.parkingLat != null, 'Must include parking coordinates');
  });

  it('getPlaceBySlug resolves historical alias passage-ile-de-berder', async () => {
    const place = await getPlaceBySlug('passage-ile-de-berder');
    assert.ok(place, 'Must resolve historical seed alias');
    assert.ok(place.name.includes('Berder'));
  });

  it('getPlaceBySlug returns null for unknown slug', async () => {
    const place = await getPlaceBySlug('inconnu-au-bataillon');
    assert.strictEqual(place, null);
  });
});
