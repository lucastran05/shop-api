import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import pool from '../src/config/db.js';

describe('RTR Race Condition Attack Test', () => {
  let server;
  let baseUrl;
  let userId;
  let refreshToken;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}/api/v1`;
        resolve();
      });
    });

    const email = `race_${Date.now()}@example.com`;
    const regRes = await fetch(`${baseUrl}/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Race Tester', email, password: 'password123' }),
    });
    const regData = await regRes.json();
    userId = regData.data.user.id;
    refreshToken = regData.data.refreshToken;
  });

  after(async () => {
    if (userId) {
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    }
    await new Promise((resolve) => server.close(resolve));
  });

  it('Concurrent /refresh-token with the SAME valid token should not invalidate the entire session', async () => {
    // Two simultaneous requests using the same refresh token
    const [res1, res2] = await Promise.all([
      fetch(`${baseUrl}/users/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      }),
      fetch(`${baseUrl}/users/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      }),
    ]);

    const data1 = await res1.json();
    const data2 = await res2.json();

    console.log('Res 1:', res1.status, data1);
    console.log('Res 2:', res2.status, data2);

    // Check DB
    const dbRes = await pool.query('SELECT rf_token FROM users WHERE id = $1', [userId]);
    console.log('DB rf_token is:', dbRes.rows[0].rf_token);

    // If both or at least one succeeded, the resulting session MUST remain valid!
    // i.e. dbRes.rows[0].rf_token must NOT be null!
    assert.notEqual(dbRes.rows[0].rf_token, null, 'User session should NOT be wiped out by concurrent requests!');
  });
});
