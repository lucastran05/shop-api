// Kiểm tra tính toàn vẹn của dữ liệu demo (khách @demo.abcshop.vn và các sản phẩm của họ).
// Chạy riêng: docker compose exec api npm run seed:check
// Mỗi kiểm tra là một câu SQL đếm số bản ghi vi phạm; 0 là đạt.
import { pathToFileURL } from 'node:url';

const DEMO = "SELECT id FROM users WHERE email LIKE '%@demo.abcshop.vn'";
const DEMO_ORDERS = `SELECT * FROM orders WHERE user_id IN (${DEMO})`;

const CHECKS = {
  // --- Người mua và thời gian
  'đơn của user không tồn tại / không phải khách':
    `SELECT count(*) FROM (${DEMO_ORDERS}) o LEFT JOIN users u ON u.id = o.user_id WHERE u.id IS NULL OR u.role <> 'customer'`,
  'đơn đặt trước khi người mua đăng ký':
    `SELECT count(*) FROM (${DEMO_ORDERS}) o JOIN users u ON u.id = o.user_id WHERE o.created_at < u.created_at`,
  'địa chỉ giao không phải địa chỉ của người mua':
    `SELECT count(*) FROM (${DEMO_ORDERS}) o WHERE o.delivery_method <> 'pickup'
       AND NOT EXISTS (SELECT 1 FROM user_addresses a WHERE a.user_id = o.user_id AND a.full_address = o.recipient->>'full_address')`,
  'địa chỉ mặc định không thuộc user':
    `SELECT count(*) FROM users u WHERE u.id IN (${DEMO}) AND u.default_address_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM user_addresses a WHERE a.id = u.default_address_id AND a.user_id = u.id)`,
  'mốc thời gian ở tương lai':
    `SELECT count(*) FROM (${DEMO_ORDERS}) o WHERE o.created_at > now() OR o.updated_at > now() OR o.completed_at > now()`,

  // --- Dòng hàng và tiền
  'dòng hàng trỏ sản phẩm/biến thể không tồn tại':
    `SELECT count(*) FROM order_items i JOIN (${DEMO_ORDERS}) o ON o.id = i.order_id LEFT JOIN products p ON p.id = i.product_id
       WHERE p.id IS NULL OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p.variants) v WHERE v->>'id' = i.variant_id)`,
  'mua sản phẩm trước khi sản phẩm được tạo':
    `SELECT count(*) FROM order_items i JOIN (${DEMO_ORDERS}) o ON o.id = i.order_id JOIN products p ON p.id = i.product_id WHERE o.created_at < p.created_at`,
  'đơn giá khác giá biến thể':
    `SELECT count(*) FROM order_items i JOIN (${DEMO_ORDERS}) o ON o.id = i.order_id JOIN products p ON p.id = i.product_id,
       jsonb_array_elements(p.variants) v WHERE v->>'id' = i.variant_id AND (v->>'price')::numeric <> i.unit_price`,
  'thành tiền dòng sai':
    `SELECT count(*) FROM order_items i JOIN (${DEMO_ORDERS}) o ON o.id = i.order_id WHERE i.line_total <> i.unit_price * i.quantity`,
  'tạm tính khác tổng các dòng':
    `SELECT count(*) FROM (${DEMO_ORDERS}) o WHERE o.subtotal <> (SELECT coalesce(sum(line_total), 0) FROM order_items WHERE order_id = o.id)`,
  'tổng tiền khác tạm tính + ship - giảm giá':
    `SELECT count(*) FROM (${DEMO_ORDERS}) o WHERE o.total_amount <> o.subtotal + o.shipping_fee - o.discount_amount`,
  'đã thu khác tổng các lần xác nhận thanh toán':
    `SELECT count(*) FROM (${DEMO_ORDERS}) o WHERE o.paid_amount <> (SELECT coalesce(sum(amount), 0) FROM payment_confirmations WHERE order_id = o.id)`,
  'đã hoàn khác tổng các lần hoàn tiền':
    `SELECT count(*) FROM (${DEMO_ORDERS}) o WHERE o.refunded_amount <> (SELECT coalesce(sum(amount), 0) FROM refunds WHERE order_id = o.id)`,
  'đơn hủy/hoàn hàng còn giữ tiền của khách':
    `SELECT count(*) FROM (${DEMO_ORDERS}) o WHERE o.status IN ('cancelled', 'returned') AND o.paid_amount > o.refunded_amount`,
  'hoàn thành nhưng chưa thu đủ tiền':
    `SELECT count(*) FROM (${DEMO_ORDERS}) o WHERE o.status = 'completed' AND o.paid_amount < o.total_amount`,
  'phiên thanh toán thành công không có lần xác nhận tương ứng':
    `SELECT count(*) FROM payment_sessions s JOIN (${DEMO_ORDERS}) o ON o.id = s.order_id WHERE s.status = 'succeeded'
       AND NOT EXISTS (SELECT 1 FROM payment_confirmations c WHERE c.order_id = o.id AND c.amount = s.amount AND c.kind = s.purpose)`,
  'đơn online đã trả nhưng không có phiên thanh toán':
    `SELECT count(*) FROM (${DEMO_ORDERS}) o WHERE o.payment_method <> 'cod' AND o.paid_amount > 0
       AND NOT EXISTS (SELECT 1 FROM payment_sessions s WHERE s.order_id = o.id AND s.status = 'succeeded')`,

  // --- Quy trình đơn
  'lịch sử đơn không theo thứ tự thời gian':
    `SELECT count(*) FROM (${DEMO_ORDERS}) o WHERE (o.history->0->>'created_at')::timestamptz <> o.created_at
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(o.history) WITH ORDINALITY a(e, n)
                  JOIN jsonb_array_elements(o.history) WITH ORDINALITY b(e, n) ON b.n = a.n + 1
                  WHERE (b.e->>'created_at')::timestamptz < (a.e->>'created_at')::timestamptz)`,
  'trạng thái cuối khác lịch sử đơn':
    `SELECT count(*) FROM (${DEMO_ORDERS}) o WHERE o.history->-1->>'status' <> o.status
       AND NOT (o.status = 'confirmed' AND o.history->-1->>'status' = 'pending' AND o.paid_amount > 0)`,
  'đã giao đi nhưng thiếu vận đơn / thời điểm giao':
    `SELECT count(*) FROM (${DEMO_ORDERS}) o WHERE o.history @> '[{"status":"shipping"}]'
       AND (coalesce(o.shipment->>'carrier', '') = '' OR coalesce(o.shipment->>'tracking_number', '') = '' OR o.shipment->>'shipped_at' IS NULL)`,
  'completed_at không khớp trạng thái hoàn thành':
    `SELECT count(*) FROM (${DEMO_ORDERS}) o WHERE (o.status = 'completed') <> (o.completed_at IS NOT NULL)`,

  // --- Kho, voucher, đánh giá
  'tồn kho khác tổng các biến thể':
    `SELECT count(*) FROM products p WHERE p.id IN (SELECT product_id FROM order_items WHERE order_id IN (SELECT id FROM (${DEMO_ORDERS}) x))
       AND p.stock <> (SELECT coalesce(sum(coalesce((v->>'stock_quantity')::int, (v->>'stock')::int)), 0) FROM jsonb_array_elements(p.variants) v)`,
  'tồn kho khác (nhập kho - đã bán)':
    `SELECT count(*) FROM products p WHERE p.id IN (SELECT product_id FROM order_items WHERE order_id IN (SELECT id FROM (${DEMO_ORDERS}) x))
       AND p.stock <> (SELECT coalesce(sum(delta), 0) FROM inventory_adjustments WHERE product_id = p.id)
                     - (SELECT coalesce(sum(i.quantity), 0) FROM order_items i JOIN orders o ON o.id = i.order_id
                        WHERE i.product_id = p.id AND o.status <> 'cancelled')`,
  'lượt dùng voucher khác số đơn đã dùng':
    `SELECT count(*) FROM vouchers v WHERE EXISTS (SELECT 1 FROM (${DEMO_ORDERS}) o WHERE o.coupon->>'id' = v.id::text)
       AND v.used_count <> (SELECT count(*) FROM orders o WHERE o.coupon->>'id' = v.id::text)`,
  'dùng voucher ngoài thời hạn':
    `SELECT count(*) FROM (${DEMO_ORDERS}) o JOIN vouchers v ON v.id::text = o.coupon->>'id'
       WHERE o.created_at < v.starts_at OR o.created_at > v.expires_at`,
  'đánh giá khi chưa nhận hàng':
    `SELECT count(*) FROM reviews r WHERE r.user_id IN (${DEMO}) AND NOT EXISTS (
       SELECT 1 FROM orders o JOIN order_items i ON i.order_id = o.id
       WHERE o.user_id = r.user_id AND i.product_id = r.product_id AND o.status = 'completed' AND o.completed_at <= r.created_at)`,
  'tin nhắn của người gửi không tồn tại':
    `SELECT count(*) FROM chat_messages m WHERE m.owner IN (SELECT email FROM users WHERE id IN (${DEMO}))
       AND m.sender_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = m.sender_id)`,
};

export async function checkIntegrity(db) {
  const problems = [];
  for (const [name, sql] of Object.entries(CHECKS)) {
    const count = Number((await db.query(sql)).rows[0].count);
    if (count > 0) problems.push(`${name}: ${count}`);
  }
  return problems;
}

// Chạy trực tiếp: in kết quả từng kiểm tra
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await import('dotenv/config');
  const { default: pool } = await import('../src/config/db.js');
  try {
    const demoOrders = Number((await pool.query(`SELECT count(*) FROM (${DEMO_ORDERS}) o`)).rows[0].count);
    const problems = await checkIntegrity(pool);
    console.log(`Đã kiểm tra ${Object.keys(CHECKS).length} ràng buộc trên ${demoOrders} đơn demo.`);
    console.log(problems.length ? problems.join('\n') : 'Đạt toàn bộ.');
    process.exitCode = problems.length ? 1 : 0;
  } finally {
    await pool.end();
  }
}
