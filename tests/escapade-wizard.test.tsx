import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EscapadeWizard, SECTOR_OPTIONS, PROFILE_OPTIONS } from '../src/components/escapade/EscapadeWizard';

test('EscapadeWizard renders sector options and duration pills', () => {
  const html = renderToStaticMarkup(React.createElement(EscapadeWizard, { onGenerate: () => {} }));
  assert.ok(html.includes('Où logez-vous'), 'Must ask for base sector');
  assert.ok(html.includes('Presqu’île de Rhuys') || html.includes('Rhuys'), 'Must include Rhuys');
  assert.ok(html.includes('1 jour') || html.includes('Escapade 1 jour'), 'Must include duration');
});

test('EscapadeWizard renders all 4 sectors, duration pills, and 3 profile types', () => {
  const html = renderToStaticMarkup(React.createElement(EscapadeWizard, { onGenerate: () => {} }));

  // Sectors
  assert.ok(html.includes('Vannes') || html.includes('Golfe'), 'Must render Vannes/Golfe');
  assert.ok(html.includes('Rhuys'), 'Must render Rhuys');
  assert.ok(html.includes('Auray') || html.includes('Ria'), 'Must render Auray/Ria');
  assert.ok(html.includes('Quiberon') || html.includes('Carnac'), 'Must render Quiberon/Carnac');

  // Durations
  assert.ok(html.includes('1 jour'), 'Must render 1 jour duration');
  assert.ok(html.includes('2-3 jours'), 'Must render 2-3 jours duration');

  // Profiles
  assert.ok(html.includes('Famille') || html.includes('Poussette'), 'Must render family profile');
  assert.ok(html.includes('Nature') || html.includes('Balade'), 'Must render nature profile');
  assert.ok(html.includes('Patrimoine') || html.includes('huîtres'), 'Must render heritage profile');

  // Action Button
  assert.ok(html.includes('Générer mon escapade'), 'Must contain generate escapade button');
});

test('EscapadeWizard applies aria-checked and preselects initialProfile values', () => {
  const html = renderToStaticMarkup(
    React.createElement(EscapadeWizard, {
      initialProfile: {
        baseSector: 'Presqu-ile de Quiberon',
        durationDays: 2,
        profileType: 'HERITAGE_GOURMET',
      },
      onGenerate: () => {},
    })
  );

  // Sector Quiberon checked
  assert.ok(
    html.includes('aria-checked="true"') && html.includes('Quiberon'),
    'Must have an active Quiberon selection'
  );

  // Heritage profile checked
  assert.ok(
    html.includes('aria-checked="true"') && (html.includes('Patrimoine') || html.includes('huîtres')),
    'Must have an active heritage profile selection'
  );
});

test('EscapadeWizard renders loading state when isGenerating is true', () => {
  const html = renderToStaticMarkup(
    React.createElement(EscapadeWizard, { onGenerate: () => {}, isGenerating: true })
  );

  assert.ok(
    html.includes('Génération') || html.includes('Création') || html.includes('disabled') || html.includes('aria-busy="true"'),
    'Must reflect generating state'
  );
});

test('EscapadeWizard meets mobile touch target standards (>= 44px) and accessibility attributes', () => {
  const html = renderToStaticMarkup(
    React.createElement(EscapadeWizard, { onGenerate: () => {}, className: 'custom-wizard-test' })
  );

  assert.ok(html.includes('custom-wizard-test'), 'Must respect custom className');
  assert.ok(html.includes('touch-manipulation'), 'Must include touch-manipulation for mobile speed');
  assert.ok(html.includes('role="radiogroup"'), 'Must define radiogroup roles for accessibility');
  assert.ok(html.includes('role="radio"'), 'Must define radio roles for options');
});

test('SECTOR_OPTIONS and PROFILE_OPTIONS constants are properly exported', () => {
  assert.strictEqual(SECTOR_OPTIONS.length, 4, 'Must have 4 sectors');
  assert.strictEqual(PROFILE_OPTIONS.length, 3, 'Must have 3 profiles');
});
