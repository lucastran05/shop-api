// Tạo dữ liệu demo cho shop hoa / cây cảnh: danh mục, sản phẩm, khách hàng, địa chỉ,
// đơn hàng nhiều trạng thái trong ~6 tháng, thanh toán, đánh giá, voucher, thông báo, chat.
//
// Chạy trong container API:   docker compose exec api npm run seed:demo
// Chạy local (DB theo .env):  npm run seed:demo
//
// - Toàn bộ chạy trong một transaction: lỗi giữa chừng thì không ghi gì.
// - Đã có danh mục "Hoa bó" thì coi như đã seed và bỏ qua (không tạo trùng).
// - Không sửa/xóa dữ liệu có sẵn, trừ mô tả shop nếu vẫn là mặc định "Cửa hàng trực tuyến".
// - Mọi tài khoản demo dùng chung mật khẩu DEMO_PASSWORD bên dưới.
import 'dotenv/config';
import pool, { initDB } from '../src/config/db.js';
import { withTransaction } from '../src/config/transaction.js';
import { hashPassword } from '../src/utils/password.js';
import { findProvinceByCode, getWardsByProvince } from '../src/constants/locations.js';
import { ORDER_STATUS_LABELS } from '../src/modules/storefront/orderStatus.js';
import communicationRepository from '../src/modules/communication/communication.repository.js';
import { CATEGORIES, PRODUCTS, variantImage } from './demo-data/catalog.js';

const DEMO_PASSWORD = 'Demo@1234';
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();

// Pseudo-random có seed: chạy lại trên DB trống cho ra cùng bộ dữ liệu
let seed = 20261105;
const random = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = (list) => list[Math.floor(random() * list.length)];
const chance = (p) => random() < p;
const between = (min, max) => min + Math.floor(random() * (max - min + 1));
const at = (time) => new Date(time).toISOString();

const CUSTOMERS = [
  { name: 'Nguyễn Thị Lan', email: 'lan.nguyen@demo.abcshop.vn', phone: '0912345601', province: '01', street: '18 Phố Huế' },
  { name: 'Trần Minh Khoa', email: 'khoa.tran@demo.abcshop.vn', phone: '0912345602', province: '79', street: '125 Nguyễn Đình Chiểu' },
  { name: 'Lê Hoàng Yến', email: 'yen.le@demo.abcshop.vn', phone: '0912345603', province: '01', street: '27 Láng Hạ' },
  { name: 'Phạm Quốc Bảo', email: 'bao.pham@demo.abcshop.vn', phone: '0912345604', province: '48', street: '60 Bạch Đằng' },
  { name: 'Võ Thu Trang', email: 'trang.vo@demo.abcshop.vn', phone: '0912345605', province: '79', street: '9 Lê Lợi' },
  { name: 'Đặng Gia Huy', email: 'huy.dang@demo.abcshop.vn', phone: '0912345606', province: '01', street: '44 Trần Duy Hưng' },
  { name: 'Bùi Ngọc Anh', email: 'anh.bui@demo.abcshop.vn', phone: '0912345607', province: '79', street: '210 Võ Văn Tần' },
  { name: 'Hoàng Mai Phương', email: 'phuong.hoang@demo.abcshop.vn', phone: '0912345608', province: '48', street: '15 Nguyễn Văn Linh' },
];
const MANAGER = { name: 'Quản lý cửa hàng', email: 'quanly@demo.abcshop.vn', phone: '0912345600' };

const VOUCHERS = [
  { code: 'HOAXINH10', name: 'Giảm 10% cho đơn từ 300.000đ', discount_type: 'percentage', discount_value: 10, min_order_amount: 300000, max_discount_amount: 50000, usage_limit: 200, expiresIn: 60 },
  { code: 'FREESHIP', name: 'Miễn phí giao hàng đơn từ 200.000đ', discount_type: 'free_shipping', discount_value: 0, min_order_amount: 200000, max_discount_amount: null, usage_limit: null, expiresIn: 90 },
  { code: 'GIAM50K', name: 'Giảm 50.000đ cho đơn từ 500.000đ', discount_type: 'fixed', discount_value: 50000, min_order_amount: 500000, max_discount_amount: null, usage_limit: 100, expiresIn: 30 },
  { code: 'KHAITRUONG', name: 'Ưu đãi khai trương 15%', discount_type: 'percentage', discount_value: 15, min_order_amount: 0, max_discount_amount: 100000, usage_limit: 50, expiresIn: -10 },
];

const REVIEW_TEXTS = {
  flower: [
    'Hoa tươi, gói đẹp hơn ảnh. Người nhận rất thích!',
    'Giao đúng giờ, shop gọi xác nhận trước khi giao, rất chu đáo.',
    'Hoa nở đều, giữ được gần một tuần. Sẽ quay lại ủng hộ.',
    'Màu hoa đúng như mô tả, thiệp viết tay xinh xắn.',
    'Giá hợp lý so với chất lượng, shipper thân thiện.',
  ],
  plant: [
    'Cây khỏe, lá xanh mướt, chậu đẹp. Đặt bàn làm việc rất hợp.',
    'Đóng gói cẩn thận, cây không bị gãy lá nào.',
    'Shop hướng dẫn chăm sóc kỹ, cây lên chồi mới sau 2 tuần.',
    'Cây to hơn mình nghĩ, rất đáng tiền.',
  ],
  small: [
    'Nhỏ xinh dễ thương, để bàn học rất hợp.',
    'Sen đá mập, màu đẹp, giao nhanh.',
    'Mua làm quà cho đồng nghiệp ai cũng thích.',
  ],
  meh: ['Hoa đẹp nhưng giao trễ hơn hẹn khoảng 1 tiếng.', 'Sản phẩm ổn, nhưng chậu hơi nhỏ so với mong đợi.'],
};
const reviewGroup = (category) =>
  ['Cây cảnh văn phòng', 'Lan hồ điệp'].includes(category) ? 'plant'
    : category === 'Sen đá & xương rồng' ? 'small' : 'flower';

const CARRIERS = ['GHN', 'GHTK', 'Viettel Post', 'Ahamove'];
const FLOW = ['pending', 'confirmed', 'processing', 'packed', 'shipping', 'delivered', 'completed'];

async function insert(client, table, row, returning = 'id') {
  const keys = Object.keys(row);
  const values = keys.map((key) => {
    const value = row[key];
    return value !== null && typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value)
      ? JSON.stringify(value)
      : Array.isArray(value) && table !== 'vouchers' ? JSON.stringify(value) : value;
  });
  const { rows } = await client.query(
    `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING ${returning};`,
    values,
  );
  return rows[0];
}

async function seedUsers(client, passwordHash) {
  const customers = [];
  for (const [index, customer] of CUSTOMERS.entries()) {
    const createdAt = at(NOW - (200 - index * 12) * DAY);
    const user = await insert(client, 'users', {
      name: customer.name, email: customer.email, password: passwordHash, role: 'customer',
      phone: customer.phone, active: true, created_at: createdAt, updated_at: createdAt,
    });
    const province = findProvinceByCode(customer.province);
    const ward = getWardsByProvince(customer.province)[index % 5];
    const fullAddress = `${customer.street}, ${ward.name}, ${province.name}`;
    const address = await insert(client, 'user_addresses', {
      user_id: user.id, recipient_name: customer.name, recipient_phone: customer.phone,
      province_code: province.code, province_name: province.name, ward_code: ward.code, ward_name: ward.name,
      street_address: customer.street, full_address: fullAddress, is_default: true,
      created_at: createdAt, updated_at: createdAt,
    });
    await client.query('UPDATE users SET default_address_id = $1 WHERE id = $2;', [address.id, user.id]);
    customers.push({ ...customer, id: user.id, recipient: { name: customer.name, phone: customer.phone, full_address: fullAddress } });
  }
  await insert(client, 'users', {
    name: MANAGER.name, email: MANAGER.email, password: passwordHash, role: 'manager', phone: MANAGER.phone, active: true,
  });
  return customers;
}

async function seedCatalog(client, adminId) {
  const categoryIds = {};
  for (const name of CATEGORIES) categoryIds[name] = (await insert(client, 'categories', { name })).id;

  const products = [];
  for (const [index, product] of PRODUCTS.entries()) {
    const variants = product.variants.map(({ colors, stock, ...variant }) => ({
      ...variant,
      old_price: variant.old_price ?? null,
      stock_quantity: stock,
      stock,
      image: variantImage(variant),
    }));
    const cheapest = variants.reduce((min, v) => (v.price < min.price ? v : min));
    const images = [...new Set(variants.map((v) => v.image))].map((url, i) => ({ id: String(i + 1), url, alt_text: product.name, sort_order: i + 1 }));
    const createdAt = at(NOW - (190 - index * 3) * DAY);
    const row = await insert(client, 'products', {
      name: product.name,
      category: product.category,
      category_id: categoryIds[product.category],
      description: product.description,
      price: cheapest.price,
      old_price: cheapest.old_price,
      stock: variants.reduce((sum, v) => sum + v.stock_quantity, 0),
      image: variants[0].image,
      images,
      variants,
      attributes: product.attributes,
      featured: Boolean(product.pinned),
      is_pinned: Boolean(product.pinned),
      active: true,
      deposit: Boolean(product.deposit),
      allow_deposit: Boolean(product.deposit),
      deposit_rate: product.deposit || 20,
      created_at: createdAt,
      updated_at: createdAt,
    });
    // Phiếu nhập kho đầu kỳ cho màn lịch sử tồn kho
    for (const variant of variants) {
      await insert(client, 'inventory_adjustments', {
        product_id: row.id, variant_id: variant.id, delta: variant.stock_quantity, stock_before: 0,
        stock_after: variant.stock_quantity, reason: 'Nhập hàng đầu kỳ', actor_id: adminId, created_at: createdAt,
      });
    }
    products.push({ ...product, id: row.id, variants, createdAt: NOW - (190 - index * 3) * DAY });
  }
  return products;
}

async function seedVouchers(client, adminId) {
  const vouchers = {};
  for (const voucher of VOUCHERS) {
    const { expiresIn, ...data } = voucher;
    vouchers[voucher.code] = await insert(client, 'vouchers', {
      ...data,
      starts_at: at(NOW - 120 * DAY),
      expires_at: at(NOW + expiresIn * DAY),
      active: true,
      audience: 'broadcast',
      recipient_ids: [],
      created_by: adminId,
    }, 'id, code, name, discount_type');
  }
  return vouchers;
}

// Trạng thái cuối của đơn theo tuổi đơn: đơn cũ phần lớn đã hoàn thành, đơn mới còn đang xử lý
function finalStatus(daysAgo) {
  if (daysAgo <= 2) return pick(['pending', 'pending', 'confirmed']);
  if (daysAgo <= 6) return pick(['confirmed', 'processing', 'packed', 'shipping', 'shipping']);
  if (daysAgo <= 12) return pick(['shipping', 'delivered', 'delivered', 'completed', 'cancelled']);
  const roll = random();
  if (roll < 0.74) return 'completed';
  if (roll < 0.86) return 'cancelled';
  if (roll < 0.93) return 'returned';
  return 'delivered';
}

function pickItems(products) {
  const items = [];
  const count = chance(0.6) ? 1 : between(2, 3);
  while (items.length < count) {
    const product = pick(products);
    const variant = pick(product.variants);
    if (items.some((item) => item.variant_id === variant.id)) continue;
    const quantity = product.category === 'Sen đá & xương rồng' ? between(1, 3) : chance(0.85) ? 1 : 2;
    items.push({
      product, product_id: product.id, variant_id: variant.id, product_name: product.name,
      variant_label: variant.label, color: variant.color || '', image_url: variant.image,
      unit_price: variant.price, quantity, line_total: variant.price * quantity,
    });
  }
  return items;
}

async function seedOrders(client, customers, products, vouchers, adminId) {
  const orders = [];
  for (let i = 0; i < 46; i++) {
    // Trải từ ~6 tháng trước tới hôm nay, dày hơn ở những ngày gần đây (đơn đang xử lý)
    const daysAgo = 178 * (1 - i / 45) ** 1.6 + random() * 0.5;
    const createdTime = NOW - daysAgo * DAY - between(1, 10) * 60 * 60 * 1000;
    const customer = pick(customers);
    const items = pickItems(products);
    const status = finalStatus(daysAgo);

    const delivery = chance(0.15) ? 'pickup' : chance(0.1) ? 'express' : 'standard';
    const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);
    const shippingFee = delivery === 'pickup' || subtotal >= 500000 ? 0 : 30000;
    let coupon = {};
    let discount = 0;
    if (subtotal >= 300000 && chance(0.25)) {
      discount = Math.min(Math.round(subtotal * 0.1), 50000);
      coupon = { ...vouchers.HOAXINH10, discount_amount: discount };
    }
    const total = subtotal + shippingFee - discount;

    const paymentMethod = pick(['cod', 'cod', 'vietqr', 'vietqr', 'vietqr', 'card']);
    const depositOk = paymentMethod !== 'cod' && items.every((item) => item.product.deposit && 50 >= item.product.deposit);
    const isDeposit = depositOk && chance(0.6);
    const depositAmount = isDeposit ? Math.round(total * 0.5) : 0;

    // Tiền đã thu theo trạng thái
    const reached = status === 'cancelled' ? 0 : status === 'returned' ? FLOW.indexOf('delivered') : FLOW.indexOf(status);
    let paid = 0;
    if (status === 'returned' || reached >= FLOW.indexOf('delivered')) paid = total;
    else if (paymentMethod !== 'cod' && reached >= FLOW.indexOf('confirmed')) paid = isDeposit ? depositAmount : total;
    const refunded = status === 'returned' ? total : 0;
    const paymentStatus = refunded ? 'refunded' : paid >= total ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
    const remaining = ['cancelled', 'returned'].includes(status) ? (status === 'cancelled' ? total : 0) : total - paid;

    // Lịch sử trạng thái
    const path = status === 'cancelled'
      ? [...FLOW.slice(0, chance(0.5) ? 1 : 2), 'cancelled']
      : status === 'returned' ? [...FLOW.slice(0, 6), 'returned'] : FLOW.slice(0, FLOW.indexOf(status) + 1);
    let time = createdTime;
    const history = path.map((code, index) => {
      if (index > 0) time += between(3, 26) * 60 * 60 * 1000;
      time = Math.min(time, NOW - 30 * 60 * 1000);
      return {
        id: String(index + 1),
        status: code,
        label: index === 0 ? 'Đặt hàng thành công' : ORDER_STATUS_LABELS[code],
        note: index === 0 ? 'Khách hàng tạo đơn qua hệ thống'
          : code === 'cancelled' ? pick(['Khách đổi ý, hủy đơn', 'Không liên hệ được người nhận', 'Hết hàng màu khách chọn'])
            : code === 'returned' ? 'Hoa bị dập khi vận chuyển, khách trả hàng'
              : `Cập nhật sang ${ORDER_STATUS_LABELS[code]}`,
        ...(index > 0 ? { actor_name: 'Quản trị viên' } : {}),
        created_at: at(time),
      };
    });
    const timeOf = (code) => history.find((entry) => entry.status === code)?.created_at || null;
    const shipped = path.includes('shipping');
    const shipment = {
      carrier: shipped ? pick(CARRIERS) : '',
      tracking_number: shipped ? `VN${between(100000000, 999999999)}` : '',
      shipped_at: timeOf('shipping'),
      delivered_at: timeOf('delivered'),
    };
    const code = `ORD-${String(610000 + i * 137).slice(-6)}${between(100, 999)}`;

    const order = await insert(client, 'orders', {
      code,
      user_id: customer.id,
      status,
      status_label: ORDER_STATUS_LABELS[status],
      payment_status: paymentStatus,
      deposit_status: isDeposit ? (paid >= depositAmount ? 'paid' : 'unpaid') : 'none',
      deposit_paid_at: isDeposit && paid >= depositAmount ? timeOf('confirmed') : null,
      payment_method: paymentMethod,
      payment_mode: isDeposit ? 'deposit' : 'full',
      delivery_method: delivery,
      subtotal, shipping_fee: shippingFee, discount_amount: discount, total_amount: total,
      deposit_rate: isDeposit ? 50 : 0, deposit_amount: depositAmount,
      amount_due_now: paymentMethod === 'cod' ? 0 : isDeposit ? depositAmount : total,
      paid_amount: paid, refunded_amount: refunded, held_amount: 0, remaining_amount: remaining, currency: 'VND',
      recipient: delivery === 'pickup' ? { ...customer.recipient, full_address: 'Nhận tại cửa hàng' } : customer.recipient,
      shipment,
      history,
      note: chance(0.3) ? pick(['Giao giờ hành chính', 'Gọi trước khi giao 15 phút', 'Viết thiệp: Chúc mừng sinh nhật!', 'Không bấm chuông, gọi điện giúp em']) : '',
      coupon,
      completed_at: timeOf('completed'),
      created_at: at(createdTime),
      updated_at: history.at(-1).created_at,
    });

    for (const { product, ...item } of items) await insert(client, 'order_items', { order_id: order.id, ...item, created_at: at(createdTime) });
    if (paid > 0) {
      await insert(client, 'payment_confirmations', {
        order_id: order.id,
        kind: paid < total ? 'deposit' : 'full',
        amount: paid,
        transaction_reference: `DEMO-${code}`,
        note: paymentMethod === 'cod' ? 'Thu tiền khi giao hàng' : 'Khách chuyển khoản',
        confirmed_by: adminId,
        confirmed_at: timeOf(paymentMethod === 'cod' ? 'delivered' : 'confirmed') || at(createdTime),
      });
    }
    if (refunded) {
      await insert(client, 'refunds', {
        order_id: order.id, amount: refunded, status: 'completed', reason: 'Hoa bị dập khi vận chuyển',
        transaction_reference: `DEMO-RF-${code}`, requested_at: timeOf('returned'), completed_at: timeOf('returned'),
      });
    }
    if (coupon.id) await client.query('UPDATE vouchers SET used_count = used_count + 1 WHERE id = $1;', [coupon.id]);
    orders.push({ ...order, code, status, customer, items, completedAt: timeOf('completed'), updatedAt: history.at(-1).created_at });
  }
  return orders;
}

async function seedReviews(client, orders) {
  const reviewed = new Set();
  let count = 0;
  for (const order of orders.filter((o) => o.status === 'completed')) {
    for (const item of order.items) {
      const key = `${order.customer.id}:${item.product_id}`;
      if (reviewed.has(key) || !chance(0.75)) continue;
      reviewed.add(key);
      const rating = pick([5, 5, 5, 5, 4, 4, 3]);
      const content = rating === 3 ? pick(REVIEW_TEXTS.meh) : pick(REVIEW_TEXTS[reviewGroup(item.product.category)]);
      const time = at(Math.min(NOW - DAY, new Date(order.completedAt).getTime() + between(1, 4) * DAY));
      await insert(client, 'reviews', { product_id: item.product_id, user_id: order.customer.id, rating, content, created_at: time, updated_at: time });
      count++;
    }
  }
  return count;
}

async function seedNotifications(client, orders) {
  const promos = [
    ['Mùa hoa 20/10 đã đến', 'Giảm 10% toàn bộ hoa bó với mã HOAXINH10, áp dụng cho đơn từ 300.000đ.'],
    ['Miễn phí giao hàng', 'Nhập mã FREESHIP cho đơn từ 200.000đ, giao nhanh trong ngày tại nội thành.'],
    ['Lan hồ điệp về vườn', 'Lô lan hồ điệp trắng và vàng mới về, đặt sớm để có chậu đẹp nhất.'],
  ];
  for (const [index, [title, message]] of promos.entries()) {
    const time = at(NOW - (20 - index * 7) * DAY);
    await insert(client, 'notifications', { user_id: null, owner: '', title, message, type: 'promotion', is_read: false, created_at: time, updated_at: time });
  }
  const texts = {
    confirmed: 'đã được xác nhận và đang chuẩn bị',
    shipping: 'đang được giao đến bạn',
    delivered: 'đã giao thành công',
    completed: 'đã hoàn thành. Cảm ơn bạn đã mua hoa tại ABC Shop!',
    cancelled: 'đã bị hủy',
  };
  let count = promos.length;
  for (const order of orders.slice(-24)) {
    const text = texts[order.status] || (order.status === 'returned' ? 'đã được hoàn tiền' : null);
    if (!text) continue;
    await insert(client, 'notifications', {
      user_id: order.customer.id, owner: order.customer.email,
      title: `Đơn hàng ${order.code}`, message: `Đơn hàng ${order.code} ${text}.`,
      key: 'order', params: { target_id: order.id }, type: 'order',
      is_read: new Date(order.updatedAt).getTime() < NOW - 10 * DAY,
      created_at: order.updatedAt, updated_at: order.updatedAt,
    });
    count++;
  }
  return count;
}

async function seedChats(client, customers, admin) {
  const conversations = [
    [customers[0], [
      ['customer', 'Shop ơi, bó hồng 20 bông có giao trong buổi chiều nay được không ạ?'],
      ['shop', 'Dạ được ạ, đơn đặt trước 14h shop giao trong ngày nội thành Hà Nội nhé chị.'],
      ['customer', 'Vậy em đặt luôn, nhờ shop viết thiệp giúp em nhé.'],
      ['shop', 'Dạ shop nhận rồi ạ, chị ghi lời chúc ở phần ghi chú đơn hàng giúp shop nha.'],
    ]],
    [customers[1], [
      ['customer', 'Cây monstera để phòng máy lạnh có ổn không shop?'],
      ['shop', 'Dạ ổn anh ạ, anh để gần cửa sổ có ánh sáng gián tiếp và tưới khi đất khô mặt là cây phát triển tốt.'],
    ]],
    [customers[4], [
      ['customer', 'Lẵng khai trương 3 tầng có in băng rôn tên công ty được không ạ?'],
      ['shop', 'Dạ được ạ, chị gửi giúp shop tên công ty và lời chúc, shop in miễn phí và giao lắp đặt tận nơi.'],
      ['customer', 'Dạ em cảm ơn, em sẽ đặt cọc trên web.'],
    ]],
  ];
  let count = 0;
  for (const [index, [customer, messages]] of conversations.entries()) {
    // Trong transaction CURRENT_TIMESTAMP không đổi: gán thời gian cách nhau để tin nhắn đúng thứ tự
    let time = NOW - (5 - index) * DAY;
    for (const [role, content] of messages) {
      const sender = role === 'shop' ? { id: admin?.id || null, name: 'ABC Shop' } : { id: customer.id, name: customer.name };
      const { message } = await communicationRepository.sendConversationMessage(customer.id, sender, { content, sender_role: role }, client);
      time += between(2, 15) * 60 * 1000;
      await client.query('UPDATE chat_messages SET created_at = $1, updated_at = $1, is_read = TRUE WHERE id = $2;', [at(time), message.id]);
      count++;
    }
  }
  return count;
}

async function seedCarts(client, customers, products) {
  for (const customer of customers.slice(0, 2)) {
    const cart = await insert(client, 'carts', { user_id: customer.id });
    for (const product of [products[0], products[16]]) {
      await insert(client, 'cart_items', { cart_id: cart.id, product_id: product.id, variant_id: product.variants[0].id, quantity: 1 });
    }
  }
}

async function main() {
  await initDB();
  const result = await withTransaction(pool, async (client) => {
    const { rows: existing } = await client.query("SELECT 1 FROM categories WHERE name = 'Hoa bó' LIMIT 1;");
    if (existing.length) return null;

    const admin = (await client.query("SELECT id, name FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1;")).rows[0];
    const passwordHash = await hashPassword(DEMO_PASSWORD);
    const customers = await seedUsers(client, passwordHash);
    const products = await seedCatalog(client, admin?.id || null);
    const vouchers = await seedVouchers(client, admin?.id || null);
    const orders = await seedOrders(client, customers, products, vouchers, admin?.id || null);
    const reviews = await seedReviews(client, orders);
    const notifications = await seedNotifications(client, orders);
    const messages = await seedChats(client, customers, admin);
    await seedCarts(client, customers, products);
    await client.query(
      "UPDATE shop_settings SET description = $1, updated_at = CURRENT_TIMESTAMP WHERE description = 'Cửa hàng trực tuyến';",
      ['Hoa tươi và cây xanh giao nhanh trong ngày'],
    );
    return { customers: customers.length + 1, products: products.length, orders: orders.length, reviews, notifications, messages };
  });

  if (!result) {
    console.log('Dữ liệu demo đã có (tìm thấy danh mục "Hoa bó"), bỏ qua.');
  } else {
    console.log('Đã tạo dữ liệu demo:', result);
    console.log(`Tài khoản demo: ${CUSTOMERS.map((c) => c.email).join(', ')}, ${MANAGER.email} (mật khẩu trong DEMO_PASSWORD của script)`);
  }
}

main()
  .catch((error) => {
    console.error('Seed thất bại, không có dữ liệu nào được ghi:', error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
