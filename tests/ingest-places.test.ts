import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolveTideHarborByCoords, estimateBeachWindShelter } from '../src/lib/ingest/spatial-heuristics';
import {
  isAcceptedDatatourismeCategory,
  cleanPlaceDescription,
  filterDatatourismeRecord,
  mapDatatourismeToPlace,
  slugify,
} from '../src/lib/ingest/datatourisme-connector';

describe('DATAtourisme Ingestion & Spatial Heuristics', () => {
  it('assigns Vannes harbor to inner gulf and Port-Navalo to ocean entrance', () => {
    assert.strictEqual(resolveTideHarborByCoords(47.63, -2.77), 'VANNES');
    assert.strictEqual(resolveTideHarborByCoords(47.54, -2.91), 'PORT_NAVALO');
  });

  it('rejects lodging, hotels, campings and accepts natural and cultural spots', () => {
    assert.strictEqual(isAcceptedDatatourismeCategory(['Camping', 'Accommodation']), false);
    assert.strictEqual(isAcceptedDatatourismeCategory(['HotelTrade', 'CommercialAccommodation']), false);
    assert.strictEqual(isAcceptedDatatourismeCategory(['NaturalHeritage', 'Beach']), true);
    assert.strictEqual(isAcceptedDatatourismeCategory(['CulturalHeritage', 'Dolmen']), true);
  });

  it('cleanses and formats raw descriptions gracefully', () => {
    const cleaned = cleanPlaceDescription('  <p>Superbe crique rocheuse &amp; abritée.</p>  ');
    assert.strictEqual(cleaned, 'Superbe crique rocheuse & abritée.');
  });

  it('estimates beach wind shelter according to cardinal opening', () => {
    assert.deepStrictEqual(estimateBeachWindShelter('S'), ['N', 'NE', 'NW']);
    assert.deepStrictEqual(estimateBeachWindShelter('SW'), ['N', 'NE', 'E']);
    assert.deepStrictEqual(estimateBeachWindShelter('SE'), ['N', 'NW', 'W']);
    assert.deepStrictEqual(estimateBeachWindShelter('N'), ['S', 'SE', 'SW']);
    assert.deepStrictEqual(estimateBeachWindShelter('W'), ['E', 'NE', 'SE']);
    assert.deepStrictEqual(estimateBeachWindShelter('E'), ['W', 'SW', 'NW']);
    assert.deepStrictEqual(estimateBeachWindShelter('NE'), ['S', 'SW', 'W']);
    assert.deepStrictEqual(estimateBeachWindShelter('NW'), ['S', 'SE', 'E']);
  });

  it('filters raw DATAtourisme records correctly', () => {
    const hotelRecord = {
      '@id': 'https://data.datatourisme.fr/1/hotel-1',
      '@type': ['HotelTrade', 'CommercialAccommodation'],
      'rdfs:label': { fr: ['Hôtel du Golfe'] },
    };
    assert.strictEqual(filterDatatourismeRecord(hotelRecord), false);

    const campingRecord = {
      id: 'camp-1',
      type: ['Camping'],
      name: 'Camping de la Plage',
    };
    assert.strictEqual(filterDatatourismeRecord(campingRecord), false);

    const beachRecord = {
      '@id': 'https://data.datatourisme.fr/2/beach-1',
      '@type': ['https://www.datatourisme.fr/ontology/core#NaturalHeritage', 'Beach'],
      'rdfs:label': { fr: ['Plage du Drehen'] },
    };
    assert.strictEqual(filterDatatourismeRecord(beachRecord), true);

    const megalithRecord = {
      id: 'mega-1',
      type: ['CulturalHeritage', 'Dolmen'],
      name: 'Table des Marchand',
    };
    assert.strictEqual(filterDatatourismeRecord(megalithRecord), true);

    assert.strictEqual(filterDatatourismeRecord(null), false);
    assert.strictEqual(filterDatatourismeRecord(undefined), false);
    assert.strictEqual(filterDatatourismeRecord({}), false);
  });

  it('maps accepted DATAtourisme records to partial place structure', () => {
    const rawBeach = {
      '@id': 'https://data.datatourisme.fr/3/plage-conleau',
      '@type': ['NaturalHeritage', 'Beach'],
      'rdfs:label': { fr: ['Plage de Conleau'] },
      hasDescription: [
        {
          shortDescription: { fr: ['<p>Piscine d\'eau de mer &amp; plage familiale abritée.</p>'] },
        },
      ],
      isLocatedAt: [
        {
          'schema:geo': {
            'schema:latitude': 47.6312,
            'schema:longitude': -2.7745,
          },
          'schema:address': [
            {
              'schema:addressLocality': 'Vannes',
            },
          ],
        },
      ],
    };

    const place = mapDatatourismeToPlace(rawBeach);
    assert.ok(place);
    assert.strictEqual(place.name, 'Plage de Conleau');
    assert.strictEqual(place.category, 'BEACH');
    assert.strictEqual(place.commune, 'Vannes');
    assert.strictEqual(place.communeSlug, 'vannes');
    assert.strictEqual(place.latitude, 47.6312);
    assert.strictEqual(place.longitude, -2.7745);
    assert.strictEqual(place.sourceType, 'DATATOURISME');
    assert.strictEqual(place.shortDescription, "Piscine d'eau de mer & plage familiale abritée.");
    assert.strictEqual(place.contextualRules.tideConstraint, 'HIGH_TIDE_ONLY');
    assert.strictEqual(place.contextualRules.rainFriendly, false);
  });

  it('returns null when mapping a rejected or incomplete record', () => {
    const hotel = {
      '@type': ['HotelTrade'],
      label: 'Hôtel',
      latitude: 47.6,
      longitude: -2.7,
    };
    assert.strictEqual(mapDatatourismeToPlace(hotel), null);

    const missingCoords = {
      '@type': ['NaturalHeritage', 'Beach'],
      label: 'Plage Inconnue',
    };
    assert.strictEqual(mapDatatourismeToPlace(missingCoords), null);
  });

  it('slugify converts French characters properly', () => {
    assert.strictEqual(slugify('Île aux Moines'), 'ile-aux-moines');
    assert.strictEqual(slugify('Pointe de Kerpenhir (Locmariaquer)'), 'pointe-de-kerpenhir-locmariaquer');
    assert.strictEqual(slugify('Plage du Drehen - Île-d\'Arz'), 'plage-du-drehen-ile-d-arz');
  });
});
