import { Router } from 'express';
import { z } from 'zod';
import { one, many, q } from '../lib/db.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { HttpError, parse } from '../lib/util.js';

const r = Router();
r.use(requireAuth, requireRole('admin'));

r.get('/users', async (req, res) => {
  const users = await many(
    `SELECT u.id,u.email,u.display_name,u.role,u.manager_id,m.display_name AS manager_name,u.is_active,u.email_verified,u.avatar_file,u.job_title,u.created_at
       FROM users u LEFT JOIN users m ON m.id=u.manager_id ORDER BY u.display_name`);
  res.json({ users });
});

r.patch('/users/:id', async (req, res) => {
  const b = parse(z.object({
    role: z.enum(['employee', 'manager', 'hr', 'admin']).optional(),
    manager_id: z.string().uuid().nullable().optional(),
    is_active: z.boolean().optional(),
  }), req.body);
  const target = await one('SELECT * FROM users WHERE id=$1', [req.params.id]);
  if (!target) throw new HttpError(404, 'User not found.');
  const isSelf = target.id === req.user.id;
  let notice = null;

  if (b.is_active === false && isSelf) throw new HttpError(400, 'You cannot deactivate your own account.');
  if (b.role && b.role !== 'admin' && target.role === 'admin') {
    const { n } = await one(`SELECT count(*)::int AS n FROM users WHERE role='admin' AND is_active AND id<>$1`, [target.id]);
    if (n < 1) throw new HttpError(400, 'There must always be at least one active admin.');
  }
  if (b.manager_id) {
    if (b.manager_id === target.id) throw new HttpError(400, 'A person cannot report to themselves.');
    const m = await one('SELECT role,is_active FROM users WHERE id=$1', [b.manager_id]);
    if (!m || !m.is_active || !['manager', 'admin'].includes(m.role)) throw new HttpError(400, 'Choose an active Manager or Admin as the reporting manager.');
  }

  if (b.role !== undefined) {
    await q('UPDATE users SET role=$1 WHERE id=$2', [b.role, target.id]);
    if (!['manager', 'admin'].includes(b.role) && ['manager', 'admin'].includes(target.role)) {
      const { rowCount } = await q('UPDATE users SET manager_id=NULL WHERE manager_id=$1', [target.id]);
      if (rowCount) notice = `${rowCount} direct report(s) now have no manager. Assign them a new one.`;
    }
  }
  if (b.manager_id !== undefined) await q('UPDATE users SET manager_id=$1 WHERE id=$2', [b.manager_id, target.id]);
  if (b.is_active !== undefined) await q('UPDATE users SET is_active=$1, token_version=token_version+1 WHERE id=$2', [b.is_active, target.id]);
  res.json({ ok: true, notice });
});
export default r;
