import { Router } from 'express';
import { z } from 'zod';
import { one, many, tx } from '../lib/db.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { HttpError, parse, urlOrEmpty } from '../lib/util.js';
import { notify } from '../lib/notify.js';

const r = Router();
r.use(requireAuth);

const SELECT = `SELECT a.*, a.status<>'completed' AND a.deadline < current_date AS overdue,
  u.display_name AS assignee_name, u.email AS assignee_email, b.display_name AS assigned_by_name
  FROM assignments a JOIN users u ON u.id=a.assigned_to LEFT JOIN users b ON b.id=a.assigned_by`;

r.get('/mine', async (req, res) => {
  res.json({ items: await many(`${SELECT} WHERE a.assigned_to=$1 ORDER BY (a.status='completed'), a.deadline`, [req.user.id]) });
});

r.get('/users', requireRole('hr'), async (req, res) => {
  res.json({ users: await many('SELECT id,display_name,email,job_title FROM users WHERE is_active AND email_verified ORDER BY display_name') });
});

r.get('/', requireRole('hr'), async (req, res) => {
  res.json({ items: await many(`${SELECT} ORDER BY (a.status='completed'), a.deadline LIMIT 500`) });
});

r.post('/', requireRole('hr'), async (req, res) => {
  const b = parse(z.object({
    title: z.string().trim().min(2, 'enter a course title').max(200),
    description: z.string().trim().max(2000).optional().default(''),
    link: urlOrEmpty,
    deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'choose a deadline'),
    user_ids: z.array(z.string().uuid()).min(1, 'choose at least one person').max(100),
  }), req.body);
  if (b.deadline < new Date().toISOString().slice(0, 10)) throw new HttpError(400, 'deadline: choose today or a later date.');
  const valid = (await many('SELECT id FROM users WHERE id = ANY($1) AND is_active', [b.user_ids])).map((x) => x.id);
  if (!valid.length) throw new HttpError(400, 'None of the selected people can receive assignments.');
  await tx(async (c) => {
    for (const uid of valid) await c.query('INSERT INTO assignments(title,description,link,deadline,assigned_to,assigned_by) VALUES($1,$2,$3,$4,$5,$6)', [b.title, b.description, b.link, b.deadline, uid, req.user.id]);
  });
  await notify(valid, { kind: 'assignment', message: `New course assigned: ${b.title} (due ${b.deadline})`, link: '/assignments' });
  res.status(201).json({ created: valid.length });
});

r.patch('/:id', async (req, res) => {
  const b = parse(z.object({ status: z.enum(['not_started', 'in_progress', 'completed']) }), req.body);
  const row = await one(`UPDATE assignments SET status=$1::text, completed_at = CASE WHEN $1::text='completed' THEN now() ELSE NULL END WHERE id=$2 AND assigned_to=$3 RETURNING id`, [b.status, req.params.id, req.user.id]);
  if (!row) throw new HttpError(404, 'Assignment not found.');
  res.json({ item: await one(`${SELECT} WHERE a.id=$1`, [row.id]) });
});

r.delete('/:id', requireRole('hr'), async (req, res) => {
  const row = await one('DELETE FROM assignments WHERE id=$1 RETURNING id', [req.params.id]);
  if (!row) throw new HttpError(404, 'Assignment not found.');
  res.json({ ok: true });
});
export default r;
