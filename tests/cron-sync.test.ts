import test from 'node:test';
import assert from 'node:assert/strict';
import { GET, POST, dynamic, maxDuration } from '../src/app/api/cron/sync/route';
import { handleSync } from '../src/app/api/cron/sync/handler';

test('route config exports dynamic=force-dynamic and maxDuration=60', () => {
  assert.equal(dynamic, 'force-dynamic');
  assert.equal(maxDuration, 60);
});

test('GET /api/cron/sync returns 401 Unauthorized when Bearer token is missing', async () => {
  process.env.CRON_SECRET = 'test-secret-token-123';
  const req = new Request('http://localhost:3000/api/cron/sync');
  const res = await GET(req);

  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.error, 'Unauthorized: Invalid or missing cron secret');
});

test('GET /api/cron/sync returns 401 when Bearer token is incorrect', async () => {
  process.env.CRON_SECRET = 'test-secret-token-123';
  const req = new Request('http://localhost:3000/api/cron/sync', {
    headers: { Authorization: 'Bearer wrong-secret' },
  });
  const res = await GET(req);

  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.error, 'Unauthorized: Invalid or missing cron secret');
});

test('GET /api/cron/sync returns 401 when CRON_SECRET is not configured in env', async () => {
  const previous = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;
  try {
    const req = new Request('http://localhost:3000/api/cron/sync', {
      headers: { Authorization: 'Bearer test-secret-token-123' },
    });
    const res = await GET(req);
    assert.equal(res.status, 401);
  } finally {
    process.env.CRON_SECRET = previous;
  }
});

test('GET /api/cron/sync accepts valid Bearer token and triggers job', async () => {
  process.env.CRON_SECRET = 'test-secret-token-123';

  // Test avec job inconnu ou paramétrage spécifique
  const req = new Request('http://localhost:3000/api/cron/sync?job=none', {
    headers: { Authorization: 'Bearer test-secret-token-123' },
  });
  const res = await GET(req);

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.timestamp);
  assert.equal(typeof data.durationMs, 'number');
});

test('GET /api/cron/sync accepts token via query parameter', async () => {
  process.env.CRON_SECRET = 'test-secret-token-123';

  const req = new Request('http://localhost:3000/api/cron/sync?job=none&token=test-secret-token-123');
  const res = await GET(req);

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
});

test('POST /api/cron/sync functions identically to GET', async () => {
  process.env.CRON_SECRET = 'test-secret-token-123';

  const req = new Request('http://localhost:3000/api/cron/sync?job=none', {
    method: 'POST',
    headers: { Authorization: 'Bearer test-secret-token-123' },
  });
  const res = await POST(req);

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
});

test('handleSync runs weather job when ?job=weather', async () => {
  process.env.CRON_SECRET = 'test-secret-token-123';

  let weatherCalled = false;
  let osmCalled = false;

  const mockDeps = {
    weatherSync: async () => {
      weatherCalled = true;
      return { success: true, sectorsUpdated: 6, sectorsFailed: 0, errors: [] };
    },
    osmSync: async () => {
      osmCalled = true;
      return { success: true, totalParsed: 10, slipwaysUpserted: 2, amenitiesUpserted: 8, errors: [] };
    },
  };

  const req = new Request('http://localhost:3000/api/cron/sync?job=weather', {
    headers: { Authorization: 'Bearer test-secret-token-123' },
  });

  const res = await handleSync(req, mockDeps);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(weatherCalled, true);
  assert.equal(osmCalled, false);
  assert.ok(data.jobs.weather);
  assert.equal(data.jobs.osm, undefined);
});

test('handleSync runs osm job when ?job=osm', async () => {
  process.env.CRON_SECRET = 'test-secret-token-123';

  let weatherCalled = false;
  let osmCalled = false;

  const mockDeps = {
    weatherSync: async () => {
      weatherCalled = true;
      return { success: true, sectorsUpdated: 6, sectorsFailed: 0, errors: [] };
    },
    osmSync: async () => {
      osmCalled = true;
      return { success: true, totalParsed: 10, slipwaysUpserted: 2, amenitiesUpserted: 8, errors: [] };
    },
  };

  const req = new Request('http://localhost:3000/api/cron/sync?job=osm', {
    headers: { Authorization: 'Bearer test-secret-token-123' },
  });

  const res = await handleSync(req, mockDeps);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(weatherCalled, false);
  assert.equal(osmCalled, true);
  assert.equal(data.jobs.weather, undefined);
  assert.ok(data.jobs.osm);
});

test('handleSync returns 207 Multi-Status when a job reports partial failure', async () => {
  process.env.CRON_SECRET = 'test-secret-token-123';

  const mockDeps = {
    weatherSync: async () => {
      return { success: true, sectorsUpdated: 6, sectorsFailed: 0, errors: [] };
    },
    osmSync: async () => {
      return { success: false, totalParsed: 5, slipwaysUpserted: 1, amenitiesUpserted: 0, errors: ['Error'] };
    },
  };

  const req = new Request('http://localhost:3000/api/cron/sync?job=all', {
    headers: { Authorization: 'Bearer test-secret-token-123' },
  });

  const res = await handleSync(req, mockDeps);
  assert.equal(res.status, 207);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.ok(data.jobs.weather);
  assert.ok(data.jobs.osm);
});

test('handleSync isolates unexpected exception in sub-job and returns 207 Multi-Status', async () => {
  process.env.CRON_SECRET = 'test-secret-token-123';

  const mockDeps = {
    weatherSync: async () => {
      throw new Error('Fatal network timeout during Open-Meteo fetch');
    },
    osmSync: async () => {
      return { success: true, totalParsed: 10, slipwaysUpserted: 2, amenitiesUpserted: 8, errors: [] };
    },
  };

  const req = new Request('http://localhost:3000/api/cron/sync?job=all', {
    headers: { Authorization: 'Bearer test-secret-token-123' },
  });

  const res = await handleSync(req, mockDeps);
  assert.equal(res.status, 207);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.equal(data.jobs.weather.success, false);
  assert.equal(data.jobs.weather.error, 'Fatal network timeout during Open-Meteo fetch');
  assert.equal(data.jobs.osm.success, true);
});
