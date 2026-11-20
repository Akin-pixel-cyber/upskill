import { Router } from 'express';
import { one, many } from '../lib/db.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { HttpError } from '../lib/util.js';
import { planStatusFor, approvalsFor } from '../lib/status.js';

const r = Router();
r.use(requireAuth);

r.get('/', requireRole('manager'), async (req, res) => {
  const people = await many('SELECT id,email,display_name,job_title,avatar_file FROM users WHERE manager_id=$1 AND is_active ORDER BY display_name', [req.user.id]);
  const st = await planStatusFor(people.map((p) => p.id));
  res.json({
    reports: people.map((p) => ({ ...p, ...st[p.id] })),
    approvals: await approvalsFor(req.user),
  });
});

r.get('/:userId', async (req, res) => {
  const u = await one('SELECT id,email,display_name,job_title,manager_id FROM users WHERE id=$1', [req.params.userId]);
  const allowed = u && (u.manager_id === req.user.id || ['hr', 'admin'].includes(req.user.role));
  if (!allowed) throw new HttpError(404, 'Person not found.');
  const checkins = await many(
    `SELECT c.id,c.progress,c.blockers,c.next_steps,c.evidence_link,c.evidence_file,c.evidence_name,c.created_at,
            COALESCE(p.title,a.title) AS target
       FROM checkins c LEFT JOIN plans p ON p.id=c.plan_id LEFT JOIN assignments a ON a.id=c.assignment_id
      WHERE c.user_id=$1 ORDER BY c.created_at DESC LIMIT 10`, [u.id]);
  const assignments = await many(`SELECT id,title,deadline,status, status<>'completed' AND deadline < current_date AS overdue FROM assignments WHERE assigned_to=$1 ORDER BY deadline DESC LIMIT 20`, [u.id]);
  const plans = await many(`SELECT id,title,status FROM plans WHERE user_id=$1 AND status IN ('approved','submitted') ORDER BY updated_at DESC`, [u.id]);
  res.json({ user: u, checkins, assignments, plans });
});
export default r;
