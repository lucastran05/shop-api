import test from 'node:test';
import assert from 'node:assert/strict';
import { getProductPricing } from '../src/modules/catalog/productPricing.js';
import ProductController from '../src/controllers/product.controller.js';
import catalogRepository, { CatalogRepository } from '../src/modules/catalog/catalog.repository.js';
import { OrderRepository } from '../src/modules/storefront/order.repository.js';

test('summary price and original price belong to the same cheapest variant', () => {
  assert.deepEqual(getProductPricing([{ price: 200000, old_price: 400000 }, { price: 100000, old_price: 150000 }]), { price: 100000, old_price: 150000 });
  assert.deepEqual(getProductPricing([{ price: 200000, old_price: 400000 }, { price: 100000 }]), { price: 100000, old_price: null });
  assert.deepEqual(getProductPricing([{ price: '100000', old_price: null }]), { price: 100000, old_price: null });
  assert.deepEqual(getProductPricing([{ price: 0, old_price: 100000 }]), { price: 0, old_price: 100000 });
});

test('API rejects invalid prices and original prices that do not exceed the selling price', () => {
  for (const old_price of [-1, 0, 100000, Infinity, 'invalid', true, [200000]]) {
    assert.throws(() => getProductPricing([{ price: 100000, old_price }]), { statusCode: 400 });
  }
  for (const price of [-1, Infinity, undefined, null, '', ' ', true, [100000]]) {
    assert.throws(() => getProductPricing([{ price }]), { statusCode: 400 });
  }
  assert.throws(() => getProductPricing([]), { statusCode: 400 });
});

test('checkout charges the selling price rather than the displayed original price', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const repo = new OrderRepository({ query: async () => ({ rows: [{
    id, name: 'Test', active: true, allow_deposit: false,
    variants: [{ id: 'standard', price: 100000, old_price: 150000, stock_quantity: 10 }],
  }] }) });
  const quote = await repo.calculateQuote(id, {
    items: [{ product_id: id, variant_id: 'standard', quantity: 1 }],
    recipient: { name: 'Test', phone: '0901234567', full_address: 'Test address' },
    payment_method: 'cod', payment_mode: 'full',
  });
  assert.equal(quote.items[0].unit_price, 100000);
  assert.equal(quote.subtotal, 100000);
});

test('repository persists snake_case original price and supports explicitly clearing it', async () => {
  const values = [];
  const repo = new CatalogRepository({ query: async (_, params) => { values.push(params); return { rows: [{ id: 'test' }] }; } });
  await repo.create({ name: 'Test', price: 100000, old_price: 150000 });
  assert.equal(values.at(-1)[5], 150000);
  await repo.create({ name: 'Test', price: 100000, oldPrice: null, old_price: 150000 });
  assert.equal(values.at(-1)[5], null);
});

test('create and update synchronize displayed prices, including clearing an original price', async () => {
  const originals = { create: catalogRepository.create, update: catalogRepository.update, findById: catalogRepository.findById, findDetailFormatted: catalogRepository.findDetailFormatted };
  let created, updated;
  catalogRepository.create = async value => { created = value; return { id: 'test' }; };
  catalogRepository.update = async (_, value) => { updated = value; };
  catalogRepository.findById = async () => ({ id: 'test', stock: 0 });
  catalogRepository.findDetailFormatted = async () => ({ id: 'test' });
  const res = { status() { return this; }, json(value) { return value; } };
  const next = error => { throw error; };
  try {
    await ProductController.create({ body: { name: 'Test', variants: [{ price: 100000, old_price: 150000, stock_quantity: 0 }] } }, res, next);
    assert.equal(created.price, 100000);
    assert.equal(created.old_price, 150000);
    await ProductController.update({ params: { id: 'test' }, body: { variants: [{ price: 120000, old_price: null, stock_quantity: 0 }] } }, res, next);
    assert.equal(updated.price, 120000);
    assert.equal(updated.old_price, null);
  } finally {
    Object.assign(catalogRepository, originals);
  }
});
