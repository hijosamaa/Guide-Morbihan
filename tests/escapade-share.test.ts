// tests/escapade-share.test.ts
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import type { EscapadePlan } from '../src/lib/escapade/types';

const MOCK_PLAN: EscapadePlan = {
  profile: {
    baseSector: 'Presqu-ile de Rhuys',
    durationDays: 2,
    profileType: 'HERITAGE_GOURMET',
  },
  days: [
    {
      dayIndex: 1,
      date: '2026-07-15',
      sector: 'Presqu-ile de Rhuys',
      moments: [
        {
          momentType: 'MATIN',
          title: 'Matinée iodée',
          place: {
            id: 'suscinio',
            slug: 'domaine-suscinio',
            name: 'Château de Suscinio',
            category: 'HERITAGE',
            commune: 'Sarzeau',
            shortDescription: 'Forteresse médiévale entre marais et océan',
          },
          alternatives: [],
        },
        {
          momentType: 'DEJEUNER',
          title: 'Pause Déjeuner',
          place: {
            id: 'port-navalo-table',
            slug: 'port-navalo',
            name: 'Huîtres du Golfe',
            category: 'GASTRONOMY',
            commune: 'Arzon',
            shortDescription: 'Dégustation sur le port',
          },
          alternatives: [],
        },
        {
          momentType: 'APRES_MIDI',
          title: 'Après-midi marée',
          place: {
            id: 'fogeo',
            slug: 'plage-fogeo',
            name: 'Plage du Fogeo',
            category: 'BEACH',
            commune: 'Arzon',
            shortDescription: 'Grande plage familiale',
          },
          alternatives: [],
        },
        {
          momentType: 'FIN_JOURNEE',
          title: 'Fin de journée',
          place: {
            id: 'port-navalo-view',
            slug: 'phare-port-navalo',
            name: 'Phare de Port-Navalo',
            category: 'VIEWPOINT',
            commune: 'Arzon',
            shortDescription: 'Coucher de soleil sur le goulet',
          },
          alternatives: [],
        },
      ],
      tideSummary: 'Marée à PORT_NAVALO : Pleine mer à 15h30',
    },
  ],
};

describe('Escapade Slug Generation & Share API Route', () => {
  test('generateEscapadeSlug builds readable Morbihan slug', async () => {
    const { generateEscapadeSlug } = await import('../src/lib/escapade/share-service');
    const slugRhuys = generateEscapadeSlug('Presqu-ile de Rhuys', 2);
    assert.match(slugRhuys, /^escapade-rhuys-2j-[a-z0-9]{5}$/);

    const slugGolfe = generateEscapadeSlug('Golfe', 1);
    assert.match(slugGolfe, /^escapade-golfe-1j-[a-z0-9]{5}$/);

    const slugQuiberon = generateEscapadeSlug('Presqu-ile de Quiberon', 3);
    assert.match(slugQuiberon, /^escapade-quiberon-3j-[a-z0-9]{5}$/);

    const slugEtel = generateEscapadeSlug('Ria d-Etel', 2);
    assert.match(slugEtel, /^escapade-ria-etel-2j-[a-z0-9]{5}$/);
  });

  test('generateEscapadeSlug handles accented sectors and custom names', async () => {
    const { generateEscapadeSlug } = await import('../src/lib/escapade/share-service');
    assert.match(generateEscapadeSlug("Presqu'île de Rhuys", 3), /^escapade-rhuys-3j-[a-z0-9]{5}$/);
    assert.match(generateEscapadeSlug("Presqu'île de Quiberon", 1), /^escapade-quiberon-1j-[a-z0-9]{5}$/);
    assert.match(generateEscapadeSlug("Ria d'Étel", 2), /^escapade-ria-etel-2j-[a-z0-9]{5}$/);
    assert.match(generateEscapadeSlug('Carnac & Baie', 2), /^escapade-carnac-baie-2j-[a-z0-9]{5}$/);
  });

  test('POST /api/escapades/share rejects invalid or empty payload with 400', async () => {
    const { POST } = await import('../src/app/api/escapades/share/route');

    // Empty body
    const reqEmpty = new Request('http://localhost:3000/api/escapades/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const resEmpty = await POST(reqEmpty);
    assert.equal(resEmpty.status, 400);

    // Missing days
    const reqNoDays = new Request('http://localhost:3000/api/escapades/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: { baseSector: 'Golfe', durationDays: 1 } }),
    });
    const resNoDays = await POST(reqNoDays);
    assert.equal(resNoDays.status, 400);
  });

  test('POST /api/escapades/share rejects malformed JSON with 400', async () => {
    const { POST } = await import('../src/app/api/escapades/share/route');
    const reqMalformed = new Request('http://localhost:3000/api/escapades/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid-json{{{',
    });
    const resMalformed = await POST(reqMalformed);
    assert.equal(resMalformed.status, 400);
    const data = await resMalformed.json();
    assert.equal(data.error, 'Invalid JSON payload');
  });

  test('POST /api/escapades/share saves valid plan and returns shareable URL', async () => {
    const { POST } = await import('../src/app/api/escapades/share/route');

    const req = new Request('http://localhost:3000/api/escapades/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(MOCK_PLAN),
    });
    const res = await POST(req);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(typeof body.slug === 'string');
    assert.match(body.slug, /^escapade-rhuys-2j-[a-z0-9]{5}$/);
    assert.equal(body.url, `/escapade/${body.slug}`);
  });

  test('saveEscapade and getEscapadeBySlug work with mock Drizzle database', async () => {
    const { saveEscapade, getEscapadeBySlug } = await import('../src/lib/escapade/share-service');

    let insertedRecord: any = null;
    const mockDb = {
      insert: () => ({
        values: (values: any) => {
          insertedRecord = values;
          return Promise.resolve([values]);
        },
      }),
      select: () => ({
        from: () => ({
          where: () => {
            return Promise.resolve(insertedRecord ? [insertedRecord] : []);
          },
        }),
      }),
    };

    const result = await saveEscapade(MOCK_PLAN, mockDb);
    assert.ok(result.slug);
    assert.ok(insertedRecord);
    assert.equal(insertedRecord.slug, result.slug);
    assert.equal(insertedRecord.baseSector, 'Presqu-ile de Rhuys');
    assert.equal(insertedRecord.durationDays, 2);
    assert.deepEqual(insertedRecord.escapadeData, MOCK_PLAN);

    // Verify retrieval via DB
    const fetched = await getEscapadeBySlug(result.slug, mockDb);
    assert.deepEqual(fetched?.profile, MOCK_PLAN.profile);
  });
});

describe('Escapade Persistence & Shared Page (/escapade/[slug])', () => {
  test('Shared escapade page renders EscapadeView with plan details and action buttons', async () => {
    const { saveEscapade } = await import('../src/lib/escapade/share-service');
    const { slug } = await saveEscapade(MOCK_PLAN);

    const EscapadePageModule = await import('../src/app/escapade/[slug]/page');
    const PageComponent = EscapadePageModule.default;

    const pageElement = await PageComponent({
      params: Promise.resolve({ slug }),
    });

    const html = renderToString(pageElement);
    assert.ok(html.includes('Château de Suscinio'), 'Must render plan place name');
    assert.ok(html.includes('Sarzeau'), 'Must render place commune');
    assert.ok(html.includes('Presqu-ile de Rhuys'), 'Must render sector');
    assert.ok(
      html.includes('Créer mon escapade') || html.includes('Personnaliser') || html.includes('dupliquer'),
      'Must render local personalization or duplication CTA'
    );
  });

  test('Shared escapade page generateMetadata provides rich OpenGraph tags', async () => {
    const { saveEscapade } = await import('../src/lib/escapade/share-service');
    const { slug } = await saveEscapade(MOCK_PLAN);

    const { generateMetadata } = await import('../src/app/escapade/[slug]/page');
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug }),
    });

    assert.ok(metadata.title?.toString().includes('Rhuys'));
    assert.ok(metadata.description);
    assert.ok(metadata.openGraph?.title);
  });

  test('Shared escapade page renders not-found fallback for unknown slug', async () => {
    const EscapadePageModule = await import('../src/app/escapade/[slug]/page');
    const PageComponent = EscapadePageModule.default;

    const pageElement = await PageComponent({
      params: Promise.resolve({ slug: 'escapade-inexistante-99999' }),
    });

    const html = renderToString(pageElement);
    assert.ok(
      html.includes('introuvable') || html.includes('inexistante') || html.includes('404'),
      'Must render fallback or not found message'
    );
  });
});
