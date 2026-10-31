import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import productRoutes from '../src/routes/product.routes.js';
import catalogRepository, { CatalogRepository } from '../src/modules/catalog/catalog.repository.js';

test('featured endpoint is distinct from product detail and always requests five pinned products', async () => {
  const original = catalogRepository.findAllCustomer;
  const calls = [];
  catalogRepository.findAllCustomer = async options => {
    calls.push(options);
    return { items: [], filters: {}, pagination: { page: options.page, limit: options.limit, total: 12, total_pages: 3 } };
  };
  const app = express();
  app.use('/api/v1/products', productRoutes);
  const server = app.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}/api/v1/products/featured`;
    const response = await fetch(`${base}?page=2&limit=100&is_pinned=false`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.status, 'success');
    assert.deepEqual(calls[0], { page: 2, limit: 5, is_pinned: true });
    assert.equal(body.pagination.total_pages, 3);
    await fetch(`${base}?page=-2`);
    assert.equal(calls[1].page, 1);
  } finally {
    catalogRepository.findAllCustomer = original;
    await new Promise(resolve => server.close(resolve));
  }
});

test('featured query filters active pinned products and paginates in a deterministic order', async () => {
  const queries = [];
  const repo = new CatalogRepository({ query: async (sql, values) => {
    queries.push({ sql, values: [...(values || [])] });
    if (sql.includes('COUNT(*)')) return { rows: [{ total: '12' }] };
    if (sql.includes('MIN(price)')) return { rows: [{ min_p: 1, max_p: 100 }] };
    return { rows: [] };
  } });
  const result = await repo.findAllCustomer({ is_pinned: true, page: 2, limit: 5 });
  const dataQuery = queries.at(-1);
  assert.match(dataQuery.sql, /p\.active = TRUE/);
  assert.match(dataQuery.sql, /p\.is_pinned = \$1 OR p\.featured = \$1/);
  assert.match(dataQuery.sql, /ORDER BY .*p\.created_at DESC, p\.id ASC/);
  assert.deepEqual(dataQuery.values, [true, 5, 5]);
  assert.deepEqual(result.pagination, { page: 2, limit: 5, total: 12, total_pages: 3 });
});
