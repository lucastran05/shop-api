import { readFile } from 'node:fs/promises';
import pool from '../../config/db.js';

export async function migrateDiscovery() {
  const sql = await readFile(new URL('./migrations/001_up.sql', import.meta.url), 'utf8');
  await pool.query(sql);
  await pruneDiscoveryInteractions();
}

export async function pruneDiscoveryInteractions() {
  await pool.query("DELETE FROM discovery_interactions WHERE created_at < NOW() - INTERVAL '90 days'");
}

export function startDiscoveryRetention() {
  const timer = setInterval(() => {
    pruneDiscoveryInteractions().catch((error) => console.error('[Discovery] Retention cleanup failed:', error));
  }, 24 * 60 * 60 * 1000);
  timer.unref?.();
  return timer;
}
