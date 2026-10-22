import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TidalAlertChip } from '../src/components/context/TidalAlertChip';
import { FloatingContextPill } from '../src/components/context/FloatingContextPill';

test('TidalAlertChip renders only when urgent closing soon', () => {
  const urgentHtml = renderToString(
    React.createElement(TidalAlertChip, {
      passageName: 'Berder',
      minutesRemaining: 25,
      isOpen: true,
    })
  );
  assert.ok(urgentHtml.includes('Berder'));
  assert.ok(urgentHtml.includes('25 min'));
  assert.ok(urgentHtml.includes('amber'));
  assert.ok(urgentHtml.includes('role="alert"'));
});

test('TidalAlertChip returns null when open for a long time', () => {
  const safeHtml = renderToString(
    React.createElement(TidalAlertChip, {
      passageName: 'Berder',
      minutesRemaining: 180,
      isOpen: true,
    })
  );
  assert.equal(safeHtml, '');
});

test('TidalAlertChip returns null when closed or expired', () => {
  const closedHtml = renderToString(
    React.createElement(TidalAlertChip, {
      passageName: 'Berder',
      minutesRemaining: 20,
      isOpen: false,
    })
  );
  assert.equal(closedHtml, '');

  const expiredHtml = renderToString(
    React.createElement(TidalAlertChip, {
      passageName: 'Berder',
      minutesRemaining: 0,
      isOpen: true,
    })
  );
  assert.equal(expiredHtml, '');

  const negativeHtml = renderToString(
    React.createElement(TidalAlertChip, {
      passageName: 'Berder',
      minutesRemaining: -5,
      isOpen: true,
    })
  );
  assert.equal(negativeHtml, '');
});

test('FloatingContextPill renders minimal marine weather summary', () => {
  const html = renderToString(
    React.createElement(FloatingContextPill, {
      tideText: 'PM 17h42 (78)',
      weatherText: '19°C · NO 12nd',
    })
  );
  assert.ok(html.includes('PM 17h42 (78)'));
  assert.ok(html.includes('19°C · NO 12nd'));
});

test('FloatingContextPill renders with urgentAlert slot', () => {
  const alertEl = React.createElement('span', { id: 'urgent-banner' }, 'Alerte Passage');
  const html = renderToString(
    React.createElement(FloatingContextPill, {
      tideText: 'BM 12h10 (45)',
      weatherText: '22°C · O 8nd',
      urgentAlert: alertEl,
    })
  );
  assert.ok(html.includes('urgent-banner'));
  assert.ok(html.includes('Alerte Passage'));
  assert.ok(html.includes('BM 12h10 (45)'));
  assert.ok(html.includes('22°C · O 8nd'));
});
