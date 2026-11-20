import { q, one } from './db.js';
import { config } from '../config.js';
import { sendMail } from './mail.js';

/** Create in-app notifications and (optionally) email them. `dedupe` makes it idempotent per user. */
export async function notify(userIds, { kind, message, link = '', dedupe = null, email = true }) {
  for (const id of [...new Set(userIds)]) {
    const key = dedupe ? `${dedupe}:${id}` : null;
    const row = await one(
      `INSERT INTO notifications(user_id,kind,message,link,dedupe_key) VALUES($1,$2,$3,$4,$5)
       ON CONFLICT (dedupe_key) DO NOTHING RETURNING id`,
      [id, kind, message, link, key]
    );
    if (row && email) {
      const u = await one('SELECT email,display_name FROM users WHERE id=$1', [id]);
      if (u) sendMail(u.email, `Exquis Upskill: ${message}`, `Hi ${u.display_name},\n\n${message}`, { url: config.appUrl + (link || ''), label: 'Open Upskill' }).catch(() => {});
    }
  }
}

export const adminIds = async () => (await q("SELECT id FROM users WHERE role='admin' AND is_active")).rows.map((r) => r.id);
