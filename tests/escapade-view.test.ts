import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EscapadeView } from '../src/components/escapade/EscapadeView';
import { EscapadeMomentCard } from '../src/components/escapade/EscapadeMomentCard';
import type { EscapadePlan, EscapadeMoment } from '../src/lib/escapade/types';

test('EscapadeView renders 4 life moments and rain toggle button', () => {
  const mockPlan: EscapadePlan = {
    profile: { baseSector: 'Presqu-ile de Rhuys', durationDays: 1, profileType: 'FAMILY' },
    days: [
      {
        dayIndex: 1,
        date: '2026-07-15',
        sector: 'Presqu-ile de Rhuys',
        isRainMode: false,
        moments: [
          { momentType: 'MATIN', title: 'Matinée iodée', place: { name: 'Suscinio', commune: 'Sarzeau' }, alternatives: [] },
          { momentType: 'DEJEUNER', title: 'Pause dégustation', place: { name: 'Chantier huîtres', commune: 'Le Tour' }, alternatives: [] },
          { momentType: 'APRES_MIDI', title: 'Après-midi marée', place: { name: 'Plage Landrezac', commune: 'Sarzeau' }, alternatives: [] },
          { momentType: 'FIN_JOURNEE', title: 'Coucher de soleil', place: { name: 'Pointe de Bilgroix', commune: 'Arzon' }, alternatives: [] },
        ],
      },
    ],
  };

  const html = renderToStaticMarkup(
    React.createElement(EscapadeView, {
      plan: mockPlan,
      onSwap: () => {},
      onToggleRain: () => {},
    })
  );

  assert.ok(html.includes('Matinée iodée'), 'Renders morning moment');
  assert.ok(html.includes('Il pleut'), 'Renders rain toggle button');
  assert.ok(html.includes('Chantier huîtres'), 'Renders lunch spot');
  assert.ok(html.includes('Plage Landrezac'), 'Renders afternoon spot');
  assert.ok(html.includes('Pointe de Bilgroix'), 'Renders sunset spot');
});

test('EscapadeView renders multi-day tabs (J1, J2, J3) and displays tide notice', () => {
  const mockPlan: EscapadePlan = {
    profile: { baseSector: 'Presqu-ile de Quiberon', durationDays: 3, profileType: 'NATURE' },
    days: [
      {
        dayIndex: 1,
        date: '2026-07-15',
        sector: 'Presqu-ile de Quiberon',
        isRainMode: false,
        tideSummary: 'Marée basse à 14h20 (coef 85)',
        moments: [
          { momentType: 'MATIN', title: 'Matinée côte sauvage', place: { name: 'Port Bara', commune: 'Quiberon' }, alternatives: [] },
          { momentType: 'DEJEUNER', title: 'Pause crêperie', place: { name: 'Le Vivier', commune: 'Quiberon' }, alternatives: [] },
          { momentType: 'APRES_MIDI', title: 'Balade falaises', place: { name: 'Pointe du Percho', commune: 'Saint-Pierre-Quiberon' }, alternatives: [] },
          { momentType: 'FIN_JOURNEE', title: 'Coucher de soleil océan', place: { name: 'Portivy', commune: 'Saint-Pierre-Quiberon' }, alternatives: [] },
        ],
      },
      {
        dayIndex: 2,
        date: '2026-07-16',
        sector: 'Ria d-Etel',
        isRainMode: false,
        moments: [
          { momentType: 'MATIN', title: 'Matinée ria', place: { name: 'Saint-Cado', commune: 'Belz' }, alternatives: [] },
          { momentType: 'DEJEUNER', title: 'Déjeuner vue rivière', place: { name: 'Bistrot d-Etel', commune: 'Etel' }, alternatives: [] },
          { momentType: 'APRES_MIDI', title: 'Dunes sauvages', place: { name: 'Barre d-Etel', commune: 'Plouhinec' }, alternatives: [] },
          { momentType: 'FIN_JOURNEE', title: 'Coucher de soleil ria', place: { name: 'Vieux Passage', commune: 'Plouhinec' }, alternatives: [] },
        ],
      },
      {
        dayIndex: 3,
        date: '2026-07-17',
        sector: 'Golfe',
        isRainMode: false,
        moments: [
          { momentType: 'MATIN', title: 'Matinée mégalithes', place: { name: 'Locmariaquer', commune: 'Locmariaquer' }, alternatives: [] },
          { momentType: 'DEJEUNER', title: 'Huîtres du golfe', place: { name: 'Cabane Larmor-Baden', commune: 'Larmor-Baden' }, alternatives: [] },
          { momentType: 'APRES_MIDI', title: 'Île de Berder', place: { name: 'Passage Berder', commune: 'Larmor-Baden' }, alternatives: [] },
          { momentType: 'FIN_JOURNEE', title: 'Crépuscule', place: { name: 'Pointe du Berchis', commune: 'Larmor-Baden' }, alternatives: [] },
        ],
      },
    ],
  };

  const html = renderToStaticMarkup(
    React.createElement(EscapadeView, {
      plan: mockPlan,
      onSwap: () => {},
      onToggleRain: () => {},
    })
  );

  assert.ok(html.includes('Jour 1') || html.includes('J1'), 'Renders Day 1 tab');
  assert.ok(html.includes('Jour 2') || html.includes('J2'), 'Renders Day 2 tab');
  assert.ok(html.includes('Jour 3') || html.includes('J3'), 'Renders Day 3 tab');
  assert.ok(html.includes('Marée basse à 14h20') || html.includes('coef 85'), 'Renders tide summary notice');
});

test('EscapadeView highlights active rain mode when isRainMode is true', () => {
  const mockPlan: EscapadePlan = {
    profile: { baseSector: 'Golfe', durationDays: 1, profileType: 'HERITAGE_GOURMET' },
    days: [
      {
        dayIndex: 1,
        date: '2026-07-15',
        sector: 'Golfe',
        isRainMode: true,
        moments: [
          {
            momentType: 'MATIN',
            title: 'Matinée couverte',
            place: { name: 'Musée de la Cohue', commune: 'Vannes', contextualRules: { rainFriendly: true } },
            alternatives: [],
          },
          {
            momentType: 'DEJEUNER',
            title: 'Pause gourmande',
            place: { name: 'Halles des Lices', commune: 'Vannes', contextualRules: { rainFriendly: true } },
            alternatives: [],
          },
          {
            momentType: 'APRES_MIDI',
            title: 'Aquarium ou découverte',
            place: { name: 'Château Gaillard', commune: 'Vannes', contextualRules: { rainFriendly: true } },
            alternatives: [],
          },
          {
            momentType: 'FIN_JOURNEE',
            title: 'Salon de thé',
            place: { name: 'Remparts Café', commune: 'Vannes', contextualRules: { rainFriendly: true } },
            alternatives: [],
          },
        ],
      },
    ],
  };

  const html = renderToStaticMarkup(
    React.createElement(EscapadeView, {
      plan: mockPlan,
      onSwap: () => {},
      onToggleRain: () => {},
    })
  );

  assert.ok(html.includes('Il pleut'), 'Renders rain button');
  assert.ok(
    html.includes('aria-pressed="true"') || html.includes('bg-sky-') || html.includes('bg-blue-') || html.includes('Pluie active'),
    'Indicates rain mode is active'
  );
  assert.ok(html.includes('Musée de la Cohue'), 'Renders sheltered morning spot');
});

test('EscapadeMomentCard renders icon, title, place details, context badge, and action buttons', () => {
  const mockMoment: EscapadeMoment = {
    momentType: 'MATIN',
    title: 'Matinée iodée',
    place: {
      id: 'suscinio-castle',
      slug: 'chateau-de-suscinio',
      name: 'Château de Suscinio',
      commune: 'Sarzeau',
      coverImageUrl: 'https://images.unsplash.com/photo-suscinio.jpg',
      latitude: 47.514,
      longitude: -2.729,
      contextualRules: {
        rainFriendly: true,
      },
    },
    alternatives: [
      { id: 'port-navalo', name: 'Phare de Port-Navalo', commune: 'Arzon' },
      { id: 'pointe-saint-gildas', name: 'Grand Mont', commune: 'Saint-Gildas-de-Rhuys' },
    ],
  };

  const html = renderToStaticMarkup(
    React.createElement(EscapadeMomentCard, {
      moment: mockMoment,
      onOpenSwap: () => {},
    })
  );

  assert.ok(html.includes('Matinée iodée'), 'Renders moment title');
  assert.ok(html.includes('Château de Suscinio'), 'Renders place name');
  assert.ok(html.includes('Sarzeau'), 'Renders commune');
  assert.ok(html.includes('Remplacer') || html.includes('🔀'), 'Renders swap action button');
  assert.ok(html.includes('Y aller') || html.includes('🚗'), 'Renders go / itinerary button');
  assert.ok(html.includes('Abrité') || html.includes('pluie') || html.includes('Idéal'), 'Renders context badge for sheltered place');
});

test('EscapadeMomentCard renders navigation links with coordinates', () => {
  const mockMoment: EscapadeMoment = {
    momentType: 'APRES_MIDI',
    title: 'Après-midi marée',
    place: {
      id: 'berder-island',
      slug: 'passage-ile-de-berder',
      name: 'Île de Berder',
      commune: 'Larmor-Baden',
      latitude: 47.578,
      longitude: -2.887,
      parkingLat: 47.581,
      parkingLng: -2.885,
    },
    alternatives: [],
  };

  const html = renderToStaticMarkup(
    React.createElement(EscapadeMomentCard, {
      moment: mockMoment,
      onOpenSwap: () => {},
    })
  );

  assert.ok(html.includes('maps.google.com') || html.includes('waze.com') || html.includes('/lieu/passage-ile-de-berder'), 'Provides navigation or spot link');
  assert.ok(html.includes('Île de Berder'), 'Renders spot name');
});

test('EscapadeView renders header with share button and accessible landmarks', () => {
  const mockPlan: EscapadePlan = {
    profile: { baseSector: 'Golfe', durationDays: 1, profileType: 'FAMILY' },
    days: [
      {
        dayIndex: 1,
        date: '2026-07-15',
        sector: 'Golfe',
        moments: [
          { momentType: 'MATIN', title: 'Matin', place: { name: 'A', commune: 'Vannes' }, alternatives: [] },
          { momentType: 'DEJEUNER', title: 'Midi', place: { name: 'B', commune: 'Vannes' }, alternatives: [] },
          { momentType: 'APRES_MIDI', title: 'Après-midi', place: { name: 'C', commune: 'Vannes' }, alternatives: [] },
          { momentType: 'FIN_JOURNEE', title: 'Soir', place: { name: 'D', commune: 'Vannes' }, alternatives: [] },
        ],
      },
    ],
  };

  const html = renderToStaticMarkup(
    React.createElement(EscapadeView, {
      plan: mockPlan,
      onSwap: () => {},
      onToggleRain: () => {},
    })
  );

  assert.ok(html.includes('Partager') || html.includes('🔗'), 'Renders share button');
  assert.ok(html.includes('Escapade') || html.includes('Programme'), 'Renders title/header');
});

test('EscapadeMomentCard renders all 4 moment types with specific labels and emojis', () => {
  const momentTypes = ['MATIN', 'DEJEUNER', 'APRES_MIDI', 'FIN_JOURNEE'] as const;
  const labels = ['Matin', 'Midi', 'Après-midi', 'Fin de journée'];

  for (let i = 0; i < momentTypes.length; i++) {
    const html = renderToStaticMarkup(
      React.createElement(EscapadeMomentCard, {
        moment: {
          momentType: momentTypes[i],
          title: `Moment ${i}`,
          place: { name: `Lieu ${i}`, commune: 'Vannes' },
          alternatives: [],
        },
      })
    );
    assert.ok(html.includes(labels[i]), `Must render label for ${momentTypes[i]}`);
  }
});

test('EscapadeView formats object tideSummary correctly', () => {
  const mockPlan: EscapadePlan = {
    profile: { baseSector: 'Golfe', durationDays: 1, profileType: 'FAMILY' },
    days: [
      {
        dayIndex: 1,
        date: '2026-07-15',
        sector: 'Golfe',
        tideSummary: { harbor: 'Port-Navalo', waterState: 'Marée descendante' } as any,
        moments: [
          { momentType: 'MATIN', title: 'Matinée', place: { name: 'Spot', commune: 'Arzon' }, alternatives: [] },
          { momentType: 'DEJEUNER', title: 'Midi', place: { name: 'Spot', commune: 'Arzon' }, alternatives: [] },
          { momentType: 'APRES_MIDI', title: 'Aprem', place: { name: 'Spot', commune: 'Arzon' }, alternatives: [] },
          { momentType: 'FIN_JOURNEE', title: 'Soir', place: { name: 'Spot', commune: 'Arzon' }, alternatives: [] },
        ],
      },
    ],
  };

  const html = renderToStaticMarkup(
    React.createElement(EscapadeView, {
      plan: mockPlan,
      onSwap: () => {},
      onToggleRain: () => {},
    })
  );

  assert.ok(html.includes('Port-Navalo'), 'Renders harbor name');
  assert.ok(html.includes('Marée descendante'), 'Renders tide state');
});

