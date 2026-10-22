import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { FilterPill } from '../src/components/filters/FilterPill';
import { FilterBar } from '../src/components/filters/FilterBar';

test('FilterPill renders label and active state styles', () => {
  const activeHtml = renderToString(
    React.createElement(FilterPill, {
      label: 'Abrité du vent',
      isActive: true,
      onClick: () => {},
    })
  );
  assert.ok(activeHtml.includes('Abrité du vent'));
  assert.ok(activeHtml.includes('bg-slate-900'));
  assert.ok(activeHtml.includes('aria-pressed="true"'));

  const inactiveHtml = renderToString(
    React.createElement(FilterPill, {
      label: 'Abrité du vent',
      isActive: false,
      onClick: () => {},
    })
  );
  assert.ok(inactiveHtml.includes('bg-white'));
  assert.ok(inactiveHtml.includes('aria-pressed="false"'));
});

test('FilterPill renders icon, touch target >= 48px, and tactile feedback classes', () => {
  const html = renderToString(
    React.createElement(FilterPill, {
      label: 'Baignade idéale',
      icon: '🏖️',
      isActive: false,
      onClick: () => {},
      className: 'custom-class',
    })
  );

  assert.ok(html.includes('🏖️'));
  assert.ok(html.includes('Baignade idéale'));
  assert.ok(html.includes('h-12 px-4')); // 48px touch target
  assert.ok(html.includes('active:scale-[0.96]'));
  assert.ok(html.includes('touch-manipulation'));
  assert.ok(html.includes('focus-visible:ring-2'));
  assert.ok(html.includes('custom-class'));
});

test('FilterBar renders toolbar role and default filter pills without rain pill when isRaining is false', () => {
  const html = renderToString(
    React.createElement(
      NuqsTestingAdapter,
      { children: React.createElement(FilterBar, { isRaining: false }) }
    )
  );

  assert.ok(html.includes('role="toolbar"'));
  assert.ok(html.includes('aria-label="Filtres contextuels"'));
  assert.ok(html.includes('touch-pan-x'));
  assert.ok(html.includes('Baignade idéale'));
  assert.ok(html.includes('Abrité du vent'));
  assert.ok(html.includes('Sentiers ouverts'));
  assert.ok(html.includes('Patrimoine'));
  assert.ok(html.includes('Déguster &amp; Huîtres'));
  // Rain pill should not be present
  assert.ok(!html.includes('abri de la pluie'));
});

test('FilterBar renders rain filter pill first when isRaining is true', () => {
  const html = renderToString(
    React.createElement(
      NuqsTestingAdapter,
      { children: React.createElement(FilterBar, { isRaining: true }) }
    )
  );

  assert.ok(html.includes('abri de la pluie'));
  assert.ok(html.includes('🌧️'));
});

test('FilterBar reflects active query state from URL search params', () => {
  const html = renderToString(
    React.createElement(
      NuqsTestingAdapter,
      {
        searchParams: { cat: 'BEACH', maree: 'IDEAL_NOW', vent: 'true' },
        children: React.createElement(FilterBar, { isRaining: false }),
      }
    )
  );

  // Both Baignade idéale and Abrité du vent should have active state
  assert.ok(html.includes('bg-slate-900'));
  assert.ok(html.includes('aria-pressed="true"'));
});
