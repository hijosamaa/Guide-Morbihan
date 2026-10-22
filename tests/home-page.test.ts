import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import HomePage from '../src/app/page';

test('HomePage renders hero, cta and intent buttons', () => {
  const html = renderToString(React.createElement(HomePage));
  assert.ok(html.includes('<main'), 'HomePage should have a semantic <main> landmark');
  assert.ok(html.includes('Le Copilote Contextuel'));
  assert.ok(html.includes('Ouvrir la Carte'));
  assert.ok(html.includes('Baignade'));
  assert.ok(html.includes('Sentiers'));
  assert.ok(html.includes('Patrimoine'));
  assert.ok(html.includes('Passage de Berder'));
  assert.ok(html.includes('Plage du Fogeo'));
  assert.ok(html.includes('aria-hidden="true"'), 'Emoji icons should be aria-hidden');
  assert.ok(html.includes('touch-manipulation'), 'Buttons should include touch-manipulation');
  assert.ok(html.includes('focus-visible:ring-emerald-500'), 'Intent buttons should include focus rings');
});
