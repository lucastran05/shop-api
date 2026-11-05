// Tạo dữ liệu demo cho shop hoa / cây cảnh bằng CHÍNH logic nghiệp vụ của app:
//   khách đăng ký -> thêm giỏ -> báo giá -> tạo đơn (trừ kho, trừ lượt voucher) -> tạo phiên thanh toán
//   -> quản lý xác nhận thanh toán / chuyển trạng thái / hủy (hoàn kho) / hoàn tiền -> khách đánh giá
//   (app tự kiểm tra đã nhận hàng). Không chèn tay vào các bảng nghiệp vụ.
// Các thao tác chạy lần lượt theo đúng thứ tự thời gian; sau mỗi thao tác chỉ lùi mốc thời gian
// (created_at, lịch sử đơn, phiên thanh toán...) về ngày giả lập trong ~6 tháng qua.
// Cuối cùng chạy kiểm tra toàn vẹn (scripts/check-demo-integrity.js).
//
// Chạy trong container API:  docker compose exec api npm run seed:demo
//   --reset   xóa dữ liệu demo cũ (user @demo.abcshop.vn, sản phẩm/danh mục/voucher demo, ảnh của chúng) rồi tạo lại
// Không đụng dữ liệu khác. Mọi tài khoản demo dùng chung mật khẩu DEMO_PASSWORD.
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import pool, { initDB } from '../src/config/db.js';
import AuthService from '../src/services/auth.service.js';
import NotificationService from '../src/services/notification.service.js';
import identityRepository from '../src/modules/identity/identity.repository.js';
import catalogRepository from '../src/modules/catalog/catalog.repository.js';
import inventoryRepository from '../src/modules/storefront/inventory.repository.js';
import cartRepository from '../src/modules/storefront/cart.repository.js';
import orderRepository from '../src/modules/storefront/order.repository.js';
import { voucherRepository } from '../src/modules/storefront/voucher.repository.js';
import billingRepository from '../src/modules/billing/billing.repository.js';
import communicationRepository from '../src/modules/communication/communication.repository.js';
import { currentStock, lockProduct } from '../src/modules/catalog/productStock.js';
import { findProvinceByCode, getWardsByProvince } from '../src/constants/locations.js';
import { removeStoredImage, storeImage } from '../src/services/upload-storage.js';
import { CATEGORIES, PRODUCTS } from './demo-data/catalog.js';
import { checkIntegrity } from './check-demo-integrity.js';

const DEMO_PASSWORD = 'Demo@1234';
export const DEMO_EMAIL_DOMAIN = '@demo.abcshop.vn';
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.now();
const LATEST = NOW - 10 * 60 * 1000; // mọi mốc giả lập đều trước thời điểm chạy
const SHOP_OPENED = NOW - 200 * DAY;

// Pseudo-random có seed: chạy lại trên DB sạch cho ra cùng kịch bản
let seed = 20261105;
const random = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = (list) => list[Math.floor(random() * list.length)];
const chance = (p) => random() < p;
const between = (min, max) => min + Math.floor(random() * (max - min + 1));
const iso = (time) => new Date(time).toISOString();

const CUSTOMERS = [
  { name: 'Nguyễn Thị Lan', email: 'lan.nguyen', phone: '0912345601', province: '01', street: '18 Phố Huế' },
  { name: 'Trần Minh Khoa', email: 'khoa.tran', phone: '0912345602', province: '79', street: '125 Nguyễn Đình Chiểu' },
  { name: 'Lê Hoàng Yến', email: 'yen.le', phone: '0912345603', province: '01', street: '27 Láng Hạ' },
  { name: 'Phạm Quốc Bảo', email: 'bao.pham', phone: '0912345604', province: '48', street: '60 Bạch Đằng' },
  { name: 'Võ Thu Trang', email: 'trang.vo', phone: '0912345605', province: '79', street: '9 Lê Lợi' },
  { name: 'Đặng Gia Huy', email: 'huy.dang', phone: '0912345606', province: '01', street: '44 Trần Duy Hưng' },
  { name: 'Bùi Ngọc Anh', email: 'anh.bui', phone: '0912345607', province: '79', street: '210 Võ Văn Tần' },
  { name: 'Hoàng Mai Phương', email: 'phuong.hoang', phone: '0912345608', province: '48', street: '15 Nguyễn Văn Linh' },
].map((customer) => ({ ...customer, email: customer.email + DEMO_EMAIL_DOMAIN }));
const MANAGER = { name: 'Quản lý cửa hàng', email: 'quanly' + DEMO_EMAIL_DOMAIN, phone: '0912345600' };

export const VOUCHERS = [
  { code: 'HOAXINH10', name: 'Giảm 10% cho đơn từ 300.000đ', discount_type: 'percentage', discount_value: 10, min_order_amount: 300000, max_discount_amount: 50000, usage_limit: 200, startsAgo: 150, expiresIn: 60 },
  { code: 'FREESHIP', name: 'Miễn phí giao hàng đơn từ 200.000đ', discount_type: 'free_shipping', discount_value: 0, min_order_amount: 200000, max_discount_amount: null, usage_limit: null, startsAgo: 90, expiresIn: 90 },
  { code: 'GIAM50K', name: 'Giảm 50.000đ cho đơn từ 500.000đ', discount_type: 'fixed', discount_value: 50000, min_order_amount: 500000, max_discount_amount: null, usage_limit: 100, startsAgo: 60, expiresIn: 30 },
  { code: 'KHAITRUONG', name: 'Ưu đãi khai trương 15%', discount_type: 'percentage', discount_value: 15, min_order_amount: 0, max_discount_amount: 100000, usage_limit: 50, startsAgo: 200, expiresIn: -170 },
];

export const PROMOTIONS = [
  { title: 'Mùa hoa 20/10 đã đến', message: 'Giảm 10% toàn bộ hoa bó với mã HOAXINH10, áp dụng cho đơn từ 300.000đ.', daysAgo: 18 },
  { title: 'Miễn phí giao hàng', message: 'Nhập mã FREESHIP cho đơn từ 200.000đ, giao nhanh trong ngày tại nội thành.', daysAgo: 11 },
  { title: 'Lan hồ điệp về vườn', message: 'Lô lan hồ điệp trắng và vàng mới về, đặt sớm để có chậu đẹp nhất.', daysAgo: 4 },
];

const REVIEW_TEXTS = {
  flower: ['Hoa tươi, gói đẹp hơn ảnh. Người nhận rất thích!', 'Giao đúng giờ, shop gọi xác nhận trước khi giao, rất chu đáo.', 'Hoa nở đều, giữ được gần một tuần. Sẽ quay lại ủng hộ.', 'Màu hoa đúng như mô tả, thiệp viết tay xinh xắn.'],
  plant: ['Cây khỏe, lá xanh mướt, chậu đẹp. Đặt bàn làm việc rất hợp.', 'Đóng gói cẩn thận, cây không bị gãy lá nào.', 'Shop hướng dẫn chăm sóc kỹ, cây lên chồi mới sau 2 tuần.'],
  small: ['Nhỏ xinh dễ thương, để bàn học rất hợp.', 'Sen đá mập, màu đẹp, giao nhanh.', 'Mua làm quà cho đồng nghiệp ai cũng thích.'],
  meh: ['Hoa đẹp nhưng giao trễ hơn hẹn khoảng 1 tiếng.', 'Sản phẩm ổn, nhưng chậu hơi nhỏ so với mong đợi.'],
};
const reviewGroup = (category) =>
  ['Cây cảnh văn phòng', 'Lan hồ điệp'].includes(category) ? 'plant' : category === 'Sen đá & xương rồng' ? 'small' : 'flower';

const CARRIERS = ['GHN', 'GHTK', 'Viettel Post', 'Ahamove'];
const FLOW = ['pending', 'confirmed', 'processing', 'packed', 'shipping', 'delivered', 'completed'];

const query = (sql, values) => pool.query(sql, values);

// --- Xóa dữ liệu demo cũ (chỉ những gì script này tạo ra)
async function resetDemoData() {
  const demoUsers = (await query('SELECT id, email FROM users WHERE email LIKE $1;', ['%' + DEMO_EMAIL_DOMAIN])).rows;
  const userIds = demoUsers.map((u) => u.id);
  const productNames = PRODUCTS.map((p) => p.name);
  const products = (await query('SELECT id, image, images, variants FROM products WHERE name = ANY($1);', [productNames])).rows;

  // Ảnh sản phẩm demo trên storage + metadata
  const imageUrls = new Set();
  for (const product of products) {
    for (const url of [product.image, ...(product.images || []).map((i) => i.url), ...(product.variants || []).map((v) => v.image)]) {
      if (url?.includes('/uploads/')) imageUrls.add(url);
    }
  }
  const keys = [...userIds, ...demoUsers.map((u) => u.email)];
  await query('DELETE FROM orders WHERE user_id = ANY($1);', [userIds]); // kéo theo order_items, phiên/xác nhận thanh toán, hoàn tiền
  await query('DELETE FROM payments WHERE user_id = ANY($1);', [userIds]);
  await query('DELETE FROM reviews WHERE user_id = ANY($1);', [userIds]);
  await query('DELETE FROM chat_messages WHERE owner = ANY($1) OR conversation_id = ANY($1);', [keys]);
  await query('DELETE FROM notifications WHERE user_id IS NULL AND title = ANY($1);', [PROMOTIONS.map((p) => p.title)]);
  await query('DELETE FROM vouchers WHERE code = ANY($1);', [VOUCHERS.map((v) => v.code)]);
  await query('DELETE FROM products WHERE id = ANY($1);', [products.map((p) => p.id)]); // kéo theo phiếu kho, giỏ, đánh giá
  await query('DELETE FROM uploads WHERE url = ANY($1);', [[...imageUrls]]);
  await query('DELETE FROM categories c WHERE name = ANY($1) AND NOT EXISTS (SELECT 1 FROM products p WHERE p.category_id = c.id);', [CATEGORIES]);
  await query('DELETE FROM users WHERE id = ANY($1);', [userIds]); // kéo theo địa chỉ, giỏ, thông báo cá nhân
  await Promise.allSettled([...imageUrls].map((url) => removeStoredImage(url.split('/').pop())));
  console.log(`Đã xóa dữ liệu demo cũ: ${userIds.length} tài khoản, ${products.length} sản phẩm, ${imageUrls.size} ảnh.`);
}

// --- Tài khoản: khách đăng ký như trên web, quản lý được cấp quyền như admin làm ở màn Tài khoản
async function createUser(customer, signupTime) {
  const { user } = await AuthService.register({ name: customer.name, email: customer.email, password: DEMO_PASSWORD });
  await identityRepository.update(user.id, { phone: customer.phone });
  await AuthService.logout(user.id); // không để lại refresh token của lần đăng ký
  await query('UPDATE users SET created_at = $1, updated_at = $1 WHERE id = $2;', [iso(signupTime), user.id]);
  return user;
}

async function createCustomers() {
  const customers = [];
  for (const [index, customer] of CUSTOMERS.entries()) {
    const signupTime = SHOP_OPENED + (8 + index * 17 + between(0, 6)) * DAY;
    const user = await createUser(customer, signupTime);
    // Địa chỉ tạo như ở trang Tài khoản: tra tên tỉnh/xã theo mã, đặt làm mặc định
    const province = findProvinceByCode(customer.province);
    const ward = getWardsByProvince(customer.province)[index % 5];
    const fullAddress = `${customer.street}, ${ward.name}, ${province.name}`;
    const address = await identityRepository.createAddress(user.id, {
      recipient_name: customer.name, recipient_phone: customer.phone,
      province_code: province.code, province_name: province.name,
      ward_code: ward.code, ward_name: ward.name,
      street_address: customer.street, full_address: fullAddress, is_default: true,
    });
    await identityRepository.setDefaultAddress(address.id, user.id);
    await query('UPDATE user_addresses SET created_at = $1, updated_at = $1 WHERE id = $2;', [iso(signupTime + HOUR), address.id]);
    customers.push({ ...customer, id: user.id, addressId: address.id, signupTime });
  }
  return customers;
}

async function createManager() {
  const user = await createUser(MANAGER, SHOP_OPENED - DAY);
  await identityRepository.update(user.id, { role: 'manager' });
  return { id: user.id, name: MANAGER.name };
}

// --- Danh mục, sản phẩm (ảnh upload lên storage như form admin) và nhập kho đầu kỳ
async function uploadImage(variantId) {
  const buffer = await readFile(new URL(`./demo-data/images/${variantId}.png`, import.meta.url));
  const { fileName } = await storeImage({ buffer, mimetype: 'image/png', size: buffer.length });
  const baseUrl = (process.env.PUBLIC_API_URL || '').replace(/\/+$/, '');
  const upload = await catalogRepository.createUpload({
    url: `${baseUrl}/uploads/${fileName}`, file_name: `${variantId}.png`,
    mime_type: 'image/png', size_bytes: buffer.length, purpose: 'product',
  });
  await query('UPDATE uploads SET created_at = $1 WHERE id = $2;', [iso(SHOP_OPENED), upload.id]);
  return upload.url;
}

async function createCatalog(manager) {
  const categoryIds = {};
  for (const name of CATEGORIES) {
    const category = await catalogRepository.createCategory(name);
    await query('UPDATE categories SET created_at = $1, updated_at = $1 WHERE id = $2;', [iso(SHOP_OPENED), category.id]);
    categoryIds[name] = category.id;
  }

  const products = [];
  for (const product of PRODUCTS) {
    const variants = [];
    for (const { colors, stock, ...variant } of product.variants) {
      variants.push({ ...variant, old_price: variant.old_price ?? null, stock_quantity: 0, stock: 0, image: await uploadImage(variant.id) });
    }
    const cheapest = variants.reduce((min, v) => (v.price < min.price ? v : min));
    const created = await catalogRepository.create({
      name: product.name, category: product.category, category_id: categoryIds[product.category],
      description: product.description, price: cheapest.price, old_price: cheapest.old_price, stock: 0,
      image: variants[0].image,
      images: [...new Set(variants.map((v) => v.image))].map((url, i) => ({ id: String(i + 1), url, alt_text: product.name, sort_order: i + 1 })),
      variants, attributes: product.attributes,
      is_pinned: Boolean(product.pinned), is_active: true,
      allow_deposit: Boolean(product.deposit), deposit_rate: product.deposit || 20,
    });
    await query('UPDATE products SET created_at = $1, updated_at = $1 WHERE id = $2;', [iso(SHOP_OPENED), created.id]);
    // Nhập kho đầu kỳ qua phiếu điều chỉnh tồn (ghi lịch sử kho)
    for (const variant of product.variants) {
      await adjustStock(created.id, variant.id, variant.stock, 'Nhập hàng đầu kỳ', manager, SHOP_OPENED + HOUR);
    }
    products.push({ ...product, id: created.id });
  }
  return products;
}

async function adjustStock(productId, variantId, delta, reason, manager, time) {
  const adjustment = await inventoryRepository.adjustInventory({ product_id: productId, variant_id: variantId, delta, reason, actor_id: manager.id });
  await query('UPDATE inventory_adjustments SET created_at = $1 WHERE id = $2;', [iso(time), adjustment.id]);
}

async function createVouchers(manager) {
  const vouchers = {};
  for (const { startsAgo, expiresIn, ...voucher } of VOUCHERS) {
    const startsAt = NOW - startsAgo * DAY;
    const created = await voucherRepository.create({
      ...voucher, starts_at: iso(startsAt), expires_at: iso(NOW + expiresIn * DAY), active: true, audience: 'broadcast',
    }, manager.id);
    await query('UPDATE vouchers SET created_at = $1, updated_at = $1 WHERE id = $2;', [iso(startsAt - DAY), created.id]);
    vouchers[voucher.code] = { ...voucher, startsAt, expiresAt: NOW + expiresIn * DAY };
  }
  return vouchers;
}

// --- Đơn hàng
function finalStatus(daysAgo) {
  if (daysAgo <= 1) return pick(['pending', 'pending', 'confirmed']);
  if (daysAgo <= 6) return pick(['confirmed', 'processing', 'packed', 'shipping', 'shipping']);
  if (daysAgo <= 12) return pick(['shipping', 'delivered', 'delivered', 'completed', 'cancelled']);
  const roll = random();
  if (roll < 0.74) return 'completed';
  if (roll < 0.86) return 'cancelled';
  if (roll < 0.93) return 'returned';
  return 'delivered';
}

// Dòng thời gian của một đơn: mỗi thao tác lấy mốc kế tiếp, không vượt quá thời điểm hiện tại
function timeline(start) {
  let time = start;
  return (minHours, maxHours) => {
    time = Math.min(LATEST, time + between(minHours * 60, maxHours * 60) * 60 * 1000);
    return time;
  };
}

// Giữ hàng đủ bán: sắp hết thì quản lý nhập thêm (ghi phiếu kho) trước khi khách đặt
async function ensureStock(product, variantId, quantity, manager, time) {
  const stock = currentStock(await lockProduct(pool, product.id), variantId);
  if (stock < quantity + 2) await adjustStock(product.id, variantId, 20, 'Nhập thêm hàng', manager, time - 6 * HOUR);
}

async function placeOrder({ customer, products, vouchers, manager, orderTime }) {
  // Khách thêm hàng vào giỏ
  const lines = [];
  const count = chance(0.6) ? 1 : between(2, 3);
  while (lines.length < count) {
    const product = pick(products);
    const variant = pick(product.variants);
    if (lines.some((line) => line.variant.id === variant.id)) continue;
    const quantity = product.category === 'Sen đá & xương rồng' ? between(1, 3) : chance(0.85) ? 1 : 2;
    lines.push({ product, variant, quantity });
  }
  for (const line of lines) {
    await ensureStock(line.product, line.variant.id, line.quantity, manager, orderTime);
    await cartRepository.addItem(customer.id, { product_id: line.product.id, variant_id: line.variant.id, quantity: line.quantity });
  }
  const cart = await cartRepository.getCart(customer.id);
  const cartItemIds = cart.items
    .filter((item) => lines.some((line) => line.product.id === item.product_id && line.variant.id === item.variant_id))
    .map((item) => item.id);

  const delivery = chance(0.15) ? 'pickup' : chance(0.1) ? 'express' : 'standard';
  const paymentMethod = pick(['cod', 'cod', 'vietqr', 'vietqr', 'vietqr', 'card']);
  const subtotal = lines.reduce((sum, line) => sum + line.variant.price * line.quantity, 0);
  // Voucher chỉ dùng được trong thời hạn của nó tại thời điểm đặt
  const usable = Object.values(vouchers).filter((v) =>
    orderTime >= v.startsAt && orderTime <= v.expiresAt && NOW <= v.expiresAt && subtotal >= v.min_order_amount);
  const coupon = usable.length && chance(0.3) ? pick(usable).code : undefined;
  const depositOk = paymentMethod !== 'cod' && lines.every((line) => line.product.deposit && 50 >= line.product.deposit);
  const isDeposit = depositOk && chance(0.6);

  const quote = await orderRepository.calculateQuote(customer.id, {
    cart_item_ids: cartItemIds,
    address_id: delivery === 'pickup' ? undefined : customer.addressId,
    recipient: delivery === 'pickup' ? { name: customer.name, phone: customer.phone, full_address: 'Nhận tại cửa hàng' } : undefined,
    delivery_method: delivery,
    payment_method: paymentMethod,
    payment_mode: isDeposit ? 'deposit' : 'full',
    ...(isDeposit ? { deposit_rate: 50 } : {}),
    ...(coupon ? { coupon_code: coupon } : {}),
  });
  const note = chance(0.3) ? pick(['Giao giờ hành chính', 'Gọi trước khi giao 15 phút', 'Viết thiệp: Chúc mừng sinh nhật!']) : undefined;
  const order = await orderRepository.createOrderFromQuote(customer.id, { quote_id: quote.quote_id, note });
  return { order, isDeposit, paymentMethod, delivery, lines };
}

// Thực hiện quy trình xử lý đơn tới trạng thái cuối, ghi lại mốc thời gian của từng thao tác
async function processOrder({ order, isDeposit, paymentMethod, delivery }, customer, manager, status, orderTime) {
  const next = timeline(orderTime);
  const historyTimes = [orderTime]; // mỗi phần tử ứng với một dòng lịch sử đơn theo thứ tự
  const events = { sessions: [], confirmations: [], refunds: [] };
  const actor = { id: customer.id, role: 'customer' };
  const advance = async (code, extra = {}, hours = [3, 20]) => {
    const time = next(...hours);
    await orderRepository.updateAdminOrder(order.id, { status: code, ...extra }, manager.name);
    historyTimes.push(time);
    events[code] = time;
  };
  const confirm = async (kind, sessionId, hours) => {
    const time = next(...hours);
    const ref = `PAY-${order.code}-${events.confirmations.length + 1}`;
    await billingRepository.confirmPayment(order.id, {
      kind, ...(sessionId ? { payment_id: sessionId } : {}), transaction_reference: ref,
      note: sessionId ? 'Khách chuyển khoản qua QR' : 'Thu tiền khi giao hàng', confirmed_by: manager.id,
    });
    events.confirmations.push({ ref, time, sessionId, kind });
  };
  const refund = async (reason, hours) => {
    const time = next(...hours);
    const ref = `RF-${order.code}`;
    await billingRepository.refundOrder(order.id, { reason, transaction_reference: ref, refunded_by: manager.id });
    events.refunds.push({ ref, time });
  };

  // Thanh toán online: khách mở phiên thanh toán và trả ngay sau khi đặt (trừ đơn còn chờ thanh toán)
  const paysOnline = paymentMethod !== 'cod' && !(status === 'pending' || (status === 'cancelled' && chance(0.5)));
  if (paysOnline) {
    const purpose = isDeposit ? 'deposit' : 'full';
    const sessionTime = next(0.05, 0.3);
    const session = await billingRepository.createPaymentSession(order.id, { method: paymentMethod === 'card' ? 'card' : 'vietqr', purpose }, actor);
    events.sessions.push({ id: session.id, time: sessionTime });
    await confirm(purpose, session.id, [0.05, 0.4]);
  } else if (paymentMethod !== 'cod' && status !== 'cancelled') {
    // Đơn mới đặt, khách đã mở QR nhưng chưa trả
    const session = await billingRepository.createPaymentSession(order.id, { method: 'vietqr', purpose: isDeposit ? 'deposit' : 'full' }, actor);
    events.sessions.push({ id: session.id, time: next(0.05, 0.3) });
  }
  if (status === 'pending') return { historyTimes, events };

  if (status === 'cancelled') {
    // Khách tự hủy khi đơn còn chờ, hoặc shop hủy sau khi xác nhận
    if (chance(0.5)) {
      const time = next(1, 12);
      await orderRepository.cancelOrder(customer.id, order.id, pick(['Đổi ý, đặt nhầm mẫu', 'Đặt trùng đơn']));
      historyTimes.push(time);
      events.cancelled = time;
    } else {
      if (!paysOnline) await advance('confirmed', {}, [1, 8]);
      await advance('cancelled', { note: pick(['Không liên hệ được người nhận', 'Hết hàng màu khách chọn']) }, [2, 20]);
    }
    // Khách đã trả tiền online thì shop hoàn lại
    if (paysOnline) await refund('Hoàn tiền do đơn bị hủy', [1, 24]);
    return { historyTimes, events };
  }

  if (!paysOnline) await advance('confirmed', {}, [0.5, 6]); // đơn COD: shop gọi xác nhận
  for (const code of FLOW.slice(2, FLOW.indexOf(status === 'returned' ? 'delivered' : status) + 1)) {
    if (code === 'shipping') {
      const shipping = delivery === 'pickup'
        ? { carrier: 'Khách nhận tại cửa hàng', tracking_number: order.code }
        : { carrier: pick(CARRIERS), tracking_number: `VN${between(100000000, 999999999)}` };
      await advance('shipping', shipping, [2, 12]);
      continue;
    }
    if (code === 'delivered') {
      await advance('delivered', {}, delivery === 'express' ? [2, 6] : [8, 30]);
      // Còn thiếu (COD hoặc phần sau đặt cọc): thu khi giao
      if (Number((await query('SELECT remaining_amount FROM orders WHERE id = $1;', [order.id])).rows[0].remaining_amount) > 0) {
        await confirm('full', null, [0, 0.1]);
      }
      continue;
    }
    await advance(code, {}, code === 'completed' ? [24, 72] : [2, 16]);
  }

  if (status === 'returned') {
    await advance('returned', { note: 'Hoa bị dập khi vận chuyển, khách trả hàng' }, [6, 30]);
    await refund('Hoa bị dập khi vận chuyển', [2, 24]);
  }
  return { historyTimes, events };
}

// Lùi mọi mốc thời gian của đơn về dòng thời gian giả lập (dữ liệu nghiệp vụ giữ nguyên)
async function backdateOrder(orderId, orderTime, { historyTimes, events }) {
  const { rows } = await query('SELECT history, shipment, completed_at, deposit_paid_at FROM orders WHERE id = $1;', [orderId]);
  const order = rows[0];
  if (order.history.length !== historyTimes.length) throw new Error(`Lịch sử đơn ${orderId} không khớp số thao tác`);
  const history = order.history.map((entry, i) => ({ ...entry, created_at: iso(historyTimes[i]) }));
  const shipment = {
    ...order.shipment,
    shipped_at: events.shipping ? iso(events.shipping) : null,
    delivered_at: events.delivered ? iso(events.delivered) : null,
  };
  const depositConfirm = events.confirmations.find((c) => c.kind === 'deposit');
  const allTimes = [...historyTimes, ...events.confirmations.map((c) => c.time), ...events.refunds.map((r) => r.time), ...events.sessions.map((s) => s.time)];
  await query(
    `UPDATE orders SET created_at = $1, updated_at = $2, history = $3, shipment = $4, completed_at = $5, deposit_paid_at = $6 WHERE id = $7;`,
    [iso(orderTime), iso(Math.max(...allTimes)), JSON.stringify(history), JSON.stringify(shipment),
      order.completed_at ? iso(events.completed) : null,
      order.deposit_paid_at ? iso(depositConfirm?.time ?? events.confirmations[0].time) : null, orderId],
  );
  await query('UPDATE order_items SET created_at = $1 WHERE order_id = $2;', [iso(orderTime), orderId]);
  for (const session of events.sessions) {
    const paid = events.confirmations.find((c) => c.sessionId === session.id);
    const closed = paid?.time ?? events.cancelled ?? session.time;
    await query(
      `UPDATE payment_sessions SET created_at = $1, expires_at = $2, updated_at = $3, paid_at = CASE WHEN paid_at IS NULL THEN NULL ELSE $3::timestamptz END WHERE id = $4;`,
      [iso(session.time), iso(session.time + 15 * 60 * 1000), iso(closed), session.id],
    );
  }
  for (const confirmation of events.confirmations) {
    await query('UPDATE payment_confirmations SET confirmed_at = $1 WHERE transaction_reference = $2;', [iso(confirmation.time), confirmation.ref]);
  }
  for (const refund of events.refunds) {
    await query('UPDATE refunds SET requested_at = $1, completed_at = $1 WHERE transaction_reference = $2;', [iso(refund.time), refund.ref]);
  }
}

async function createOrders(customers, products, vouchers, manager) {
  const orders = [];
  for (let i = 0; i < 46; i++) {
    // Trải từ ~6 tháng trước tới hôm nay, dày hơn ở những ngày gần đây; tạo theo thứ tự thời gian
    const daysAgo = 178 * (1 - i / 45) ** 1.6 + random() * 0.4;
    const orderTime = Math.min(LATEST - 2 * HOUR, NOW - daysAgo * DAY - between(1, 8) * HOUR);
    // Chỉ khách đã có tài khoản trước thời điểm đặt
    const customer = pick(customers.filter((c) => c.signupTime + DAY <= orderTime));
    const status = finalStatus((NOW - orderTime) / DAY);

    const placed = await placeOrder({ customer, products, vouchers, manager, orderTime });
    const log = await processOrder(placed, customer, manager, status, orderTime);
    await backdateOrder(placed.order.id, orderTime, log);
    orders.push({ id: placed.order.id, customer, status, lines: placed.lines, completedAt: log.events.completed });
  }
  return orders;
}

// Đánh giá đi qua kiểm tra của app: chỉ khách đã nhận hàng mới đánh giá được
async function createReviews(orders) {
  const reviewed = new Set();
  let count = 0;
  for (const order of orders.filter((o) => o.status === 'completed' && o.completedAt < LATEST - 2 * HOUR)) {
    for (const { product } of order.lines) {
      const key = `${order.customer.id}:${product.id}`;
      if (reviewed.has(key) || !chance(0.75)) continue;
      reviewed.add(key);
      const rating = pick([5, 5, 5, 5, 4, 4, 3]);
      const content = rating === 3 ? pick(REVIEW_TEXTS.meh) : pick(REVIEW_TEXTS[reviewGroup(product.category)]);
      const { review } = await catalogRepository.createReview(product.id, order.customer.id, { rating, content });
      const time = Math.min(LATEST, order.completedAt + between(2, 96) * HOUR);
      await query('UPDATE reviews SET created_at = $1, updated_at = $1 WHERE id = $2;', [iso(time), review.id]);
      count++;
    }
  }
  return count;
}

async function createPromotions() {
  for (const promo of PROMOTIONS) {
    const notification = await NotificationService.createNotification({ title: promo.title, message: promo.message, type: 'promotion' });
    const time = iso(NOW - promo.daysAgo * DAY);
    await query('UPDATE notifications SET created_at = $1, updated_at = $1 WHERE id = $2;', [time, notification.id]);
  }
  return PROMOTIONS.length;
}

async function createChats(customers, manager) {
  const conversations = [
    [customers[0], [
      ['customer', 'Shop ơi, bó hồng 20 bông có giao trong buổi chiều nay được không ạ?'],
      ['shop', 'Dạ được ạ, đơn đặt trước 14h shop giao trong ngày nội thành nhé chị.'],
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
    let time = NOW - (5 - index) * DAY;
    for (const [role, content] of messages) {
      const sender = role === 'shop' ? manager : { id: customer.id, name: customer.name };
      const { message } = await communicationRepository.sendConversationMessage(customer.id, sender, { content, sender_role: role });
      time += between(2, 15) * 60 * 1000;
      await query('UPDATE chat_messages SET created_at = $1, updated_at = $1, is_read = TRUE WHERE id = $2;', [iso(time), message.id]);
      count++;
    }
  }
  return count;
}

// Hai khách đang để sẵn hàng trong giỏ
async function fillCarts(customers, products) {
  for (const customer of customers.slice(0, 2)) {
    for (const product of [products[0], products[15]]) {
      await cartRepository.addItem(customer.id, { product_id: product.id, variant_id: product.variants[0].id, quantity: 1 });
    }
  }
}

async function main() {
  await initDB();
  if (process.argv.includes('--reset')) await resetDemoData();
  const existing = await query('SELECT 1 FROM users WHERE email = $1;', [MANAGER.email]);
  if (existing.rows.length || (await query("SELECT 1 FROM categories WHERE name = 'Hoa bó';")).rows.length) {
    console.log('Dữ liệu demo đã có. Chạy lại với --reset để xóa và tạo lại.');
    return;
  }

  try {
    const manager = await createManager();
    const customers = await createCustomers();
    const products = await createCatalog(manager);
    const vouchers = await createVouchers(manager);
    const orders = await createOrders(customers, products, vouchers, manager);
    const reviews = await createReviews(orders);
    const promotions = await createPromotions();
    const messages = await createChats(customers, manager);
    await fillCarts(customers, products);
    await query(
      "UPDATE shop_settings SET description = $1, updated_at = CURRENT_TIMESTAMP WHERE description = 'Cửa hàng trực tuyến';",
      ['Hoa tươi và cây xanh giao nhanh trong ngày'],
    );
    console.log('Đã tạo dữ liệu demo:', { accounts: customers.length + 1, products: products.length, orders: orders.length, reviews, promotions, messages });
  } catch (error) {
    console.error('Seed lỗi giữa chừng. Chạy lại với --reset để dọn dữ liệu demo dở dang.');
    throw error;
  }

  const problems = await checkIntegrity(pool);
  if (problems.length) {
    console.error('Kiểm tra toàn vẹn THẤT BẠI:', problems);
    process.exitCode = 1;
  } else {
    console.log('Kiểm tra toàn vẹn: đạt toàn bộ.');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
