import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import CartePage from '../src/app/carte/page';

test('CartePage renders without SSR crash', () => {
  const html = renderToString(
    React.createElement(
      NuqsTestingAdapter,
      { children: React.createElement(CartePage) }
    )
  );
  assert.ok(html.includes('Explorateur') || html.includes('Golfe'));
});

test('CartePage renders floating context pill and tidal alert chip', () => {
  const html = renderToString(
    React.createElement(
      NuqsTestingAdapter,
      { children: React.createElement(CartePage) }
    )
  );

  assert.ok(html.includes('PM 17h42 (78)'));
  assert.ok(html.includes('19°C · NO 12nd'));
  assert.ok(html.includes('Berder'));
  assert.ok(html.includes('35 min') || html.includes('35m'));
});

test('CartePage renders initial places in desktop and mobile explorers', () => {
  const html = renderToString(
    React.createElement(
      NuqsTestingAdapter,
      { children: React.createElement(CartePage) }
    )
  );

  assert.ok(html.includes('Île de Berder'));
  assert.ok(html.includes('Plage du Fogeo (Arzon)'));
  assert.ok(html.includes('Port Saint-Goustan (Auray)'));
  assert.ok(html.includes('Château de Suscinio'));
});

test('CartePage renders map canvas container', () => {
  const html = renderToString(
    React.createElement(
      NuqsTestingAdapter,
      { children: React.createElement(CartePage) }
    )
  );

  // Verifies central map section or skeleton placeholder
  assert.ok(
    html.includes('Chargement de la carte interactive') ||
    html.includes('Canevas Cartographique WebGL')
  );
});

test('CartePage filters places when searchParams are provided via NuqsTestingAdapter', () => {
  const html = renderToString(
    React.createElement(
      NuqsTestingAdapter,
      {
        searchParams: { cat: 'BEACH' },
        children: React.createElement(CartePage),
      }
    )
  );

  // Plage du Fogeo is BEACH, should be included
  assert.ok(html.includes('Plage du Fogeo (Arzon)'));
  // Château de Suscinio is HERITAGE, should be filtered out
  assert.ok(!html.includes('Château de Suscinio'));
  // Île de Berder is TRAIL, should be filtered out
  assert.ok(!html.includes('Île de Berder'));
});
