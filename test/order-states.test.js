import test from 'node:test';
import assert from 'node:assert/strict';
import { NEXT_STATUS_MAP, ORDER_STATUS_LABELS, OrderRepository } from '../src/modules/storefront/order.repository.js';

test('packing and returns are real order states with valid transitions', () => {
  assert.equal(ORDER_STATUS_LABELS.packed, 'Đã đóng gói');
  assert.equal(ORDER_STATUS_LABELS.returned, 'Hoàn hàng');
  for(const [from,to] of [['confirmed','processing'],['processing','packed'],['packed','shipping'],['shipping','delivered'],['delivered','completed'],['delivered','returned'],['completed','returned']]) {
    assert.ok(NEXT_STATUS_MAP[from].some(next=>next.code===to),`${from} -> ${to}`);
  }
  assert.deepEqual(NEXT_STATUS_MAP.returned, []);
  assert.ok(!NEXT_STATUS_MAP.pending.some(next=>next.code==='completed'));
});

const stages = ['pending', 'confirmed', 'processing', 'packed', 'shipping', 'delivered', 'completed'];

function fixture(status, overrides = {}) {
  let order = { id: 'test-order', status, total_amount: 100000, paid_amount: 100000, shipment: {}, history: [], ...overrides };
  let writes = 0;
  const client = { query: async (sql, values) => {
    if (sql.includes('SELECT * FROM orders')) return { rows: [structuredClone(order)] };
    if (sql.includes('UPDATE orders')) {
      writes++;
      order = { ...order, status: values[0], status_label: values[1], shipment: JSON.parse(values[2]), history: JSON.parse(values[3]), completed_at: values[4], note: values[5] };
    }
    return { rows: [order] };
  } };
  const repo = new OrderRepository({});
  return { update: body => repo.updateAdminOrder(order.id, body, 'Manager', client), writes: () => writes };
}

test('normal stages permit only one step forward or backward', async () => {
  for (let from = 0; from < stages.length; from++) {
    const normalNext = NEXT_STATUS_MAP[stages[from]].filter(item => stages.includes(item.code)).map(item => item.code);
    assert.deepEqual(normalNext.sort(), stages.filter((_, to) => Math.abs(to - from) === 1).sort());
    for (let to = 0; to < stages.length; to++) {
      if (Math.abs(to - from) <= 1) continue;
      const order = fixture(stages[from]);
      await assert.rejects(order.update({ status: stages[to] }), { statusCode: 400 }, `${stages[from]} -> ${stages[to]}`);
      assert.equal(order.writes(), 0);
    }
  }
});

test('a paid order progresses through all stages, retaining shipment and history', async () => {
  const order = fixture('pending');
  let result;
  for (const status of stages.slice(1)) {
    result = await order.update({ status, ...(status === 'shipping' ? { carrier: 'GHN', tracking_number: 'ABC123' } : {}) });
    assert.equal(result.status, status);
  }
  assert.equal(result.shipment.tracking_number, 'ABC123');
  assert.ok(result.shipment.shipped_at);
  assert.ok(result.shipment.delivered_at);
  assert.equal(order.writes(), 6);
});

test('shipping requires a carrier and tracking number', async () => {
  for (const body of [{}, { carrier: 'GHN' }, { carrier: ' ', tracking_number: '123' }, { carrier: 'GHN', tracking_number: ' ' }]) {
    const order = fixture('packed');
    await assert.rejects(order.update({ status: 'shipping', ...body }), { statusCode: 400 });
    assert.equal(order.writes(), 0);
  }
});

test('completion requires full recorded payment', async () => {
  for (const paid_amount of [undefined, 0, 50000, '99999']) {
    const order = fixture('delivered', { paid_amount });
    await assert.rejects(order.update({ status: 'completed' }), { statusCode: 400 });
    assert.equal(order.writes(), 0);
  }
});

test('cancellation and returns require a reason and remain terminal for fulfillment', async () => {
  for (const [from, status] of [['pending', 'cancelled'], ['processing', 'cancelled'], ['packed', 'cancelled'], ['delivered', 'returned'], ['completed', 'returned']]) {
    const order = fixture(from);
    await assert.rejects(order.update({ status, note: ' ' }), { statusCode: 400 });
    assert.equal(order.writes(), 0);
    const result = await order.update({ status, note: 'Customer request / inspected returned goods' });
    assert.equal(result.status, status);
    assert.deepEqual(result.allowed_next_statuses, []);
    await assert.rejects(order.update({ status: 'shipping' }), { statusCode: 400 });
  }
});

test('each normal stage can move back exactly one step without changing payment or losing history', async () => {
  for (let index = 1; index < stages.length; index++) {
    const order = fixture(stages[index], { completed_at: '2026-01-01', shipment: { carrier: 'GHN', tracking_number: '123', shipped_at: '2026-01-01' } });
    const result = await order.update({ status: stages[index - 1] });
    assert.equal(result.status, stages[index - 1]);
    assert.equal(result.paid_amount, 100000);
    assert.equal(result.completed_at, null);
    assert.equal(result.history.at(-1).status, stages[index - 1]);
    assert.equal(result.shipment.tracking_number, '123');
  }
});

test('shipped orders cannot be cancelled, including after moving back to an earlier stage', async () => {
  for (const status of ['shipping', 'delivered', 'completed', 'packed', 'processing', 'confirmed', 'pending']) {
    const order = fixture(status, { shipment: { carrier: 'GHN', tracking_number: '123', shipped_at: '2026-01-01' } });
    await assert.rejects(order.update({ status: 'cancelled', note: 'Cancel request' }), { statusCode: 400 });
    assert.equal(order.writes(), 0);
  }
});

test('customer cannot cancel an order moved back after shipment', async () => {
  const repo = new OrderRepository({});
  const client = { query: async () => ({ rows: [{ status: 'pending', shipment: { shipped_at: '2026-01-01' } }] }) };
  await assert.rejects(repo.cancelOrder('customer', 'order', 'Cancel request', client), { statusCode: 400 });
});
