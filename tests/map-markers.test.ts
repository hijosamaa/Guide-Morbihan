import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { createMarkerDescriptor, createPlaceMarkerElement } from '../src/components/map/MapMarkers';
import { MapControls } from '../src/components/map/MapControls';
import type { PlaceMarkerData } from '../src/lib/types/map';

const samplePlace: PlaceMarkerData = {
  id: 'place-1',
  slug: 'plage-conleau',
  name: 'Plage de Conleau',
  latitude: 47.63,
  longitude: -2.77,
  category: 'BEACH',
  status: 'IDEAL',
  score: 85,
};

test('createMarkerDescriptor produces valid accessible attributes and styles', () => {
  const descriptor = createMarkerDescriptor(samplePlace, false);
  assert.equal(descriptor.role, 'button');
  assert.equal(descriptor.tabIndex, 0);
  assert.ok(descriptor.ariaLabel.includes('Plage de Conleau'));
  assert.ok(descriptor.ariaLabel.includes('Idéal'));
  assert.ok(descriptor.className.includes('bg-emerald-600'));

  // Test selected state
  const selectedDescriptor = createMarkerDescriptor(samplePlace, true);
  assert.ok(selectedDescriptor.className.includes('ring-sky-500'));
});

test('createMarkerDescriptor handles WARNING, DISCOURAGED and SPONSORED statuses', () => {
  const warningPlace: PlaceMarkerData = { ...samplePlace, status: 'WARNING' };
  const warningDesc = createMarkerDescriptor(warningPlace);
  assert.ok(warningDesc.ariaLabel.includes('Vigilance'));
  assert.ok(warningDesc.className.includes('bg-amber-500'));

  const discouragedPlace: PlaceMarkerData = { ...samplePlace, status: 'DISCOURAGED' };
  const discouragedDesc = createMarkerDescriptor(discouragedPlace);
  assert.ok(discouragedDesc.ariaLabel.includes('Déconseillé'));
  assert.ok(discouragedDesc.className.includes('bg-slate-400'));

  const sponsoredPlace: PlaceMarkerData = { ...samplePlace, isSponsored: true };
  const sponsoredDesc = createMarkerDescriptor(sponsoredPlace);
  assert.ok(sponsoredDesc.ariaLabel.includes('partenaire'));
  assert.ok(sponsoredDesc.className.includes('from-amber-500'));
});

test('createPlaceMarkerElement creates interactive DOM element with accessibility attributes and listeners', () => {
  let clickedPlace: PlaceMarkerData | null = null;
  const mockElements: any[] = [];

  const mockDoc = {
    createElement: (tag: string) => {
      const el: any = {
        tagName: tag.toUpperCase(),
        className: '',
        title: '',
        attributes: {} as Record<string, string>,
        children: [] as any[],
        listeners: {} as Record<string, ((e: any) => void)[]>,
        setAttribute(k: string, v: string) {
          this.attributes[k] = v;
        },
        getAttribute(k: string) {
          return this.attributes[k];
        },
        appendChild(child: any) {
          this.children.push(child);
        },
        addEventListener(evt: string, fn: (e: any) => void) {
          if (!this.listeners[evt]) this.listeners[evt] = [];
          this.listeners[evt].push(fn);
        },
        trigger(evt: string, evtObj: any = {}) {
          const handlers = this.listeners[evt] || [];
          for (const h of handlers) {
            h({
              stopPropagation: () => {},
              preventDefault: () => {},
              ...evtObj,
            });
          }
        },
      };
      mockElements.push(el);
      return el;
    },
  };

  (globalThis as any).document = mockDoc;

  try {
    const el = createPlaceMarkerElement(samplePlace, false, (p) => {
      clickedPlace = p;
    }) as any;

    assert.equal(el.getAttribute('role'), 'button');
    assert.equal(el.getAttribute('tabindex'), '0');
    assert.ok(el.getAttribute('aria-label')?.includes('Plage de Conleau'));
    assert.equal(el.title, 'Plage de Conleau');
    assert.equal(el.children.length, 1); // inner dot

    // Trigger click
    el.trigger('click');
    assert.equal(clickedPlace, samplePlace);

    // Trigger keyboard 'Enter'
    clickedPlace = null;
    el.trigger('keydown', { key: 'Enter' });
    assert.equal(clickedPlace, samplePlace);

    // Trigger keyboard ' ' (Space)
    clickedPlace = null;
    el.trigger('keydown', { key: ' ' });
    assert.equal(clickedPlace, samplePlace);

    // Ignored key
    clickedPlace = null;
    el.trigger('keydown', { key: 'ArrowDown' });
    assert.equal(clickedPlace, null);
  } finally {
    delete (globalThis as any).document;
  }
});

test('MapControls renders buttons with appropriate aria labels and Tailwind classes', () => {
  const html = renderToString(
    React.createElement(MapControls, {
      onZoomIn: () => {},
      onZoomOut: () => {},
      onResetCenter: () => {},
      onLocateUser: () => {},
      isLocating: false,
    })
  );

  assert.ok(html.includes('Zoom avant'));
  assert.ok(html.includes('Zoom arrière'));
  assert.ok(html.includes('Recentrer'));
  assert.ok(html.includes('Autour de moi'));
  assert.ok(html.includes('rounded-full'));
});

test('MapControls renders without locate button when onLocateUser is omitted', () => {
  const html = renderToString(
    React.createElement(MapControls, {
      onZoomIn: () => {},
      onZoomOut: () => {},
      onResetCenter: () => {},
    })
  );

  assert.ok(!html.includes('Autour de moi'));
  assert.ok(html.includes('Recentrer'));
  assert.ok(html.includes('Zoom avant'));
});
