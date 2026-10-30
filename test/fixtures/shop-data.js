import { createHash, randomBytes } from 'node:crypto';
import { hashPassword } from '../../src/utils/password.js';
import { PROVINCES, WARDS } from '../../src/constants/locations.js';

export async function createTestData(now = new Date()) {
  let sequence = 0;
  const id = () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
  const at = days => new Date(now.getTime() + days * 86400000).toISOString();
  const longEmail = `${'e'.repeat(64)}@${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(57)}.test`;
  const users = [];
  for (const [index, role] of ['admin', 'manager', 'staff', 'customer', 'customer', 'customer'].entries()) {
    users.push({
      id: id(), name: index === 4 ? 'Đ'.repeat(100) : index === 5 ? 'A' : ['Quản trị QA', 'Quản lý QA', 'Nhân viên QA', "Nguyễn An & O’Connor"][index],
      email: index === 4 ? longEmail : `qa-${role}-${index}@example.test`,
      password: await hashPassword(randomBytes(24).toString('hex').slice(0, index === 5 ? 6 : 48)),
      role, active: index !== 5, phone: index === 4 ? null : '', address: '', avatar: null,
    });
  }
  const [admin, manager, , customer, boundary] = users;
  const categories = ['Áo & thời trang', 'Balo – phụ kiện', 'A', 'D'.repeat(255)].map(name => ({ id: id(), name }));
  const uploads = [
    { id: id(), url: '/qa-fixtures/ao-xanh.webp', file_name: 'Áo xanh & mẫu 01.webp', mime_type: 'image/webp', size_bytes: 2048, purpose: 'product' },
    { id: id(), url: '/qa-fixtures/balo.webp', file_name: `${'a'.repeat(250)}.webp`, mime_type: 'image/webp', size_bytes: 1024, purpose: 'product' },
  ];
  const specs = [
    ['Áo thun xanh – Cà phê ☕', 0, '130000.00', [20, 15], 50],
    ['Balo đi học chống nước', 1, '350000.00', [10], 70],
    ['A', 2, '0.00', [0], 0],
    ['S'.repeat(255), 1, '9999999999999.99', [1], 0],
    ['Mẫu giá nhỏ nhất', 2, '0.01', [1], 0],
    ['Sản phẩm ngừng bán', 0, '199000.00', [], 0],
  ];
  const products = specs.map(([name, category, price, stocks, depositRate], index) => ({
    id: id(), name, category_id: categories[category].id, category: categories[category].name,
    description: index === 2 ? '' : "Dữ liệu QA: tiếng Việt, 日本語, emoji 🌿, dấu ' và \" & < >.",
    price, old_price: index === 0 ? '169000.00' : null,
    stock: stocks.reduce((sum, stock) => sum + stock, 0),
    image: uploads[index % 2].url, images: index === 2 ? [] : [uploads[index % 2]],
    variants: stocks.map((stock, variant) => ({ id: id(), label: variant ? 'L' : 'M', color: variant ? 'Trắng' : 'Xanh lá', price: variant ? 150000 : Number(price), stock_quantity: stock, image: variant ? '' : uploads[index % 2].url })),
    attributes: index === 2 ? [] : [{ name: 'Chất liệu', value: 'Cotton & sợi tái chế' }],
    active: index !== 5, featured: index === 0, is_pinned: index === 0,
    deposit: depositRate > 0, allow_deposit: depositRate > 0, deposit_rate: depositRate,
  }));
  const user_addresses = [customer, boundary].flatMap((user, index) => {
    const province = PROVINCES[index];
    const ward = WARDS.find(row => row.province_code === province.code);
    return [true, false].map(is_default => ({
      id: id(), user_id: user.id, recipient_name: is_default ? user.name : 'Trần Bình', recipient_phone: '0900000000',
      province_code: province.code, province_name: province.name, ward_code: ward.code, ward_name: ward.name,
      street_address: "12/3 Đường số 4, lầu 2 – cửa 'A'", full_address: `12/3 Đường số 4, ${ward.name}, ${province.name}`, is_default,
    }));
  });
  for (const user of [customer, boundary]) user.default_address_id = user_addresses.find(a => a.user_id === user.id && a.is_default).id;
  const vouchers = [
    { code: 'QA10', name: 'Giảm 10% toàn cửa hàng', discount_type: 'percentage', discount_value: 10, min_order_amount: 100000, max_discount_amount: 50000, usage_limit: 100, used_count: 0 },
    { code: 'QA-SELECTED', name: 'Ưu đãi khách hàng được chọn', discount_type: 'fixed', discount_value: 25000, audience: 'selected', recipient_ids: [boundary.id], used_count: 1 },
    { code: 'QA-SHIP', name: 'Miễn phí vận chuyển', discount_type: 'free_shipping', discount_value: 0 },
    { code: `Q${'A'.repeat(49)}`, name: 'V'.repeat(255), discount_type: 'percentage', discount_value: 100, min_order_amount: 0 },
    { code: 'QA-EXPIRED', name: 'Voucher hết hạn', discount_type: 'fixed', discount_value: 10000, expires_at: at(-1), starts_at: at(-30), active: false },
    { code: 'QA0', name: 'Voucher chưa bắt đầu, giới hạn 0', discount_type: 'percentage', discount_value: 0, usage_limit: 0, starts_at: at(1), expires_at: at(30) },
  ].map(row => ({ id: id(), created_by: admin.id, audience: 'broadcast', recipient_ids: [], active: true, usage_limit: null, used_count: 0, min_order_amount: 0, max_discount_amount: null, starts_at: at(-30), expires_at: null, ...row }));
  const carts = [customer, boundary, users[5]].map(user => ({ id: id(), user_id: user.id }));
  const cart_items = [0, 1].map((product, index) => ({ id: id(), cart_id: carts[0].id, product_id: products[product].id, variant_id: products[product].variants[0].id, quantity: index + 1 }));
  const orders = [], order_items = [], payment_sessions = [], payment_confirmations = [], payments = [], refunds = [];
  const scenarios = [
    ['PENDING', 'pending', false, 'cod'], ['CONFIRMED', 'confirmed', true, 'qr'],
    ['PROCESSING', 'processing', true, 'bank_transfer'], ['PACKED', 'packed', true, 'card'],
    ['SHIPPING', 'shipping', false, 'cod'], ['DELIVERED', 'delivered', true, 'cod'],
    ['COMPLETED', 'completed', true, 'qr'], ['CANCELLED', 'cancelled', false, 'cod'],
    ['RETURNED', 'returned', true, 'qr'], ['REFUNDED', 'refunded', true, 'qr'],
    ['DEPOSIT50', 'confirmed', true, 'qr', 50], ['DEPOSIT70', 'confirmed', true, 'qr', 70],
    ['QR-PENDING', 'pending', false, 'qr'], ['CARD-EXPIRED', 'pending', false, 'card'],
    ['CARD-FAILED', 'pending', false, 'card'], ['MINIMUM', 'completed', true, 'card'],
    ['MULTI', 'completed', true, 'qr'], ['PICKUP', 'pending', false, 'cod'],
  ];
  const labels = { pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', processing: 'Đang chuẩn bị hàng', packed: 'Đã đóng gói', shipping: 'Đang giao hàng', delivered: 'Giao thành công', completed: 'Hoàn thành', cancelled: 'Đã hủy', returned: 'Hoàn hàng', refunded: 'Đã hoàn tiền' };
  for (const [index, [key, status, paid, method, rate = 0]] of scenarios.entries()) {
    const owner = key === 'MULTI' ? boundary : customer;
    const productIndexes = key === 'MULTI' ? [0, 1] : key === 'MINIMUM' ? [4] : rate === 70 ? [1] : [0];
    const subtotal = productIndexes.reduce((sum, p) => sum + Math.round(Number(products[p].price) * 100), 0) / 100;
    const pickup = ['MINIMUM', 'PICKUP'].includes(key);
    const fee = pickup || subtotal >= 500000 ? 0 : 30000;
    const discount = key === 'MULTI' ? 25000 : 0;
    const total = subtotal + fee - discount;
    const amount = paid ? rate ? Math.round(total * rate / 100) : total : 0;
    const returned = status === 'refunded';
    const created_at = at(-20 + index / 24);
    const paid_at = new Date(new Date(created_at).getTime() + 5 * 60000).toISOString();
    const address = user_addresses.find(a => a.user_id === owner.id && a.is_default);
    const order = {
      id: id(), code: `QA-ORD-${key}`, user_id: owner.id, status, status_label: labels[status],
      payment_status: returned ? 'refunded' : rate ? 'partial' : paid ? 'paid' : 'unpaid',
      deposit_status: rate ? 'paid' : 'none', deposit_paid_at: rate ? paid_at : null,
      payment_method: method, payment_mode: rate ? 'deposit' : 'full', delivery_method: pickup ? 'pickup' : key === 'SHIPPING' ? 'express' : 'standard',
      subtotal: subtotal.toFixed(2), shipping_fee: fee, discount_amount: discount, total_amount: total.toFixed(2),
      deposit_rate: rate, deposit_amount: rate ? amount : 0, amount_due_now: method === 'cod' ? 0 : rate ? amount : total,
      paid_amount: amount.toFixed(2), refunded_amount: returned ? amount : 0, held_amount: 0,
      remaining_amount: ['cancelled', 'returned', 'refunded'].includes(status) ? 0 : (total - amount).toFixed(2), currency: 'VND',
      recipient: { name: owner.name, phone: address.recipient_phone, full_address: address.full_address },
      shipment: ['shipping', 'delivered', 'completed', 'returned', 'refunded'].includes(status) && !pickup ? { carrier: 'Đơn vị vận chuyển QA', tracking_number: `QA-TRACK-${index}`, shipped_at: paid_at, delivered_at: status === 'shipping' ? null : at(-18 + index / 24) } : { carrier: '', tracking_number: '', shipped_at: null, delivered_at: null },
      history: [{ id: '1', status: 'pending', label: labels.pending, created_at }, ...(status === 'pending' ? [] : [{ id: '2', status, label: labels[status], created_at: at(-17 + index / 24) }])],
      note: index % 2 ? '' : "Gọi trước khi giao – dữ liệu kiểm thử ' & < > 🌿",
      coupon: discount ? { id: vouchers[1].id, code: vouchers[1].code, discount_amount: discount } : {},
      completed_at: status === 'completed' ? at(-17 + index / 24) : null, created_at,
    };
    orders.push(order);
    for (const p of productIndexes) {
      const product = products[p], variant = product.variants[0];
      order_items.push({ id: id(), order_id: order.id, product_id: product.id, variant_id: variant.id, product_name: product.name, variant_label: variant.label, color: variant.color, image_url: product.image, unit_price: product.price, quantity: 1, line_total: product.price, created_at });
    }
    if (method !== 'cod') {
      const sessionStatus = paid ? 'succeeded' : key.endsWith('EXPIRED') ? 'expired' : key.endsWith('FAILED') ? 'failed' : 'pending';
      const sessionCreatedAt = paid ? created_at : new Date(now.getTime() - (sessionStatus === 'expired' ? 30 : 0) * 60000).toISOString();
      payment_sessions.push({ id: id(), order_id: order.id, purpose: rate ? 'deposit' : 'full', method, provider: method === 'card' ? 'card' : 'vietqr', status: sessionStatus, amount: rate ? amount : total, currency: 'VND', qr_payload: method === 'qr' ? `QA-ONLY:${order.code}` : null, qr_image_url: '', payment_url: '', expires_at: new Date(new Date(sessionCreatedAt).getTime() + 15 * 60000).toISOString(), paid_at: paid ? paid_at : null, failure_code: sessionStatus === 'failed' ? 'QA_DECLINED' : null, created_at: sessionCreatedAt });
    }
    if (paid) {
      const reference = index === 1 ? 'R'.repeat(100) : `QA-PAY-${key}`;
      payment_confirmations.push({ id: id(), order_id: order.id, kind: rate ? 'deposit' : 'full', amount, transaction_reference: reference, confirmed_by: manager.id, status: 'confirmed', note: '', confirmed_at: paid_at });
      payments.push({ id: id(), order_id: order.id, user_id: owner.id, amount, payment_method: method, payment_type: rate ? 'deposit' : 'full', status: 'completed', transaction_id: reference, note: 'Giao dịch mô phỏng, không kết nối ngân hàng', metadata: { qa_fixture: true }, created_at: paid_at });
      if (returned) refunds.push({ id: id(), order_id: order.id, amount, status: 'completed', reason: 'Sản phẩm không phù hợp – hoàn tiền mẫu', transaction_reference: `QA-REFUND-${key}`, requested_at: at(-16), completed_at: at(-15) });
    }
  }
  const reviews = [
    { product_id: products[0].id, user_id: customer.id, rating: 5, content: 'Áo vừa vặn, màu xanh đẹp 🌿', images: [uploads[0]] },
    { product_id: products[1].id, user_id: boundary.id, rating: 1, content: 'Đ'.repeat(1000), images: [] },
    { product_id: products[4].id, user_id: customer.id, rating: 3, content: '', images: [] },
  ].map(row => ({ id: id(), ...row }));
  const chat_messages = [customer, boundary].flatMap((owner, index) => [
    { sender: owner, role: 'customer', message: "Shop còn màu xanh không? ' & < > 🌿", is_read: false },
    { sender: manager, role: 'shop', message: 'Cửa hàng còn hàng, bạn nhé.', is_read: true },
    { sender: owner, role: 'customer', message: index ? '日本語も表示できますか？' : 'Cảm ơn shop!', is_read: true },
  ].map((row, position) => ({ id: id(), conversation_id: `qa-conversation-${index}`, sender_id: row.sender.id, sender_name: row.sender.name, sender_role: row.role, owner: owner.email, message: row.message, is_read: row.is_read, created_at: at(-2 + position / 24) })));
  const notifications = [customer, boundary].flatMap(owner => [false, true].map(is_read => ({ id: id(), user_id: owner.id, owner: owner.email, title: is_read ? 'Đơn hàng đã cập nhật' : 'Ưu đãi dành cho bạn 🌿', message: 'Thông báo kiểm thử tiếng Việt & ký tự đặc biệt.', key: null, params: {}, type: 'system', is_read })));
  const payload = { quote_id: 'qa-fixture-quote' };
  return {
    users, categories, products, uploads, user_addresses,
    shop_settings: [{ id: id(), name: 'Cửa hàng QA – dữ liệu biệt lập', description: '', phone: '', email: 'shop@example.test', address: '', map_url: '', logo_url: '', banner_url: '', social_links: [], commerce: { freeShippingFrom: 500000, shippingFee: 30000, depositRate: 0.5 } }],
    vouchers, carts, cart_items, orders, order_items,
    inventory_adjustments: [0, 1].map(p => ({ id: id(), product_id: products[p].id, variant_id: products[p].variants[0].id, delta: p ? -1 : 1, stock_before: products[p].variants[0].stock_quantity + (p ? 1 : -1), stock_after: products[p].variants[0].stock_quantity, reason: p ? 'Xuất mẫu QA' : 'Nhập mẫu QA', actor_id: manager.id })),
    payment_sessions, payment_confirmations, payments, refunds, reviews, chat_messages, notifications,
    idempotency_requests: [{ actor_id: customer.id, operation: 'order:create', request_key: 'Q'.repeat(200), request_hash: createHash('sha256').update(JSON.stringify(payload)).digest('hex'), response: { id: orders[0].id, code: orders[0].code } }],
  };
}
