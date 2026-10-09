import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import pool from '../src/config/db.js';

describe('Session Revocation upon Password Change & Deactivation', () => {
  let server;
  let baseUrl;
  let testUser = {
    name: 'Revoke Tester',
    email: `revoke_${Date.now()}@example.com`,
    password: 'InitialPassword123',
  };
  let userId;
  let accessToken;
  let refreshToken;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}/api/v1`;
        resolve();
      });
    });

    const regRes = await fetch(`${baseUrl}/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    });
    const regData = await regRes.json();
    userId = regData.data.user.id;
    accessToken = regData.data.accessToken;
    refreshToken = regData.data.refreshToken;
  });

  after(async () => {
    if (userId) {
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    }
    await new Promise((resolve) => server.close(resolve));
  });

  it('1. Refresh Token must be revoked immediately when password is changed', async () => {
    // User updates their password
    const updateRes = await fetch(`${baseUrl}/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        password: 'NewStrongPassword456',
      }),
    });
    assert.equal(updateRes.status, 200);

    // DB rf_token must be set to null
    const dbRes = await pool.query('SELECT rf_token FROM users WHERE id = $1', [userId]);
    assert.equal(dbRes.rows[0].rf_token, null, 'Changing password must wipe existing rf_token from DB!');

    // Trying to refresh with the old refresh token must fail with 403
    const refreshRes = await fetch(`${baseUrl}/users/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    assert.equal(refreshRes.status, 403, 'Old refresh token must be rejected after password change!');
  });

  it('2. Refresh Token must be revoked immediately when account is deactivated (active = false)', async () => {
    // Log in with new password to get new tokens
    const loginRes = await fetch(`${baseUrl}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: 'NewStrongPassword456',
      }),
    });
    const loginData = await loginRes.json();
    assert.equal(loginRes.status, 200);
    const newRfToken = loginData.data.refreshToken;

    // Admin or system sets active = false
    await pool.query('UPDATE users SET active = false, rf_token = NULL WHERE id = $1', [userId]);

    // Refresh token request must fail
    const refreshRes = await fetch(`${baseUrl}/users/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: newRfToken }),
    });
    assert.equal(refreshRes.status, 403);
  });
});
