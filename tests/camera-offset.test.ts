import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { calculateCameraPadding } from '../src/lib/hooks/useCameraOffset';
import { DesktopSplitExplorer } from '../src/components/explorer/DesktopSplitExplorer';
import type { PlaceMarkerData } from '../src/lib/types/map';

test('calculateCameraPadding returns exact bottom padding for string pixel snap point', () => {
  const padding = calculateCameraPadding('140px', 800);
  assert.equal(padding.bottom, 140);
  assert.equal(padding.top, 60);
  assert.equal(padding.left, 0);
  assert.equal(padding.right, 0);
});

test('calculateCameraPadding returns 50% window height for half snap point', () => {
  const padding = calculateCameraPadding(0.5, 800);
  assert.equal(padding.bottom, 400);
  assert.equal(padding.top, 60);
  assert.equal(padding.left, 0);
  assert.equal(padding.right, 0);
});

test('calculateCameraPadding returns 92% window height for expanded snap point', () => {
  const padding = calculateCameraPadding(0.92, 800);
  assert.equal(padding.bottom, 736);
  assert.equal(padding.top, 60);
});

test('calculateCameraPadding falls back to default 140px when snap point is null or undefined', () => {
  const nullPadding = calculateCameraPadding(null, 800);
  assert.equal(nullPadding.bottom, 140);
  assert.equal(nullPadding.top, 60);

  const undefinedPadding = calculateCameraPadding(undefined as unknown as null, 800);
  assert.equal(undefinedPadding.bottom, 140);
  assert.equal(undefinedPadding.top, 60);
});

test('DesktopSplitExplorer renders master sidebar with places count and FilterBar', () => {
  const places: PlaceMarkerData[] = [
    {
      id: 'spot-1',
      slug: 'port-blanc',
      name: 'Port-Blanc',
      latitude: 47.6,
      longitude: -2.86,
      category: 'NAUTICAL',
      status: 'IDEAL',
    },
    {
      id: 'spot-2',
      slug: 'pointe-arradon',
      name: "Pointe d'Arradon",
      latitude: 47.61,
      longitude: -2.82,
      category: 'VIEWPOINT',
      status: 'WARNING',
    },
  ];

  const html = renderToString(
    React.createElement(
      NuqsTestingAdapter,
      null,
      React.createElement(DesktopSplitExplorer, {
        places,
        selectedPlaceId: 'spot-1',
        isRaining: false,
      })
    )
  );

  assert.ok(html.includes('Explorateur du Golfe'));
  assert.ok(html.includes('Port-Blanc'));
  assert.ok(html.includes("Pointe d&#x27;Arradon") || html.includes("Pointe d'Arradon"));
  assert.ok(html.includes('w-[440px]'));
  assert.ok(html.includes('trouvés'));
  assert.ok(html.includes('spot-card-spot-1'));
  assert.ok(html.includes('aria-pressed="true"'));
});

test('DesktopSplitExplorer renders with rain filter when isRaining is true', () => {
  const html = renderToString(
    React.createElement(
      NuqsTestingAdapter,
      null,
      React.createElement(DesktopSplitExplorer, {
        places: [],
        isRaining: true,
      })
    )
  );

  assert.ok(html.includes('abri de la pluie'));
  assert.ok(html.includes('0'));
});
