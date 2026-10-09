import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import pool from '../src/config/db.js';
import { generateAccessToken } from '../src/utils/jwt.js';

describe('Kiểm tra Cơ chế Phân quyền và Bảo vệ toàn bộ API (RBAC & Endpoint Protection)', () => {
  let server;
  let baseUrl;

  let adminUser = {
    id: 'a0000000-0000-0000-0000-000000000001',
    name: 'Admin Tester',
    email: 'admin_test@example.com',
    role: 'admin',
  };

  let customerUser1 = {
    id: 'c0000000-0000-0000-0000-000000000001',
    name: 'Customer 1',
    email: 'cust1_test@example.com',
    role: 'customer',
  };

  let customerUser2 = {
    id: 'c0000000-0000-0000-0000-000000000002',
    name: 'Customer 2',
    email: 'cust2_test@example.com',
    role: 'customer',
  };

  let adminToken = '';
  let cust1Token = '';
  let cust2Token = '';
  let createdProductId = '';
  let createdPaymentId = '';

  before(async () => {
    // Chèn 3 user test vào DB
    await pool.query(
      `INSERT INTO users (id, name, email, password, role)
       VALUES ($1, $2, $3, 'hashed_pw', $4),
              ($5, $6, $7, 'hashed_pw', $8),
              ($9, $10, $11, 'hashed_pw', $12)
       ON CONFLICT (id) DO NOTHING;`,
      [
        adminUser.id, adminUser.name, adminUser.email, adminUser.role,
        customerUser1.id, customerUser1.name, customerUser1.email, customerUser1.role,
        customerUser2.id, customerUser2.name, customerUser2.email, customerUser2.role,
      ]
    );

    adminToken = generateAccessToken(adminUser);
    cust1Token = generateAccessToken(customerUser1);
    cust2Token = generateAccessToken(customerUser2);

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}/api/v1`;
        resolve();
      });
    });
  });

  after(async () => {
    // Dọn dẹp
    if (createdProductId) {
      await pool.query('DELETE FROM products WHERE id = $1', [createdProductId]);
    }
    if (createdPaymentId) {
      await pool.query('DELETE FROM payments WHERE id = $1', [createdPaymentId]);
    }
    await pool.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [
      adminUser.id, customerUser1.id, customerUser2.id,
    ]);
    await new Promise((resolve) => server.close(resolve));
  });

  // --- 1. USER MANAGEMENT PROTECTION ---
  describe('1. Bảo vệ Quản lý Người dùng (Users API)', () => {
    it('1.1. GET /users: Chưa đăng nhập bị từ chối 401', async () => {
      const res = await fetch(`${baseUrl}/users`);
      assert.equal(res.status, 401);
    });

    it('1.2. GET /users: Khách hàng thường (customer) bị từ chối 403', async () => {
      const res = await fetch(`${baseUrl}/users`, {
        headers: { Authorization: `Bearer ${cust1Token}` },
      });
      assert.equal(res.status, 403);
    });

    it('1.3. GET /users: Quản trị viên (admin) xem danh sách thành công 200', async () => {
      const res = await fetch(`${baseUrl}/users`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.data.users));
    });

    it('1.4. GET /users/:id: Khách hàng xem thông tin người khác bị từ chối 403', async () => {
      const res = await fetch(`${baseUrl}/users/${customerUser2.id}`, {
        headers: { Authorization: `Bearer ${cust1Token}` },
      });
      assert.equal(res.status, 403);
    });

    it('1.5. GET /users/:id: Khách hàng xem thông tin chính mình thành công 200', async () => {
      const res = await fetch(`${baseUrl}/users/${customerUser1.id}`, {
        headers: { Authorization: `Bearer ${cust1Token}` },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.data.user.id, customerUser1.id);
    });

    it('1.6. PUT /users/:id: CHỐNG LEO THANG ĐẶC QUYỀN (Privilege Escalation) - User thường không thể tự gán role = "admin"', async () => {
      const res = await fetch(`${baseUrl}/users/${customerUser1.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cust1Token}`,
        },
        body: JSON.stringify({
          name: 'Hacker Name',
          role: 'admin', // Cố tình đổi role
        }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.data.user.name, 'Hacker Name');
      assert.equal(data.data.user.role, 'customer', 'Role của user thường KHÔNG ĐƯỢC PHÉP nâng cấp lên admin!');
    });

    it('1.7. DELETE /users/:id: Khách hàng thường xóa người khác bị từ chối 403', async () => {
      const res = await fetch(`${baseUrl}/users/${customerUser2.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${cust1Token}` },
      });
      assert.equal(res.status, 403);
    });
  });

  // --- 2. PRODUCT MANAGEMENT PROTECTION ---
  describe('2. Bảo vệ Quản lý Sản phẩm (Products API)', () => {
    it('2.1. GET /products: Công khai cho khách vãng lai (200 OK không cần token)', async () => {
      const res = await fetch(`${baseUrl}/products`);
      assert.equal(res.status, 200);
    });

    it('2.2. POST /products: Thêm sản phẩm mà không có token bị từ chối 401', async () => {
      const res = await fetch(`${baseUrl}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Hack Product', category: 'General', price: 100 }),
      });
      assert.equal(res.status, 401);
    });

    it('2.3. POST /products: Khách hàng thường tạo sản phẩm bị từ chối 403', async () => {
      const res = await fetch(`${baseUrl}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cust1Token}`,
        },
        body: JSON.stringify({ name: 'Customer Product', category: 'General', price: 100 }),
      });
      assert.equal(res.status, 403);
    });

    it('2.4. POST /products: Admin tạo sản phẩm thành công 201', async () => {
      const res = await fetch(`${baseUrl}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ name: 'Admin Product', category: 'Electronics', price: 500000, stock: 10 }),
      });
      assert.equal(res.status, 201);
      const data = await res.json();
      createdProductId = data.data.product.id;
    });

    it('2.5. DELETE /products/:id: Khách hàng xóa sản phẩm bị từ chối 403', async () => {
      const res = await fetch(`${baseUrl}/products/${createdProductId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${cust1Token}` },
      });
      assert.equal(res.status, 403);
    });
  });

  // --- 3. PAYMENT PROTECTION & DATA ISOLATION ---
  describe('3. Bảo vệ Thanh toán và Cô lập Dữ liệu (Payments API)', () => {
    it('3.1. GET /payments: Chưa đăng nhập bị từ chối 401', async () => {
      const res = await fetch(`${baseUrl}/payments`);
      assert.equal(res.status, 401);
    });

    it('3.2. POST /payments: Khách hàng tạo thanh toán (tự động gắn đúng user_id của mình)', async () => {
      const res = await fetch(`${baseUrl}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cust1Token}`,
        },
        body: JSON.stringify({
          order_id: 'ORD_TEST_001',
          amount: 250000,
          user_id: customerUser2.id, // Cố tình mạo danh user 2
        }),
      });

      assert.equal(res.status, 201);
      const data = await res.json();
      createdPaymentId = data.data.payment.id;
      assert.equal(
        data.data.payment.user_id,
        customerUser1.id,
        'Hệ thống phải ép buộc user_id về tài khoản đang đăng nhập, không cho mạo danh'
      );
    });

    it('3.3. GET /payments/:id: User khác xem chi tiết thanh toán của người khác bị từ chối 403', async () => {
      const res = await fetch(`${baseUrl}/payments/${createdPaymentId}`, {
        headers: { Authorization: `Bearer ${cust2Token}` },
      });
      assert.equal(res.status, 403);
    });

    it('3.4. PATCH /payments/:id/status: Khách hàng tự đổi trạng thái thanh toán bị từ chối 403', async () => {
      const res = await fetch(`${baseUrl}/payments/${createdPaymentId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cust1Token}`,
        },
        body: JSON.stringify({ status: 'completed' }),
      });
      assert.equal(res.status, 403);
    });

    it('3.5. PATCH /payments/:id/status: Admin duyệt thanh toán thành công 200', async () => {
      const res = await fetch(`${baseUrl}/payments/${createdPaymentId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status: 'completed' }),
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.data.payment.status, 'completed');
    });
  });

  // --- 4. SHOP SETTINGS PROTECTION ---
  describe('4. Bảo vệ Cấu hình Cửa hàng (Shop API)', () => {
    it('4.1. GET /shop: Công khai cho mọi người xem (200 OK)', async () => {
      const res = await fetch(`${baseUrl}/shop`);
      assert.equal(res.status, 200);
    });

    it('4.2. PUT /shop: Khách hàng sửa cấu hình bị từ chối 403', async () => {
      const res = await fetch(`${baseUrl}/shop`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cust1Token}`,
        },
        body: JSON.stringify({ name: 'Defaced Shop' }),
      });
      assert.equal(res.status, 403);
    });

    it('4.3. POST /shop/reset: Khách hàng reset shop bị từ chối 403', async () => {
      const res = await fetch(`${baseUrl}/shop/reset`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cust1Token}` },
      });
      assert.equal(res.status, 403);
    });
  });

  // --- 5. CHAT & NOTIFICATIONS ISOLATION ---
  describe('5. Bảo vệ Chat và Thông báo (Chat & Notifications)', () => {
    it('5.1. GET /chat/conversations: Khách hàng bị cấm xem danh sách tất cả hội thoại (403)', async () => {
      const res = await fetch(`${baseUrl}/chat/conversations`, {
        headers: { Authorization: `Bearer ${cust1Token}` },
      });
      assert.equal(res.status, 403);
    });

    it('5.2. POST /notifications: Khách hàng bị cấm gửi thông báo hệ thống (403)', async () => {
      const res = await fetch(`${baseUrl}/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cust1Token}`,
        },
        body: JSON.stringify({ title: 'Fake System Notice', message: 'You won 1M!' }),
      });
      assert.equal(res.status, 403);
    });

    it('5.3. POST /notifications: Admin gửi thông báo thành công (201)', async () => {
      const res = await fetch(`${baseUrl}/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          title: 'System Update',
          message: 'Server upgrade tonight',
          user_id: customerUser1.id,
        }),
      });
      assert.equal(res.status, 201);
    });
  });
});
