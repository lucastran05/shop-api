import test from 'node:test';
import assert from 'node:assert/strict';
import catalogRepository from '../src/modules/catalog/catalog.repository.js';

// Client giả: trả kết quả theo từng loại câu SQL
function fakeClient({ reviewed = false, orders = [], insertRows = null } = {}) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push(sql);
      if (/SELECT id FROM reviews WHERE product_id/.test(sql))
        return reviewed ? { rowCount: 1, rows: [{ id: 'r1' }] } : { rowCount: 0, rows: [] };
      if (/FROM orders o/.test(sql)) return { rowCount: orders.length, rows: orders };
      if (/INSERT INTO reviews/.test(sql)) {
        const rows = insertRows ?? [{ id: 'new', product_id: params[0], rating: params[2], content: params[3], images: [], created_at: 'now' }];
        return { rowCount: rows.length, rows };
      }
      if (/FROM users/.test(sql)) return { rowCount: 1, rows: [{ id: params[0], name: 'Lan' }] };
      if (/COUNT\(\*\)/.test(sql)) return { rowCount: 1, rows: [{ total: 1, avg_rating: '5.0' }] };
      return { rowCount: 0, rows: [] };
    },
  };
}

test('chưa mua hoặc chưa nhận hàng thì không được đánh giá', async () => {
  let result = await catalogRepository.checkReviewEligibility('p1', 'u1', fakeClient());
  assert.equal(result.reason, 'not_purchased');
  result = await catalogRepository.checkReviewEligibility('p1', 'u1', fakeClient({ orders: [{ status: 'shipping' }] }));
  assert.equal(result.reason, 'not_delivered');
  await assert.rejects(
    catalogRepository.createReview('p1', 'u1', { rating: 5 }, fakeClient()),
    { statusCode: 403, reason: 'not_purchased' },
  );
});

test('đã nhận hàng thì đánh giá được một lần', async () => {
  const client = fakeClient({ orders: [{ status: 'completed' }] });
  const eligibility = await catalogRepository.checkReviewEligibility('p1', 'u1', client);
  assert.equal(eligibility.can_review, true);
  const { review } = await catalogRepository.createReview('p1', 'u1', { rating: 4, content: 'Đẹp' }, client);
  assert.equal(review.id, 'new');
});

test('đã đánh giá rồi thì không được đánh giá lại', async () => {
  const client = fakeClient({ reviewed: true, orders: [{ status: 'completed' }] });
  const eligibility = await catalogRepository.checkReviewEligibility('p1', 'u1', client);
  assert.deepEqual(
    { can_review: eligibility.can_review, reason: eligibility.reason, review_id: eligibility.review_id },
    { can_review: false, reason: 'already_reviewed', review_id: 'r1' },
  );
  await assert.rejects(
    catalogRepository.createReview('p1', 'u1', { rating: 5 }, client),
    { statusCode: 409, reason: 'already_reviewed' },
  );
  assert.ok(!client.calls.some((sql) => /INSERT INTO reviews/.test(sql)));
});

test('hai yêu cầu gửi cùng lúc: yêu cầu không chèn được dòng nào bị từ chối', async () => {
  const client = fakeClient({ orders: [{ status: 'delivered' }], insertRows: [] });
  await assert.rejects(
    catalogRepository.createReview('p1', 'u1', { rating: 5 }, client),
    { statusCode: 409, reason: 'already_reviewed' },
  );
});
