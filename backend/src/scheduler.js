import { many } from './lib/db.js';
import { notify } from './lib/notify.js';

/** Creates overdue notifications (once per missed due date / assignment). Runs hourly. */
export async function checkOverdue() {
  const plans = await many(
    `SELECT p.id, p.user_id, p.title,
            COALESCE(max(c.created_at), p.approved_at) + (p.cadence_days * interval '1 day') AS due
       FROM plans p JOIN users u ON u.id=p.user_id LEFT JOIN checkins c ON c.plan_id=p.id
      WHERE p.status='approved' AND u.is_active
      GROUP BY p.id
     HAVING COALESCE(max(c.created_at), p.approved_at) + (p.cadence_days * interval '1 day') < now()`);
  for (const p of plans) {
    await notify([p.user_id], { kind: 'checkin_overdue', message: `Your check-in for "${p.title}" is overdue. Share a quick progress update.`, link: '/checkin', dedupe: `overdue:${p.id}:${new Date(p.due).toISOString().slice(0, 10)}` });
  }
  const asg = await many(`SELECT a.id,a.title,a.assigned_to FROM assignments a JOIN users u ON u.id=a.assigned_to WHERE a.status<>'completed' AND a.deadline < current_date AND u.is_active`);
  for (const a of asg) {
    await notify([a.assigned_to], { kind: 'assignment_overdue', message: `The course "${a.title}" is past its deadline.`, link: '/assignments', dedupe: `asg-overdue:${a.id}` });
  }
}

export function startScheduler() {
  const run = () => checkOverdue().catch((e) => console.error('[scheduler]', e.message));
  setTimeout(run, 30_000);
  setInterval(run, 60 * 60 * 1000);
}
