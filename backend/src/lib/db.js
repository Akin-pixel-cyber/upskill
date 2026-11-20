import pg from 'pg';
import fs from 'fs';
import { config } from '../config.js';

pg.types.setTypeParser(1082, (v) => v); // keep DATE columns as 'YYYY-MM-DD' strings
export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });
pool.on('error', (e) => console.error('[db] pool error', e.message));

export const q = (text, params) => pool.query(text, params);
export const one = async (text, params) => (await pool.query(text, params)).rows[0];
export const many = async (text, params) => (await pool.query(text, params)).rows;

export async function tx(fn) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await fn(c);
    await c.query('COMMIT');
    return r;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

export async function migrate() {
  const sql = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
  for (let i = 1; i <= 15; i++) {
    try {
      await pool.query(sql);
      console.log('[db] schema ready');
      return;
    } catch (e) {
      console.warn(`[db] waiting for database (${i}/15): ${e.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('Database not reachable');
}
