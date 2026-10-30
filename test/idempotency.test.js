import assert from 'node:assert/strict';
import test from 'node:test';
import { withIdempotency } from '../src/config/idempotency.js';

test('a repeated request returns its result once; reusing its key for another payload fails', async () => {
  let saved, effects = 0;
  const client = { query: async (sql, values) => {
    if (sql.startsWith('SELECT request_hash')) return { rows: saved ? [saved] : [] };
    if (sql.startsWith('INSERT')) saved = { request_hash: values[3], response: JSON.parse(values[4]) };
    return { rows: [] };
  } };
  const request = { actorId: 'customer', key: 'request-1', operation: 'inventory:adjust', payload: { delta: 3 } };
  const work = async () => ({ stock: effects += 3 });
  assert.deepEqual(await withIdempotency(client, request, work), { stock: 3 });
  assert.deepEqual(await withIdempotency(client, request, work), { stock: 3 });
  await assert.rejects(withIdempotency(client, { ...request, payload: { delta: 9 } }, work), error => error.statusCode === 409);
  assert.equal(effects, 3);
});

test('invalid keys are rejected and a failed operation is never stored', async () => {
  let inserts = 0;
  const client = { query: async (sql) => { if (sql.startsWith('INSERT')) inserts++; return { rows: [] }; } };
  const request = { actorId: 'customer', key: 'valid-key', operation: 'order:create', payload: {} };
  await assert.rejects(withIdempotency(client, { ...request, key: '' }, async () => null), error => error.statusCode === 400);
  await assert.rejects(withIdempotency(client, request, async () => { throw new Error('Insufficient stock'); }), /Insufficient stock/);
  assert.equal(inserts, 0);
  assert.equal(await withIdempotency(client, { ...request, key: undefined }, async () => 'legacy request'), 'legacy request');
});
