import { Router } from 'express';
import { one, many } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { planStatusFor, approvalsFor } from '../lib/status.js';

const r = Router();
r.use(requireAuth);

r.get('/', async (req, res) => {
  const u = req.user;
  const st = (await planStatusFor([u.id]))[u.id];
  const focus = st.plan
    ? await one(`SELECT id,title,description,due_date,week,resource_title,resource_url FROM plan_items WHERE plan_id=$1 AND completed_at IS NULL ORDER BY position LIMIT 1`, [st.plan.id])
    : null;
  const counts = await many(`SELECT status, count(*)::int AS n FROM plans WHERE user_id=$1 AND status IN ('draft','submitted','rejected') GROUP BY status`, [u.id]);
  const pending_approvals = ['manager', 'admin'].includes(u.role) ? (await approvalsFor(u)).length : 0;
  const next_assignment = await one(`SELECT id,title,deadline, deadline < current_date AS overdue FROM assignments WHERE assigned_to=$1 AND status<>'completed' ORDER BY deadline LIMIT 1`, [u.id]);
  res.json({
    active_plan: st.plan,
    last_checkin_at: st.last_checkin_at,
    focus,
    plan_states: Object.fromEntries(counts.map((c) => [c.status, c.n])),
    assignments: st.assignments,
    next_assignment,
    pending_approvals,
  });
});
export default r;
