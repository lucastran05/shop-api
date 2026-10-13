import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';

let server;
let baseUrl;

const startServer = () => {
  return new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
};

const stopServer = () => {
  return new Promise((resolve) => {
    if (server) {
      server.close(resolve);
    } else {
      resolve();
    }
  });
};

describe('Kiểm tra Toàn bộ Hợp đồng Endpoint Đặc tả ABC Shop (Customer & Admin APIs)', () => {
  let customerToken = '';
  let adminToken = '';
  let customerUser = null;
  let adminUser = null;
  let sampleProductId = '';
  let sampleAddressId = '';
  let sampleOrderId = '';
  let samplePaymentSessionId = '';
  let sampleConversationId = '';

  test.before(async () => {
    await startServer();

    // 1. Tạo customer account (AUTH01)
    const custRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Nguyen Van Khach',
        email: `customer_${Date.now()}@test.com`,
        password: 'Password@123',
        password_confirmation: 'Password@123',
      }),
    });
    assert.equal(custRes.status, 201);
    const custData = await custRes.json();
    customerUser = custData.data.user || custData.data;
    customerToken = custData.data.accessToken;

    // 2. Tạo admin account qua test setup
    const admRes = await fetch(`${baseUrl}/api/v1/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Admin Boss',
        email: `admin_${Date.now()}@test.com`,
        password: 'Password@123',
      }),
    });
    const admData = await admRes.json();
    adminUser = admData.data.user;
    adminToken = admData.data.accessToken;

    // Cập nhật role admin trong DB để có quyền gọi /admin/...
    const { default: pool } = await import('../src/config/db.js');
    await pool.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [adminUser.id]);

    // Đăng nhập lại admin để lấy token với payload role='admin'
    const admLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: adminUser.email,
        password: 'Password@123',
      }),
    });
    const admLoginData = await admLogin.json();
    adminToken = admLoginData.data.accessToken;
  });

  test.after(async () => {
    await stopServer();
  });

  // --- NHÓM 1: AUTH01 - AUTH06 ---
  it('AUTH04: GET /api/v1/me lấy hồ sơ người dùng', async () => {
    const res = await fetch(`${baseUrl}/api/v1/me`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.ok(body.data.id || body.data.user?.id);
  });

  it('AUTH05: PATCH /api/v1/me sửa thông tin cá nhân', async () => {
    const res = await fetch(`${baseUrl}/api/v1/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ name: 'Nguyen Van Khach Cap Nhat', phone: '0901234567' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.name, 'Nguyen Van Khach Cap Nhat');
  });

  // --- NHÓM 2: ADR01 - ADR07 ---
  it('ADR06 & ADR07: GET /api/v1/locations/provinces và /wards', async () => {
    const pRes = await fetch(`${baseUrl}/api/v1/locations/provinces`);
    assert.equal(pRes.status, 200);
    const pData = await pRes.json();
    assert.ok(Array.isArray(pData.data));
    assert.ok(pData.data.length > 0);

    const wRes = await fetch(`${baseUrl}/api/v1/locations/wards?province_code=HN`);
    assert.equal(wRes.status, 200);
    const wData = await wRes.json();
    assert.ok(Array.isArray(wData.data));
  });

  it('ADR02: POST /api/v1/me/addresses thêm địa chỉ giao hàng', async () => {
    const res = await fetch(`${baseUrl}/api/v1/me/addresses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        recipient_name: 'Nguyen Van Khach',
        recipient_phone: '0901234567',
        province_code: 'HN',
        ward_code: 'HN_HK_01',
        street_address: '123 Pho Hue',
        is_default: true,
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.data.id);
    sampleAddressId = body.data.id;
  });

  it('ADR01: GET /api/v1/me/addresses lấy danh sách địa chỉ', async () => {
    const res = await fetch(`${baseUrl}/api/v1/me/addresses`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.data));
    assert.equal(body.data.length, 1);
  });

  // --- NHÓM 3: CAT01 - CAT03, ADP01 - ADP07, ADC01 - ADC05 ---
  it('ADC02: POST /admin/categories tạo danh mục mới', async () => {
    const res = await fetch(`${baseUrl}/admin/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: `Công nghệ ${Date.now()}` }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.data.id);
  });

  it('CAT03 & ADC01: GET /api/v1/categories và GET /admin/categories', async () => {
    const res1 = await fetch(`${baseUrl}/api/v1/categories`);
    assert.equal(res1.status, 200);
    const body1 = await res1.json();
    assert.ok(Array.isArray(body1.data));

    const res2 = await fetch(`${baseUrl}/admin/categories`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res2.status, 200);
    const body2 = await res2.json();
    assert.ok(Array.isArray(body2.data));
  });

  it('ADP03: POST /admin/products tạo sản phẩm có variants và cấu hình cọc', async () => {
    const res = await fetch(`${baseUrl}/admin/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Tai nghe Bluetooth Pro',
        description: 'Chống ồn chủ động đỉnh cao',
        category: 'Công nghệ',
        price: 2500000,
        stock: 50,
        allow_deposit: true,
        deposit_rate: 30,
        variants: [
          { label: 'Màu Đen', color: 'Đen', price: 2500000, stock_quantity: 30 },
          { label: 'Màu Trắng', color: 'Trắng', price: 2600000, stock_quantity: 20 },
        ],
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.data.id);
    sampleProductId = body.data.id;
  });

  it('CAT01 & CAT02: GET /api/v1/products và GET /api/v1/products/:id', async () => {
    const res1 = await fetch(`${baseUrl}/api/v1/products?in_stock=true`);
    assert.equal(res1.status, 200);
    const body1 = await res1.json();
    assert.ok(Array.isArray(body1.data));
    assert.ok(body1.pagination);

    const res2 = await fetch(`${baseUrl}/api/v1/products/${sampleProductId}`);
    assert.equal(res2.status, 200);
    const body2 = await res2.json();
    assert.equal(body2.data.id, sampleProductId);
    assert.equal(body2.data.allow_deposit, true);
  });

  // --- NHÓM 4: CART01 - CART04, CHK01 - CHK02 ---
  it('CART02 & CART01: Thêm vào giỏ và xem giỏ hàng', async () => {
    const addRes = await fetch(`${baseUrl}/api/v1/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        product_id: sampleProductId,
        quantity: 2,
      }),
    });
    assert.equal(addRes.status, 200);
    const addBody = await addRes.json();
    assert.ok(addBody.data.items);
    assert.ok(addBody.data.items.length > 0);

    const getRes = await fetch(`${baseUrl}/api/v1/cart`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.equal(getRes.status, 200);
    const getBody = await getRes.json();
    assert.equal(getBody.data.line_count, 1);
  });

  it('CHK01: POST /api/v1/checkout/quote tính toán báo giá', async () => {
    const res = await fetch(`${baseUrl}/api/v1/checkout/quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        address_id: sampleAddressId,
        deposit_requested: true,
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.data.quote_id);
    assert.ok(body.data.deposit_amount >= 0);
  });

  it('CHK02: POST /api/v1/orders tạo đơn hàng từ báo giá', async () => {
    const res = await fetch(`${baseUrl}/api/v1/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        note: 'Giao giờ hành chính giúp em',
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.data.id);
    sampleOrderId = body.data.id;
  });

  // --- NHÓM 5: PAY01 - PAY02, ADY01 - ADY02 ---
  it('PAY01 & PAY02: POST /api/v1/orders/:order_id/payment-sessions và GET /api/v1/payments/:id', async () => {
    const sessionRes = await fetch(`${baseUrl}/api/v1/orders/${sampleOrderId}/payment-sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        method: 'qr',
        purpose: 'deposit',
      }),
    });
    assert.equal(sessionRes.status, 201);
    const sessionBody = await sessionRes.json();
    assert.ok(sessionBody.data.id);
    assert.ok(sessionBody.data.qr_image_url);
    samplePaymentSessionId = sessionBody.data.id;

    const getSessionRes = await fetch(`${baseUrl}/api/v1/payments/${samplePaymentSessionId}`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.equal(getSessionRes.status, 200);
    const getSessionBody = await getSessionRes.json();
    assert.equal(getSessionBody.data.id, samplePaymentSessionId);
  });

  it('ADY01: POST /admin/orders/:order_id/payment-confirmations ghi nhận tiền cọc', async () => {
    const res = await fetch(`${baseUrl}/admin/orders/${sampleOrderId}/payment-confirmations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        kind: 'deposit',
        amount: 500000,
        transaction_reference: 'TRANS_BANK_9999',
        note: 'Khách đã chuyển khoản cọc qua MBBank',
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.order.deposit_status, 'paid');
  });

  // --- NHÓM 6: INV01 - INV03 TỒN KHO ---
  it('INV01 & INV02 & INV03: Quản lý tồn kho theo biến thể', async () => {
    const invRes = await fetch(`${baseUrl}/admin/inventory`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(invRes.status, 200);
    const invBody = await invRes.json();
    assert.ok(Array.isArray(invBody.data));

    const adjRes = await fetch(`${baseUrl}/admin/inventory/adjustments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        product_id: sampleProductId,
        delta: 10,
        reason: 'Nhập thêm hàng từ kho tổng',
      }),
    });
    assert.equal(adjRes.status, 200);

    const histRes = await fetch(`${baseUrl}/admin/inventory/adjustments?product_id=${sampleProductId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(histRes.status, 200);
    const histBody = await histRes.json();
    assert.ok(Array.isArray(histBody.data));
  });

  // --- NHÓM 7: CHAT01 - CHAT03, ADM01 - ADM03 ---
  it('CHAT01 - CHAT03 & ADM01 - ADM03: Quy trình hội thoại khách và quản trị', async () => {
    // Khách mở chat
    const openRes = await fetch(`${baseUrl}/api/v1/conversations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.equal(openRes.status, 200);
    const openBody = await openRes.json();
    assert.ok(openBody.data.id);
    sampleConversationId = openBody.data.id;

    // Khách nhắn tin
    const msgRes = await fetch(`${baseUrl}/api/v1/conversations/${sampleConversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ content: 'Chào shop, sản phẩm có bảo hành không?' }),
    });
    assert.equal(msgRes.status, 201);

    // Admin xem danh sách hội thoại
    const listRes = await fetch(`${baseUrl}/admin/conversations`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(listRes.status, 200);

    // Admin trả lời khách
    const replyRes = await fetch(`${baseUrl}/admin/conversations/${sampleConversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ content: 'Chào bạn, bảo hành chính hãng 12 tháng nhé!' }),
    });
    assert.equal(replyRes.status, 201);
  });

  // --- NHÓM 8: DSH01 & REP01 ---
  it('DSH01 & REP01: Dashboard tổng quan và Báo cáo bán hàng', async () => {
    const dshRes = await fetch(`${baseUrl}/admin/dashboard`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(dshRes.status, 200);
    const dshBody = await dshRes.json();
    assert.ok(dshBody.data.order_count !== undefined);
    assert.ok(dshBody.data.recent_orders);

    const repRes = await fetch(`${baseUrl}/admin/reports/sales?year=2026&format=json`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(repRes.status, 200);
    const repBody = await repRes.json();
    assert.ok(repBody.data.summary);
    assert.ok(Array.isArray(repBody.data.rows));
  });

  // --- NHÓM 9: USR01 - USR05 BẢO VỆ ADMIN ---
  it('USR01 & USR04: Bảo vệ an toàn tuyệt đối, cấm xóa tài khoản admin', async () => {
    // USR01: Admin lấy danh sách người dùng
    const listRes = await fetch(`${baseUrl}/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(listRes.status, 200);

    // USR04: Cấm xóa admin
    const delAdminRes = await fetch(`${baseUrl}/admin/users/${adminUser.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(delAdminRes.status, 403);
    const delBody = await delAdminRes.json();
    assert.equal(delBody.message, 'Không được phép xóa tài khoản quản trị viên (Admin)');
  });

  // --- NHÓM 10: SET01 & SET02 ---
  it('SHOP01 & SET01 & SET02: Cấu hình cửa hàng', async () => {
    const getRes = await fetch(`${baseUrl}/api/v1/shop`);
    assert.equal(getRes.status, 200);
    const getBody = await getRes.json();
    assert.equal(getBody.status, 'success');

    const updateRes = await fetch(`${baseUrl}/admin/settings/shop`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'ABC Shop Official Store',
      }),
    });
    assert.equal(updateRes.status, 200);
    const updateBody = await updateRes.json();
    assert.equal(updateBody.data.name, 'ABC Shop Official Store');
  });
});
