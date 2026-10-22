import { describe, it } from 'node:test';
import assert from 'node:assert';
import { GET } from '../src/app/api/places/route';

describe('GET /api/places API Route', () => {
  it('returns status 200 with JSON payload containing places', async () => {
    const req = new Request('http://localhost:3000/api/places');
    const res = await GET(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.places));
    assert.ok(body.places.length >= 12);
  });

  it('filters places by category query parameter', async () => {
    const req = new Request('http://localhost:3000/api/places?cat=BEACH');
    const res = await GET(req);
    const body = await res.json();
    assert.ok(body.places.every((p: any) => p.category === 'BEACH'));
  });

  it('sets appropriate Cache-Control headers', async () => {
    const req = new Request('http://localhost:3000/api/places');
    const res = await GET(req);
    assert.ok(res.headers.get('Cache-Control')?.includes('stale-while-revalidate'));
  });
});
