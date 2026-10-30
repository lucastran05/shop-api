import test from 'node:test';
import assert from 'node:assert/strict';
import { NEXT_STATUS_MAP, ORDER_STATUS_LABELS } from '../src/modules/storefront/order.repository.js';

test('packing and returns are real order states with valid transitions', () => {
  assert.equal(ORDER_STATUS_LABELS.packed, 'Đã đóng gói');
  assert.equal(ORDER_STATUS_LABELS.returned, 'Hoàn hàng');
  for(const [from,to] of [['confirmed','processing'],['processing','packed'],['packed','shipping'],['shipping','delivered'],['delivered','completed'],['delivered','returned'],['completed','returned']]) {
    assert.ok(NEXT_STATUS_MAP[from].some(next=>next.code===to),`${from} -> ${to}`);
  }
  assert.deepEqual(NEXT_STATUS_MAP.returned, []);
  assert.ok(!NEXT_STATUS_MAP.pending.some(next=>next.code==='completed'));
});
