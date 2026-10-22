import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateTidalPassageStatus } from '../src/lib/geo-navigation/tide-alert-evaluator.js';

test('evaluateTidalPassageStatus computes dynamic surge margin and warns if flooded', () => {
  // Passage de Berder à 4 km, marcheur à 4 km/h -> arrivée dans 1h (60 min)
  const now = new Date('2026-10-22T14:00:00Z');

  // Cas 1 : Passage ouvert pendant encore 3 heures -> PASSABLE
  const resPassable = evaluateTidalPassageStatus({
    passageName: 'Passage de Berder',
    distanceToPassageKm: 4.0,
    speedKmH: 4.0,
    currentDate: now,
    passageOpensAt: new Date('2026-10-22T12:00:00Z'),
    passageClosesAt: new Date('2026-10-22T18:00:00Z'),
    tideCoefficient: 70,
    windSpeedKnots: 10,
    windCardinal: 'E',
  });
  assert.equal(resPassable.status, 'PASSABLE');
  assert.match(resPassable.message, /praticable à votre arrivée estimée/i);
  assert.equal(resPassable.safetyMarginMinutes, 15);

  // Cas 2 : Passage ferme dans 1h10 avec vent fort SW (25 kts) et gros coeff 85
  // La surcote ajoute 15m (base) + 10m (coeff) + 15m (vent SW) = 40 min de marge de sécurité !
  // Heure de fermeture effective = 15h10 - 40m = 14h30. Arrivée à 15h00 -> SUBMERGED
  const resFlooded = evaluateTidalPassageStatus({
    passageName: 'Passage de Berder',
    distanceToPassageKm: 4.0,
    speedKmH: 4.0,
    currentDate: now,
    passageOpensAt: new Date('2026-10-22T11:00:00Z'),
    passageClosesAt: new Date('2026-10-22T15:10:00Z'),
    tideCoefficient: 85,
    windSpeedKnots: 25,
    windCardinal: 'SW',
  });
  assert.equal(resFlooded.status, 'SUBMERGED');
  assert.match(resFlooded.message, /submergé ou dangereux/i);
  assert.equal(resFlooded.safetyMarginMinutes, 40);
});

test('evaluateTidalPassageStatus handles WARNING_CLOSING when ETA is within 30 minutes of effective closing', () => {
  const now = new Date('2026-10-22T14:00:00Z');
  // Distance 4km, vitesse 4km/h -> ETA 15h00
  // Fermeture à 15h40, coeff 70, pas de surcote vent -> marge 15 min -> fermeture effective 15h25
  // Différence = 25 min <= 30 min -> WARNING_CLOSING
  const resWarning = evaluateTidalPassageStatus({
    passageName: 'Passage du Gois / Berder',
    distanceToPassageKm: 4.0,
    speedKmH: 4.0,
    currentDate: now,
    passageOpensAt: new Date('2026-10-22T12:00:00Z'),
    passageClosesAt: new Date('2026-10-22T15:40:00Z'),
    tideCoefficient: 70,
  });

  assert.equal(resWarning.status, 'WARNING_CLOSING');
  assert.match(resWarning.message, /se referme rapidement/i);
  assert.equal(resWarning.safetyMarginMinutes, 15);
});

test('evaluateTidalPassageStatus handles passage still submerged before opening', () => {
  const now = new Date('2026-10-22T10:00:00Z');
  // Distance 2km, vitesse 4km/h -> ETA 10h30
  // Passage opens at 11h00 -> still submerged
  const resBeforeOpen = evaluateTidalPassageStatus({
    passageName: 'Passage de Tascon',
    distanceToPassageKm: 2.0,
    speedKmH: 4.0,
    currentDate: now,
    passageOpensAt: new Date('2026-10-22T11:00:00Z'),
    passageClosesAt: new Date('2026-10-22T14:00:00Z'),
  });

  assert.equal(resBeforeOpen.status, 'SUBMERGED');
  assert.match(resBeforeOpen.message, /encore sous l'eau à votre arrivée/i);
});

test('evaluateTidalPassageStatus supports West wind trigger and minimum speed clamp', () => {
  const now = new Date('2026-10-22T14:00:00Z');
  // Speed 0 km/h clamped to 1.0 km/h minimum -> 2 km @ 1 km/h = 2 hours -> ETA 16:00
  // Wind W at 22 knots (>= 20) -> adds 15 min
  // Coeff 80 (>= 80) -> adds 10 min
  // Base -> 15 min
  // Total margin = 40 min
  const resClamped = evaluateTidalPassageStatus({
    passageName: 'Passage des 7 Îles',
    distanceToPassageKm: 2.0,
    speedKmH: 0,
    currentDate: now,
    passageOpensAt: new Date('2026-10-22T12:00:00Z'),
    passageClosesAt: new Date('2026-10-22T17:00:00Z'),
    tideCoefficient: 80,
    windSpeedKnots: 22,
    windCardinal: 'W',
  });

  assert.equal(resClamped.safetyMarginMinutes, 40);
  // ETA = 16:00. Closing = 17:00 - 40 min = 16:20.
  // 16:20 - 16:00 = 20 min <= 30 min -> WARNING_CLOSING
  assert.equal(resClamped.status, 'WARNING_CLOSING');
});
