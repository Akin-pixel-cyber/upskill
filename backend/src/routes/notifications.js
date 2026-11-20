import { Router } from 'express';
import { q, many, one } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';

const r = Router();
r.use(requireAuth);

r.get('/', async (req, res) => {
  const items = await many('SELECT id,kind,message,link,read_at,created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 40', [req.user.id]);
  const { n } = await one('SELECT count(*)::int AS n FROM notifications WHERE user_id=$1 AND read_at IS NULL', [req.user.id]);
  res.json({ items, unread: n });
});
r.post('/read-all', async (req, res) => {
  await q('UPDATE notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL', [req.user.id]);
  res.json({ ok: true });
});
r.post('/:id/read', async (req, res) => {
  await q('UPDATE notifications SET read_at=now() WHERE id=$1 AND user_id=$2 AND read_at IS NULL', [req.params.id, req.user.id]);
  res.json({ ok: true });
});
export default r;
