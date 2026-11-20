import { many } from './db.js';

export function withDue(plan) {
  const base = plan.last_checkin_at || plan.approved_at || plan.created_at;
  const next_due = new Date(new Date(base).getTime() + plan.cadence_days * 864e5);
  return { ...plan, next_due, overdue: next_due.getTime() < Date.now() };
}

/** Active plan + check-in + assignment status for a set of users, keyed by user id. */
export async function planStatusFor(userIds) {
  const out = {};
  userIds.forEach((id) => (out[id] = { plan: null, last_checkin_at: null, assignments: { open: 0, overdue: 0, done: 0 } }));
  if (!userIds.length) return out;
  const plans = await many(
    `SELECT p.id, p.user_id, p.title, p.cadence_days, p.approved_at, p.created_at,
            (SELECT count(*) FROM plan_items i WHERE i.plan_id=p.id)::int AS items_total,
            (SELECT count(*) FROM plan_items i WHERE i.plan_id=p.id AND i.completed_at IS NOT NULL)::int AS items_done,
            (SELECT max(c.created_at) FROM checkins c WHERE c.plan_id=p.id) AS last_checkin_at
       FROM plans p WHERE p.status='approved' AND p.user_id = ANY($1)`, [userIds]);
  plans.forEach((p) => { out[p.user_id].plan = withDue(p); out[p.user_id].last_checkin_at = p.last_checkin_at; });
  const asg = await many(
    `SELECT assigned_to AS user_id,
            count(*) FILTER (WHERE status<>'completed')::int AS open,
            count(*) FILTER (WHERE status<>'completed' AND deadline < current_date)::int AS overdue,
            count(*) FILTER (WHERE status='completed')::int AS done
       FROM assignments WHERE assigned_to = ANY($1) GROUP BY assigned_to`, [userIds]);
  asg.forEach((a) => (out[a.user_id].assignments = { open: a.open, overdue: a.overdue, done: a.done }));
  return out;
}

export async function approvalsFor(user) {
  const where = user.role === 'admin' ? '(u.id <> $1 OR u.manager_id IS NULL)' : 'u.manager_id = $1';
  return many(
    `SELECT p.id, p.title, p.role_current, p.role_target, p.submitted_at, p.source,
            u.id AS user_id, u.display_name, u.email, u.avatar_file,
            (SELECT count(*) FROM plan_items i WHERE i.plan_id=p.id)::int AS items_total
       FROM plans p JOIN users u ON u.id=p.user_id
      WHERE p.status='submitted' AND ${where} AND u.is_active
      ORDER BY p.submitted_at`, [user.id]);
}
