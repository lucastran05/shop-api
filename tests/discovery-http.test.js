import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import discoveryRoutes from '../src/modules/discovery/routes.js';
import service from '../src/modules/discovery/service.js';

test('public Discovery routes validate input and return service data', async () => {
  const oldRails = service.rails;
  const oldWorld = service.world;
  service.rails = async () => ({ rails: [], catalogEmpty: true });
  service.world = async (input) => ({ mode: 'fallback', input });
  const app = express();
  app.use(express.json());
  app.use('/api/v1/discovery', discoveryRoutes);
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ status: 'error' }));
  const server = await new Promise((resolve) => {
    const current = app.listen(0, '127.0.0.1', () => resolve(current));
  });
  try {
    const base = 'http://127.0.0.1:' + server.address().port + '/api/v1/discovery';
    const rails = await fetch(base + '/rails');
    assert.equal(rails.status, 200);
    assert.equal((await rails.json()).data.catalogEmpty, true);
    const invalid = await fetch(base + '/interpret', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: 'x' }),
    });
    assert.equal(invalid.status, 400);
    const tooLong = await fetch(base + '/interpret', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: 'x'.repeat(501) }),
    });
    assert.equal(tooLong.status, 400);
    const valid = await fetch(base + '/interpret', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: 'Cảm ơn mẹ' }),
    });
    assert.equal(valid.status, 200);
    assert.equal((await valid.json()).data.input, 'Cảm ơn mẹ');
    for (let i = 0; i < 17; i++) {
      const response = await fetch(base + '/interpret', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: 'Cảm ơn mẹ' }),
      });
      assert.equal(response.status, 200);
    }
    const limited = await fetch(base + '/interpret', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: 'Cảm ơn mẹ' }),
    });
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get('Retry-After')) > 0);
    const privateResponse = await fetch(base + '/preferences');
    assert.equal(privateResponse.status, 401);
  } finally {
    service.rails = oldRails;
    service.world = oldWorld;
    await new Promise((resolve) => server.close(resolve));
  }
});
