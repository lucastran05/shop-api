import { test } from 'node:test';
import assert from 'node:assert/strict';
import pool, { initDB } from '../src/config/db.js';

test('initDB propagates connection failures and reports nested connection errors', async (t) => {
  const failure = Object.assign(new Error('connect ECONNREFUSED'), {
    code: 'ECONNREFUSED', address: '127.0.0.1', port: 5432,
  });
  const error = new AggregateError([failure]);
  t.mock.method(pool, 'connect', async () => { throw error; });
  const log = t.mock.method(console, 'error', () => {});

  await assert.rejects(initDB(), (actual) => actual === error);
  assert.match(log.mock.calls[0].arguments.join(' '), /ECONNREFUSED.*127\.0\.0\.1.*5432/);
});

test('initDB releases its client when schema initialization fails', async (t) => {
  const error = new Error('schema initialization failed');
  const release = t.mock.fn();
  t.mock.method(pool, 'connect', async () => ({
    query: async () => { throw error; },
    release,
  }));
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'error', () => {});

  await assert.rejects(initDB(), (actual) => actual === error);
  assert.equal(release.mock.callCount(), 1);
});
