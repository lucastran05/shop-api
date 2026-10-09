import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import pool from '../src/config/db.js';
import UserModel from '../src/models/user.model.js';
import { hashToken } from '../src/utils/jwt.js';

describe('Kiểm tra Cơ chế Bảo mật Xác thực: Access Token & Refresh Token', () => {
  let server;
  let baseUrl;
  const testEmail = `sec_user_${Date.now()}@example.com`;
  const testPassword = 'Password@123';
  let accessToken = '';
  let refreshToken = '';
  let userId = '';

  before(async () => {
    // Chạy app trên cổng ngẫu nhiên của hệ điều hành
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}/api/v1`;
        resolve();
      });
    });
  });

  after(async () => {
    // Dọn dẹp dữ liệu kiểm thử
    if (userId) {
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    }
    await new Promise((resolve) => server.close(resolve));
  });

  it('1. Đăng ký tài khoản: Validate email định dạng sai phải trả về 400', async () => {
    const res = await fetch(`${baseUrl}/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bad Email User',
        email: 'invalid-email-format',
        password: testPassword,
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.status, 'error');
  });

  it('2. Đăng ký tài khoản: Mật khẩu ngắn hơn 6 ký tự phải trả về 400', async () => {
    const res = await fetch(`${baseUrl}/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Short Password User',
        email: `short_${Date.now()}@example.com`,
        password: '123',
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.status, 'error');
  });

  it('3. Đăng ký tài khoản hợp lệ: Trả về accessToken, refreshToken và thông tin user', async () => {
    const res = await fetch(`${baseUrl}/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Secured Tester',
        email: testEmail,
        password: testPassword,
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 201);
    assert.equal(body.status, 'success');
    assert.ok(body.data.accessToken, 'Phải có accessToken');
    assert.ok(body.data.refreshToken, 'Phải có refreshToken');
    assert.equal(body.data.user.email, testEmail);

    userId = body.data.user.id;
    accessToken = body.data.accessToken;
    refreshToken = body.data.refreshToken;
  });

  it('4. BẢO MẬT CƠ SỞ DỮ LIỆU: Refresh Token được lưu trong DB phải là chuỗi HASH (không phải plain text)', async () => {
    const dbRes = await pool.query('SELECT rf_token FROM users WHERE id = $1', [userId]);
    const storedRfToken = dbRes.rows[0].rf_token;

    assert.ok(storedRfToken, 'Phải có rf_token trong DB');
    assert.notEqual(storedRfToken, refreshToken, 'DB KHÔNG ĐƯỢC lưu Refresh Token thô (plain-text)!');
    assert.equal(storedRfToken, hashToken(refreshToken), 'rf_token trong DB phải là SHA-256 hash của refreshToken');
  });

  it('5. Đăng nhập: Mật khẩu sai phải trả về 401', async () => {
    const res = await fetch(`${baseUrl}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'WrongPassword999',
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 401);
    assert.equal(data.status, 'error');
  });

  it('6. Đăng nhập thành công: Cấp phát cặp token mới và lưu hash', async () => {
    const res = await fetch(`${baseUrl}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.ok(data.data.accessToken);
    assert.ok(data.data.refreshToken);

    // Cập nhật token sau đăng nhập
    accessToken = data.data.accessToken;
    refreshToken = data.data.refreshToken;
  });

  it('7. GET /users/me: Dùng Access Token hợp lệ lấy thông tin thành công', async () => {
    const res = await fetch(`${baseUrl}/users/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.data.user.id, userId);
  });

  it('8. BẢO VỆ TOKEN CHÉO: Dùng Refresh Token vào Header Authorization của /me phải bị từ chối 401', async () => {
    const res = await fetch(`${baseUrl}/users/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${refreshToken}`,
      },
    });

    const data = await res.json();
    assert.equal(res.status, 401, 'Không được phép dùng Refresh Token thay Access Token');
    assert.equal(data.status, 'error');
  });

  it('9. BẢO VỆ TOKEN CHÉO: Dùng Access Token vào endpoint /refresh-token phải bị từ chối 403', async () => {
    const res = await fetch(`${baseUrl}/users/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refreshToken: accessToken,
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 403, 'Không được phép dùng Access Token để refresh');
    assert.equal(data.status, 'error');
  });

  let rotatedOldRefreshToken = '';
  it('10. Refresh Token Rotation (RTR): Lấy Access Token mới và cấp Refresh Token mới thay thế', async () => {
    rotatedOldRefreshToken = refreshToken;

    const res = await fetch(`${baseUrl}/users/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refreshToken: rotatedOldRefreshToken,
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.ok(data.data.accessToken);
    assert.ok(data.data.refreshToken);
    assert.notEqual(data.data.refreshToken, rotatedOldRefreshToken, 'Refresh Token mới phải khác token cũ (Rotation)');

    // Lưu token mới
    accessToken = data.data.accessToken;
    refreshToken = data.data.refreshToken;

    // Kiểm tra DB đã cập nhật hash của token mới
    const dbRes = await pool.query('SELECT rf_token FROM users WHERE id = $1', [userId]);
    assert.equal(dbRes.rows[0].rf_token, hashToken(refreshToken));
  });

  it('11. CHỐNG TÁI SỬ DỤNG TOKEN (Token Reuse Detection): Tái sử dụng token cũ đã rotate sẽ bị phát hiện và HỦY toàn bộ phiên đăng nhập', async () => {
    // Kẻ tấn công hoặc client cố dùng lại rotatedOldRefreshToken
    const res = await fetch(`${baseUrl}/users/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refreshToken: rotatedOldRefreshToken,
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 403, 'Phải trả về 403 cảnh báo token reuse');
    assert.ok(data.message.includes('Cảnh báo bảo mật') || data.message.includes('tái sử dụng'));

    // Kiểm tra DB: Toàn bộ phiên rf_token của người dùng đã bị hủy (set NULL)
    const dbRes = await pool.query('SELECT rf_token FROM users WHERE id = $1', [userId]);
    assert.equal(dbRes.rows[0].rf_token, null, 'Hệ thống phải tự động thu hồi rf_token trong DB khi phát hiện reuse');
  });

  it('12. KHÓA TÀI KHOẢN (Inactive user): Tài khoản bị khóa (active = false) không được phép đăng nhập', async () => {
    // Tạm khóa tài khoản test
    await pool.query('UPDATE users SET active = false WHERE id = $1', [userId]);

    const res = await fetch(`${baseUrl}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 403, 'Tài khoản active = false phải bị chặn đăng nhập với mã 403');
    assert.ok(data.message.includes('khóa') || data.message.includes('vô hiệu hóa'));

    // Mở lại tài khoản
    await pool.query('UPDATE users SET active = true WHERE id = $1', [userId]);
  });

  it('13. Đăng xuất: Xóa rf_token trong DB để vô hiệu hóa phiên refresh token', async () => {
    // Đăng nhập lại để có token mới
    const loginRes = await fetch(`${baseUrl}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    const loginData = await loginRes.json();
    const currentAccessToken = loginData.data.accessToken;
    const currentRefreshToken = loginData.data.refreshToken;

    // Đăng xuất
    const logoutRes = await fetch(`${baseUrl}/users/logout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${currentAccessToken}`,
      },
    });
    assert.equal(logoutRes.status, 200);

    // Kiểm tra DB: rf_token phải là null
    const dbRes = await pool.query('SELECT rf_token FROM users WHERE id = $1', [userId]);
    assert.equal(dbRes.rows[0].rf_token, null);

    // Thử refresh token sau khi đã logout phải thất bại
    const refreshRes = await fetch(`${baseUrl}/users/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refreshToken: currentRefreshToken,
      }),
    });
    assert.equal(refreshRes.status, 403);
  });
});
