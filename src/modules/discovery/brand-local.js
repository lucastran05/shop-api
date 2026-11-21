// Explicit local-only shop setting update. Never imported by server startup.
import 'dotenv/config';
import pool from '../../config/db.js';

const host = new URL(process.env.CLIENT_URL || '').hostname;
if (process.env.DISCOVERY_LOCAL_BRAND !== '1' || !['localhost', '127.0.0.1'].includes(host)) {
  throw new Error('Local brand update requires DISCOVERY_LOCAL_BRAND=1 and localhost CLIENT_URL.');
}
try {
  const { rows } = await pool.query('SELECT id, name FROM shop_settings ORDER BY created_at ASC');
  if (rows.length !== 1) throw new Error('Expected exactly one local shop setting; no update made.');
  const current = rows[0];
  if (current.name === 'Bloomora') console.log('Already Bloomora; no update made.');
  else if (current.name !== 'ABC Shop') throw new Error('Shop name was customized; no update made.');
  else if (process.argv.includes('--apply')) {
    const updated = await pool.query("UPDATE shop_settings SET name='Bloomora', updated_at=NOW() WHERE id=$1 AND name='ABC Shop' RETURNING id", [current.id]);
    console.log(JSON.stringify({ updated: updated.rowCount, previousName: 'ABC Shop', newName: 'Bloomora' }));
  } else console.log(JSON.stringify({ planned: 1, previousName: 'ABC Shop', newName: 'Bloomora', apply: false }));
} finally { await pool.end(); }
