import assert from 'node:assert/strict';
import test from 'node:test';
import { OrderRepository } from '../src/modules/storefront/order.repository.js';
import { VoucherRepository, validatePayload } from '../src/modules/storefront/voucher.repository.js';

const customer = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const product = (allow_deposit, deposit_rate = 50) => ({
  id: customer, name: 'Test', active: true, allow_deposit, deposit_rate,
  variants: [{ id: 'standard', price: 100000, stock_quantity: 10 }],
});
const payload = {
  items: [{ product_id: customer, variant_id: 'standard', quantity: 1 }],
  recipient: { name: 'Test', phone: '0901234567', full_address: 'Test address' },
  payment_method: 'vietqr', payment_mode: 'deposit', deposit_rate: 50,
};

test('deposit respects product settings, minimum rate and COD', async () => {
  let row = product(true);
  const repo = new OrderRepository({ query: async () => ({ rows: [row] }) });
  const quote = await repo.calculateQuote(customer, payload);
  assert.equal(quote.amount_due_now, 65000);
  assert.deepEqual(quote.allowed_deposit_rates, [50, 70]);
  assert.equal(quote.items[0].image_url, '/product-placeholder.svg');
  row = product(true, 70);
  await assert.rejects(repo.calculateQuote(customer, payload), /cọc/);
  assert.equal((await repo.calculateQuote(customer, { ...payload, deposit_rate: 70 })).amount_due_now, 91000);
  row = product(false);
  await assert.rejects(repo.calculateQuote(customer, payload), /cọc/);
  const cod = await repo.calculateQuote(customer, { ...payload, payment_mode: 'full', payment_method: 'cod' });
  assert.equal(cod.amount_due_now, 0);
  assert.equal(cod.total_amount, 130000);
  assert.deepEqual(cod.allowed_deposit_rates, []);
  row = product(true);
  await assert.rejects(repo.calculateQuote(customer, { ...payload, payment_method: 'cod' }), /cọc/);
  await assert.rejects(repo.calculateQuote(customer, { ...payload, deposit_rate: 0.5 }), /cọc/);
});

test('all products in a mixed order must allow the deposit', async () => {
  const db = { query: async (_, [id]) => ({ rows: [product(id === customer)] }) };
  const repo = new OrderRepository(db);
  await assert.rejects(repo.calculateQuote(customer, {
    ...payload, items: [...payload.items, { product_id: other, quantity: 1 }],
  }), /cọc/);
});

test('voucher audience validates recipients and clears them for broadcast', () => {
  const voucher = { code: 'SALE10', name: 'Test', discount_type: 'percentage', discount_value: 10 };
  assert.equal(validatePayload(voucher).audience, 'broadcast');
  assert.deepEqual(validatePayload({ ...voucher, recipient_ids: [customer] }).recipient_ids, []);
  assert.deepEqual(validatePayload({ ...voucher, audience: 'selected', recipient_ids: [customer, customer] }).recipient_ids, [customer]);
  assert.throws(() => validatePayload({ ...voucher, audience: 'selected' }), /ít nhất/);
  assert.throws(() => validatePayload({ ...voucher, audience: 'selected', recipient_ids: ['invalid'] }), /không hợp lệ/);
});

test('voucher availability, manual codes and consumption enforce recipient identity', async () => {
  const queries = [];
  const db = { query: async (sql, params) => {
    queries.push({ sql, params });
    const permitted = params.includes(customer);
    return { rows: permitted ? [{ id: other, code: 'PRIVATE10', discount_type: 'fixed', discount_value: 10000, min_order_amount: 0, max_discount_amount: null }] : [] };
  } };
  const repo = new VoucherRepository(db);
  assert.equal((await repo.calculateDiscount('PRIVATE10', { subtotal: 100000, userId: customer })).discount_amount, 10000);
  await assert.rejects(repo.calculateDiscount('PRIVATE10', { subtotal: 100000, userId: other }), /Voucher/);
  await repo.listAvailable({ userId: customer });
  await repo.consume(other, customer);
  await assert.rejects(repo.consume(other, other), /Voucher/);
  assert.ok(queries.every(({ sql }) => sql.includes('ANY(recipient_ids)')));
});
