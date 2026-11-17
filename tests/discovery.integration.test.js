import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';

test('Discovery consent, ownership and history on disposable PostgreSQL',
  { skip: !process.env.DISCOVERY_TEST_DATABASE_URL }, async (t) => {
    const url = new URL(process.env.DISCOVERY_TEST_DATABASE_URL);
    assert.equal(url.pathname, '/discovery_test', 'Use the disposable discovery_test database only');
    process.env.DATABASE_URL = url.href;
    const { default: pool, initDB } = await import('../src/config/db.js');
    const { migrateDiscovery } = await import('../src/modules/discovery/migration.js');
    const { default: routes } = await import('../src/modules/discovery/routes.js');
    const { generateAccessToken } = await import('../src/utils/jwt.js');
    const { errorHandler } = await import('../src/common/middlewares/errorHandler.js');
    const users = [];
    let server;
    t.after(async () => {
      if (server) await new Promise((resolve) => server.close(resolve));
      if (users.length) await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [users]);
      await pool.end();
    });
    await initDB();
    await migrateDiscovery();
    await migrateDiscovery();
    for (let i = 0; i < 2; i++) {
      const { rows } = await pool.query(
        "INSERT INTO users (name,email,password,role) VALUES ('discovery test',$1,'test','customer') RETURNING id",
        [`${crypto.randomUUID()}@discovery.test`],
      );
      users.push(rows[0].id);
    }
    const tokens = users.map((id) => generateAccessToken({ id }));
    const app = express();
    app.use(express.json());
    app.use('/discovery', routes);
    app.use(errorHandler);
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/discovery`;
    async function call(path, method = 'GET', body, who = 0) {
      const response = await fetch(base + path, {
        method,
        headers: { authorization: `Bearer ${tokens[who]}`, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: response.status, data: await response.json() };
    }
    assert.equal((await fetch(base + '/preferences')).status, 401);
    assert.equal((await call('/preferences')).data.data.consent, false);
    assert.equal((await call('/feedback', 'POST', { action: 'theme', themeKey: 'gratitude' })).status, 403);
    const preference = await call('/preferences', 'PUT', {
      consent: true, favorite_colors: ['purple'], favorite_themes: ['gratitude'],
    });
    assert.equal(preference.status, 200);
    assert.equal(preference.data.data.consent, true);
    const bluePreference = await call('/preferences', 'PUT', {
      consent: true, favorite_colors: ['blue'], favorite_themes: ['gratitude'],
    });
    assert.deepEqual(bluePreference.data.data.favorite_colors, ['blue']);
    assert.deepEqual((await call('/preferences')).data.data.favorite_colors, ['blue']);
    assert.deepEqual((await pool.query('SELECT favorite_colors FROM discovery_preferences WHERE user_id=$1', [users[0]])).rows[0].favorite_colors, ['blue']);
    assert.equal((await call('/feedback', 'POST', { action: 'theme', themeKey: 'gratitude' })).status, 201);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM discovery_interactions WHERE user_id=$1', [users[0]])).rows[0].n, 1);
    const occasion = { title: 'Ngày sinh nhật', kind: 'birthday', month: 2, day: 29, reminder_days: 7, enabled: true };
    const created = await call('/occasions', 'POST', occasion);
    assert.equal(created.status, 201);
    const id = created.data.data.id;
    assert.equal((await call('/occasions')).data.data.length, 1);
    assert.equal((await call('/occasions', 'POST', { ...occasion, month: 2, day: 31 })).status, 400);
    assert.equal((await call('/occasions', 'POST', { ...occasion, title: '' })).status, 400);
    assert.equal((await call('/occasions', 'GET', undefined, 1)).data.data.length, 0);
    assert.equal((await call('/occasions/' + id, 'PUT', { ...occasion, title: 'Sai chủ' }, 1)).status, 404);
    assert.equal((await call('/occasions/' + id, 'DELETE', undefined, 1)).status, 404);
    assert.equal((await call('/occasions/' + id, 'PUT', { ...occasion, title: 'Sinh nhật mẹ', enabled: false })).data.data.enabled, false);
    assert.equal((await call('/occasions')).data.data[0].title, 'Sinh nhật mẹ');
    assert.equal((await call('/history', 'DELETE')).status, 200);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM discovery_interactions WHERE user_id=$1', [users[0]])).rows[0].n, 0);
    await call('/feedback', 'POST', { action: 'theme', themeKey: 'gratitude' });
    const revoked = await call('/preferences', 'PUT', {
      consent: false, favorite_colors: ['blue'], favorite_themes: ['gratitude'],
    });
    assert.equal(revoked.status, 200);
    assert.deepEqual(revoked.data.data.favorite_colors, []);
    assert.deepEqual(revoked.data.data.favorite_themes, []);
    assert.deepEqual((await call('/preferences')).data.data.favorite_colors, []);
    assert.equal((await call('/occasions')).data.data.length, 1);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM discovery_interactions WHERE user_id=$1', [users[0]])).rows[0].n, 0);
    assert.equal((await call('/feedback', 'POST', { action: 'theme', themeKey: 'gratitude' })).status, 403);
    assert.equal((await call('/occasions/' + id, 'DELETE')).status, 200);
  });
