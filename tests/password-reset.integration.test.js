import test from 'node:test';
import assert from 'node:assert/strict';
import { once, EventEmitter } from 'node:events';
import express from 'express';
import { WebSocket } from 'ws';

test('password recovery HTTP and session lifecycle on isolated PostgreSQL', {
  skip: process.env.AUTH_TEST_DATABASE !== 'auth_test',
  timeout: 30000,
}, async (t) => {
  assert.equal(process.env.DB_NAME, 'auth_test', 'Use only the disposable auth_test database');
  assert.ok(!process.env.DATABASE_URL, 'DATABASE_URL must be unset for this test');
  const { default: pool, initDB } = await import('../src/config/db.js');
  const { default: routes } = await import('../src/routes/auth.routes.js');
  const { default: identity } = await import('../src/modules/identity/identity.repository.js');
  const { passwordResetMail } = await import('../src/services/password-reset-mail.js');
  const { verifyAuth } = await import('../src/middlewares/auth.middleware.js');
  const { default: errorHandler } = await import('../src/common/middlewares/errorHandler.js');
  const { attachChatSocket } = await import('../src/services/chat-socket.js');
  const { hashToken } = await import('../src/utils/jwt.js');
  let userId;
  t.after(async () => {
    if (userId) await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    await pool.end();
  });
  await initDB();
  await initDB();
  const mails = [];
  t.mock.method(passwordResetMail, 'send', async (email, url) => mails.push({ email, url }));
  const app = express();
  app.use(express.json());
  app.use('/auth', routes);
  app.get('/private', verifyAuth, (req, res) => res.json({ id: req.user.id }));
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  const events = new EventEmitter();
  const closeSockets = attachChatSocket(server, { events });
  t.after(() => { closeSockets(); server.close(); });
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  async function post(path, body) {
    const response = await fetch(base + '/auth/' + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }
  const email = `reset-${crypto.randomUUID()}@example.test`;
  const registered = await post('register', { name: 'Reset test', email, password: 'old-password' });
  assert.equal(registered.status, 201);
  userId = registered.body.data.id;
  const oldAccess = registered.body.data.accessToken;
  const oldRefresh = registered.body.data.refreshToken;
  const privateStatus = async (token) => (await fetch(base + '/private', { headers: { Authorization: `Bearer ${token}` } })).status;
  assert.equal(await privateStatus(oldAccess), 200);
  const socket = new WebSocket(base.replace('http:', 'ws:') + '/api/v1/chat/socket');
  await once(socket, 'open');
  const ready = once(socket, 'message');
  socket.send(JSON.stringify({ type: 'auth', token: oldAccess }));
  assert.equal(JSON.parse((await ready)[0]).type, 'ready');

  const accepted = await post('forgot-password', { email: ` ${email.toUpperCase()} ` });
  assert.equal(accepted.status, 200);
  assert.equal(mails.length, 1);
  assert.deepEqual(await post('forgot-password', { email: 'missing@example.test' }), accepted);
  assert.deepEqual(await post('forgot-password', { email }), accepted);
  assert.equal(mails.length, 1, 'Cooldown prevents duplicate mail');
  const tokenFromMail = () => new URLSearchParams(new URL(mails.at(-1).url).hash.slice(1)).get('token');
  const token = tokenFromMail();
  const row = (await pool.query('SELECT password_reset_hash, password_reset_expires_at FROM users WHERE id=$1', [userId])).rows[0];
  assert.equal(row.password_reset_hash, hashToken(token));
  assert.ok(row.password_reset_expires_at > new Date());
  const resetBody = { token, password: 'new-password', password_confirmation: 'new-password' };
  assert.equal((await post('reset-password', { ...resetBody, password_confirmation: 'wrong' })).status, 400);
  const concurrent = await Promise.all([post('reset-password', resetBody), post('reset-password', resetBody)]);
  assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 400]);
  assert.equal(await privateStatus(oldAccess), 401);
  const closed = once(socket, 'close');
  events.emit('message', { customer: { id: userId }, message: { content: 'must not arrive' } });
  assert.equal((await closed)[0], 4403, 'Existing chat connection is revoked');
  const stale = new WebSocket(base.replace('http:', 'ws:') + '/api/v1/chat/socket');
  await once(stale, 'open');
  const rejected = once(stale, 'close');
  stale.send(JSON.stringify({ type: 'auth', token: oldAccess }));
  assert.equal((await rejected)[0], 4403);
  assert.equal((await post('refresh-token', { refreshToken: oldRefresh })).status, 403);
  assert.equal((await post('login', { email, password: 'old-password' })).status, 401);
  const login = await post('login', { email, password: 'new-password' });
  assert.equal(login.status, 200);
  assert.equal(await privateStatus(login.body.data.accessToken), 200);
  assert.equal((await post('refresh-token', { refreshToken: oldRefresh })).status, 403);
  assert.equal((await post('refresh-token', { refreshToken: login.body.data.refreshToken })).status, 200);

  async function requestAgain() {
    await pool.query("UPDATE users SET password_reset_requested_at = NOW() - INTERVAL '61 seconds' WHERE id=$1", [userId]);
    await post('forgot-password', { email });
    return tokenFromMail();
  }
  const expired = await requestAgain();
  await pool.query("UPDATE users SET password_reset_expires_at = NOW() - INTERVAL '1 second' WHERE id=$1", [userId]);
  assert.equal((await post('reset-password', { ...resetBody, token: expired })).status, 400);
  const replaced = await requestAgain();
  const replacement = await requestAgain();
  assert.notEqual(replaced, replacement);
  assert.equal((await post('reset-password', { ...resetBody, token: replaced })).status, 400);

  await pool.query('UPDATE users SET active=FALSE WHERE id=$1', [userId]);
  assert.equal((await post('reset-password', { ...resetBody, token: replacement })).status, 400);
  const mailCount = mails.length;
  assert.deepEqual(await post('forgot-password', { email }), accepted);
  assert.equal(mails.length, mailCount);
  await pool.query('UPDATE users SET active=TRUE WHERE id=$1', [userId]);
  const beforeAdminChange = await requestAgain();
  await identity.update(userId, { email: 'changed-' + email });
  assert.equal((await post('reset-password', { ...resetBody, token: beforeAdminChange })).status, 400);
  assert.equal(await privateStatus(login.body.data.accessToken), 401);

  for (let i = 0; i < 31; i++) {
    const limited = await post('forgot-password', { email: 'missing@example.test' });
    if (i === 30) assert.equal(limited.status, 429);
  }
});
