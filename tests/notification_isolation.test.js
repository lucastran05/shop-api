import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import pool from '../src/config/db.js';
import { generateAccessToken } from '../src/utils/jwt.js';

describe('Notification Isolation and Delivery Test', () => {
  let server;
  let baseUrl;
  const custId = 'c1111111-1111-1111-1111-111111111111';
  const custEmail = 'notif_cust@example.com';
  const adminId = 'a1111111-1111-1111-1111-111111111111';
  let custToken;
  let adminToken;
  let notifByUserId;
  let notifByEmail;
  let notifBroadcast;

  before(async () => {
    await pool.query(
      `INSERT INTO users (id, name, email, password, role)
       VALUES ($1, 'Notif Cust', $2, 'hashed_pw', 'customer'),
              ($3, 'Notif Admin', 'notif_admin@example.com', 'hashed_pw', 'admin')
       ON CONFLICT (id) DO NOTHING;`,
      [custId, custEmail, adminId]
    );

    custToken = generateAccessToken({ id: custId, email: custEmail, role: 'customer' });
    adminToken = generateAccessToken({ id: adminId, email: 'notif_admin@example.com', role: 'admin' });

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}/api/v1`;
        resolve();
      });
    });
  });

  after(async () => {
    await pool.query('DELETE FROM notifications WHERE user_id = $1 OR owner = $2 OR title LIKE $3', [
      custId, custEmail, 'Test Notif %'
    ]);
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [custId, adminId]);
    await new Promise((resolve) => server.close(resolve));
  });

  it('Customer must receive notifications assigned by user_id', async () => {
    // Admin creates notification assigned by user_id only (owner is blank)
    const postRes = await fetch(`${baseUrl}/notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Test Notif by user_id',
        message: 'Your order has arrived',
        user_id: custId,
      }),
    });
    const postData = await postRes.json();
    assert.equal(postRes.status, 201);
    notifByUserId = postData.data.notification.id;

    // Customer fetches notifications
    const getRes = await fetch(`${baseUrl}/notifications`, {
      headers: { Authorization: `Bearer ${custToken}` },
    });
    const getData = await getRes.json();
    assert.equal(getRes.status, 200);

    const found = getData.data.notifications.some((n) => n.id === notifByUserId);
    assert.ok(found, 'Customer must be able to see notification addressed to their user_id!');
  });

  it('Customer must receive notifications assigned by email owner', async () => {
    // Admin creates notification assigned by email owner only (user_id is blank)
    const postRes = await fetch(`${baseUrl}/notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Test Notif by email',
        message: 'Welcome email promo',
        owner: custEmail,
      }),
    });
    const postData = await postRes.json();
    assert.equal(postRes.status, 201);
    notifByEmail = postData.data.notification.id;

    // Customer fetches notifications
    const getRes = await fetch(`${baseUrl}/notifications`, {
      headers: { Authorization: `Bearer ${custToken}` },
    });
    const getData = await getRes.json();
    assert.equal(getRes.status, 200);

    const found = getData.data.notifications.some((n) => n.id === notifByEmail);
    assert.ok(found, 'Customer must be able to see notification addressed to their email owner!');
  });
});
