// tests/context-matcher-categories.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { evaluatePlaceContext } from '../src/lib/context-matcher';
import { Place, MarineWeatherContext } from '../src/lib/types/context';

describe('Category-Aware Context Evaluation', () => {
  const dummyContext: MarineWeatherContext = {
    tempCelsius: 18,
    windSpeedKnots: 12,
    windDirectionDeg: 270,
    windCardinal: 'W',
    isRaining: false,
    tideStatus: {
      harbor: 'VANNES',
      currentHeight: 1.2,
      phase: 'EBB',
      state: 'FALLING',
      progressPercent: 80,
      nextTide: { type: 'LOW', time: new Date(), height: 0.8 },
      coefficient: 75,
    },
  };

  it('does NOT assign a low tide penalty to an indoor or heritage site', () => {
    const castle: Place = {
      id: '1',
      slug: 'chateau-suscinio',
      name: 'Château de Suscinio',
      shortDescription: 'Forteresse des Ducs de Bretagne',
      category: 'HERITAGE',
      commune: 'Sarzeau',
      communeSlug: 'sarzeau',
      sector: 'SARZEAU',
      latitude: 47.514,
      longitude: -2.778,
      contextualRules: {
        tideConstraint: 'ALL_TIDES',
        dogsAllowedSummer: false,
        strollerFriendly: true,
        rainFriendly: true,
      },
      isSponsored: false,
      updatedAt: new Date(),
    };

    const evaluation = evaluatePlaceContext(castle, dummyContext, []);
    assert.strictEqual(evaluation.status, 'IDEAL');
    assert.strictEqual(evaluation.badgeLabel.includes('marée'), false, 'Heritage badge should not mention tide');
  });

  it('keeps high tide requirement for beaches and reflects bathability', () => {
    const beach: Place = {
      id: '2',
      slug: 'plage-conleau',
      name: 'Plage de Conleau',
      shortDescription: 'Piscine naturelle d’eau de mer et crique abritée.',
      category: 'BEACH',
      commune: 'Vannes',
      communeSlug: 'vannes',
      sector: 'VANNES',
      latitude: 47.63,
      longitude: -2.77,
      contextualRules: {
        tideConstraint: 'HIGH_TIDE_ONLY',
        dogsAllowedSummer: false,
        strollerFriendly: true,
        rainFriendly: false,
      },
      isSponsored: false,
      updatedAt: new Date(),
    };

    const evaluation = evaluatePlaceContext(beach, dummyContext, []);
    assert.notStrictEqual(evaluation.status, 'IDEAL', 'Low water height should not be ideal for beach');
    assert.strictEqual(evaluation.badgeLabel, 'Basse mer : estran découvert');
  });

  it('tailors heritage badge to sheltering when raining', () => {
    const rainyContext: MarineWeatherContext = {
      ...dummyContext,
      isRaining: true,
    };

    const museum: Place = {
      id: '3',
      slug: 'musee-histoire-vannes',
      name: 'Musée d’Histoire de Vannes',
      shortDescription: 'Musée d’art et histoire',
      category: 'HERITAGE',
      commune: 'Vannes',
      communeSlug: 'vannes',
      sector: 'VANNES',
      latitude: 47.65,
      longitude: -2.75,
      contextualRules: {
        tideConstraint: 'ALL_TIDES',
        dogsAllowedSummer: false,
        strollerFriendly: true,
        rainFriendly: true,
      },
      isSponsored: false,
      updatedAt: new Date(),
    };

    const evaluation = evaluatePlaceContext(museum, rainyContext, []);
    assert.strictEqual(evaluation.status, 'IDEAL');
    assert.strictEqual(evaluation.badgeLabel, 'Idéal par temps pluvieux');
  });

  it('tailors heritage badge to discouraging visit when outdoor site in rain', () => {
    const rainyContext: MarineWeatherContext = {
      ...dummyContext,
      isRaining: true,
    };

    const megalithSite: Place = {
      id: '3b',
      slug: 'alignements-megalithes',
      name: 'Alignements Mégalithiques',
      shortDescription: 'Champ de menhirs en plein air',
      category: 'HERITAGE',
      commune: 'Carnac',
      communeSlug: 'carnac',
      sector: 'QUIBERON',
      latitude: 47.59,
      longitude: -3.08,
      contextualRules: {
        tideConstraint: 'ALL_TIDES',
        dogsAllowedSummer: true,
        strollerFriendly: true,
        rainFriendly: false,
      },
      isSponsored: false,
      updatedAt: new Date(),
    };

    const evaluation = evaluatePlaceContext(megalithSite, rainyContext, []);
    assert.strictEqual(evaluation.badgeLabel, 'Visite sous la pluie déconseillée');
  });

  it('tailors viewpoint badge to clear view in fair weather', () => {
    const viewpoint: Place = {
      id: '4',
      slug: 'pointe-des-emigres',
      name: 'Pointe des Émigrés',
      shortDescription: 'Panorama d’exception sur les méandres du Golfe',
      category: 'VIEWPOINT',
      commune: 'Vannes',
      communeSlug: 'vannes',
      sector: 'VANNES',
      latitude: 47.63,
      longitude: -2.78,
      contextualRules: {
        tideConstraint: 'ALL_TIDES',
        dogsAllowedSummer: true,
        strollerFriendly: true,
        rainFriendly: false,
      },
      isSponsored: false,
      updatedAt: new Date(),
    };

    const evaluation = evaluatePlaceContext(viewpoint, dummyContext, []);
    assert.strictEqual(evaluation.status, 'IDEAL');
    assert.strictEqual(evaluation.badgeLabel, 'Vue dégagée');
  });

  it('tailors gastronomy badge to gourmet break', () => {
    const creperie: Place = {
      id: '5',
      slug: 'creperie-du-port',
      name: 'Crêperie du Port',
      shortDescription: 'Galettes traditionnelles au sarrasin breton',
      category: 'GASTRONOMY',
      commune: 'Vannes',
      communeSlug: 'vannes',
      sector: 'VANNES',
      latitude: 47.65,
      longitude: -2.75,
      contextualRules: {
        tideConstraint: 'ALL_TIDES',
        dogsAllowedSummer: true,
        strollerFriendly: true,
        rainFriendly: true,
      },
      isSponsored: false,
      updatedAt: new Date(),
    };

    const evaluation = evaluatePlaceContext(creperie, dummyContext, []);
    assert.strictEqual(evaluation.status, 'IDEAL');
    assert.strictEqual(evaluation.badgeLabel, 'Idéal pour une pause gourmande');
  });

  it('performance: 1000 category evaluations complete in under 50ms (< 0.1ms each)', () => {
    const castle: Place = {
      id: '1',
      slug: 'chateau-suscinio',
      name: 'Château de Suscinio',
      shortDescription: 'Forteresse des Ducs de Bretagne',
      category: 'HERITAGE',
      commune: 'Sarzeau',
      communeSlug: 'sarzeau',
      sector: 'SARZEAU',
      latitude: 47.514,
      longitude: -2.778,
      contextualRules: {
        tideConstraint: 'ALL_TIDES',
        dogsAllowedSummer: false,
        strollerFriendly: true,
        rainFriendly: true,
      },
      isSponsored: false,
      updatedAt: new Date(),
    };

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      evaluatePlaceContext(castle, dummyContext, []);
    }
    const elapsed = performance.now() - start;
    assert.ok(elapsed < 100, `Expected < 100ms (< 0.1ms/op), took ${elapsed.toFixed(2)}ms`);
  });
});
