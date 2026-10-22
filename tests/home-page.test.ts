import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import HomePage from '../src/app/page';

test('HomePage renders hero, cta and intent buttons', () => {
  const html = renderToString(React.createElement(HomePage));
  assert.ok(html.includes('Le Copilote Contextuel'));
  assert.ok(html.includes('Ouvrir la Carte'));
  assert.ok(html.includes('Baignade'));
  assert.ok(html.includes('Sentiers'));
  assert.ok(html.includes('Patrimoine'));
  assert.ok(html.includes('Passage de Berder'));
  assert.ok(html.includes('Plage du Fogeo'));
});
