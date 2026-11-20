import { Router } from 'express';
import { z } from 'zod';
import { one, many, tx } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { HttpError, parse, urlOrEmpty } from '../lib/util.js';
import { buildPlan } from '../lib/ai.js';
import { notify, adminIds } from '../lib/notify.js';
import { withDue } from '../lib/status.js';

const r = Router();
r.use(requireAuth);

const COUNTS = `(SELECT count(*) FROM plan_items i WHERE i.plan_id=p.id)::int AS items_total,
                (SELECT count(*) FROM plan_items i WHERE i.plan_id=p.id AND i.completed_at IS NOT NULL)::int AS items_done`;

const interview = z.object({
  role_current: z.string().trim().min(1, 'enter your current role').max(120),
  level: z.string().trim().min(1, 'choose a level').max(40),
  skills: z.array(z.string().trim().min(1).max(60)).min(1, 'add at least one skill').max(40),
  role_target: z.string().trim().min(1, 'enter a target role').max(120),
  domain: z.string().trim().max(120).optional().default(''),
  hours_per_week: z.coerce.number().min(1, 'must be at least 1').max(40, 'must be 40 or fewer'),
  timeline_weeks: z.coerce.number().int().min(2).max(26),
  cadence_days: z.coerce.number().int().min(1).max(60).default(7),
  notes: z.string().trim().max(2000).optional().default(''),
});

const itemSchema = z.object({
  title: z.string().trim().min(1, 'every item needs a title').max(200),
  description: z.string().trim().max(1000).optional().default(''),
  resource_title: z.string().trim().max(200).optional().default(''),
  resource_url: urlOrEmpty,
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use a valid date').nullable().optional(),
  week: z.coerce.number().int().min(1).max(60).optional().default(1),
});

async function loadPlan(id, user) {
  const plan = await one(
    `SELECT p.*, ${COUNTS}, u.display_name AS owner_name, u.email AS owner_email, u.avatar_file AS owner_avatar,
            u.manager_id AS owner_manager_id, m.display_name AS manager_name,
            (SELECT max(c.created_at) FROM checkins c WHERE c.plan_id=p.id) AS last_checkin_at
       FROM plans p JOIN users u ON u.id=p.user_id LEFT JOIN users m ON m.id=u.manager_id WHERE p.id=$1`, [id]);
  if (!plan) throw new HttpError(404, 'Plan not found.');
  const isOwner = plan.user_id === user.id;
  const isApprover = (plan.owner_manager_id === user.id && ['manager', 'admin'].includes(user.role)) || user.role === 'admin';
  if (!(isOwner || isApprover || user.role === 'hr')) throw new HttpError(403, 'You do not have access to this plan.');
  return { plan, isOwner };
}

function canDecide(plan, user) {
  if (plan.status !== 'submitted') return false;
  if (plan.user_id === user.id) return user.role === 'admin' && !plan.owner_manager_id;
  return (plan.owner_manager_id === user.id && ['manager', 'admin'].includes(user.role)) || user.role === 'admin';
}

r.get('/', async (req, res) => {
  const rows = await many(`SELECT p.*, ${COUNTS} FROM plans p WHERE p.user_id=$1 ORDER BY p.updated_at DESC`, [req.user.id]);
  const last = await one('SELECT max(c.created_at) AS t FROM checkins c JOIN plans p ON p.id=c.plan_id WHERE p.user_id=$1 AND p.status=$2', [req.user.id, 'approved']);
  const active = rows.find((p) => p.status === 'approved');
  res.json({
    active: active ? withDue({ ...active, last_checkin_at: last?.t }) : null,
    pending: rows.filter((p) => ['draft', 'submitted', 'rejected'].includes(p.status)),
    history: rows.filter((p) => p.status === 'archived'),
  });
});

r.post('/generate', async (req, res) => {
  const a = parse(interview, req.body);
  const gen = await buildPlan(a);
  const id = await tx(async (c) => {
    const p = (await c.query(
      `INSERT INTO plans(user_id,title,role_current,level,skills,role_target,domain,hours_per_week,timeline_weeks,notes,summary,source,cadence_days)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [req.user.id, gen.title, a.role_current, a.level, JSON.stringify(a.skills), a.role_target, a.domain, a.hours_per_week, a.timeline_weeks, a.notes, gen.summary, gen.source, a.cadence_days])).rows[0].id;
    for (const [i, it] of gen.items.entries()) {
      await c.query('INSERT INTO plan_items(plan_id,position,week,title,description,resource_title,resource_url,due_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
        [p, i, it.week, it.title, it.description, it.resource_title, it.resource_url, it.due_date]);
    }
    return p;
  });
  res.status(201).json({ id, source: gen.source });
});

r.patch('/items/:itemId', async (req, res) => {
  const b = parse(z.object({ completed: z.boolean() }), req.body);
  const it = await one(`SELECT i.id FROM plan_items i JOIN plans p ON p.id=i.plan_id WHERE i.id=$1 AND p.user_id=$2 AND p.status='approved'`, [req.params.itemId, req.user.id]);
  if (!it) throw new HttpError(404, 'Item not found on your active plan.');
  const row = await one(`UPDATE plan_items SET completed_at = ${b.completed ? 'now()' : 'NULL'} WHERE id=$1 RETURNING *`, [it.id]);
  res.json({ item: row });
});

r.get('/:id', async (req, res) => {
  const { plan, isOwner } = await loadPlan(req.params.id, req.user);
  const items = await many('SELECT * FROM plan_items WHERE plan_id=$1 ORDER BY position', [plan.id]);
  const out = plan.status === 'approved' ? withDue(plan) : plan;
  res.json({
    plan: out, items,
    can: {
      edit: isOwner && ['draft', 'rejected'].includes(plan.status),
      toggle: isOwner && plan.status === 'approved',
      decide: canDecide(plan, req.user),
    },
  });
});

r.put('/:id', async (req, res) => {
  const { plan, isOwner } = await loadPlan(req.params.id, req.user);
  if (!isOwner || !['draft', 'rejected'].includes(plan.status)) throw new HttpError(409, 'Only your own draft or rejected plans can be edited.');
  const b = parse(z.object({
    title: z.string().trim().min(1, 'give the plan a title').max(200),
    cadence_days: z.coerce.number().int().min(1).max(60),
    items: z.array(itemSchema).max(80),
  }), req.body);
  await tx(async (c) => {
    await c.query('UPDATE plans SET title=$1,cadence_days=$2,updated_at=now() WHERE id=$3', [b.title, b.cadence_days, plan.id]);
    await c.query('DELETE FROM plan_items WHERE plan_id=$1', [plan.id]);
    for (const [i, it] of b.items.entries()) {
      await c.query('INSERT INTO plan_items(plan_id,position,week,title,description,resource_title,resource_url,due_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
        [plan.id, i, it.week, it.title, it.description, it.resource_title, it.resource_url, it.due_date || null]);
    }
  });
  res.json({ ok: true });
});

r.post('/:id/submit', async (req, res) => {
  const { plan, isOwner } = await loadPlan(req.params.id, req.user);
  if (!isOwner || !['draft', 'rejected'].includes(plan.status)) throw new HttpError(409, 'This plan cannot be submitted right now.');
  if (plan.items_total < 1) throw new HttpError(400, 'Add at least one item before submitting.');
  await one(`UPDATE plans SET status='submitted', submitted_at=now(), updated_at=now() WHERE id=$1 RETURNING id`, [plan.id]);
  const approvers = plan.owner_manager_id ? [plan.owner_manager_id] : await adminIds();
  await notify(approvers.filter((x) => x !== req.user.id), { kind: 'plan_submitted', message: `${req.user.display_name} submitted a learning plan for your approval: ${plan.title}`, link: `/plans/${plan.id}` });
  res.json({ ok: true, awaiting: plan.owner_manager_id ? plan.manager_name : 'an admin (no reporting manager set yet)' });
});

r.post('/:id/decision', async (req, res) => {
  const { plan } = await loadPlan(req.params.id, req.user);
  if (!canDecide(plan, req.user)) throw new HttpError(403, 'You cannot approve or reject this plan.');
  const b = parse(z.object({ decision: z.enum(['approve', 'reject']), comment: z.string().trim().max(2000).optional().default('') }), req.body);
  if (b.decision === 'reject' && b.comment.length < 3) throw new HttpError(400, 'Add a comment so the employee knows what to change.');
  await tx(async (c) => {
    if (b.decision === 'approve') {
      await c.query(`UPDATE plans SET status='archived', updated_at=now() WHERE user_id=$1 AND status='approved'`, [plan.user_id]);
      await c.query(`UPDATE plans SET status='approved', approved_at=now(), decided_by=$2, manager_comment=$3, updated_at=now() WHERE id=$1`, [plan.id, req.user.id, b.comment]);
    } else {
      await c.query(`UPDATE plans SET status='rejected', decided_by=$2, manager_comment=$3, updated_at=now() WHERE id=$1`, [plan.id, req.user.id, b.comment]);
    }
  });
  await notify([plan.user_id], b.decision === 'approve'
    ? { kind: 'plan_approved', message: `Your plan "${plan.title}" was approved and is now your active plan.${b.comment ? ` Comment: ${b.comment}` : ''}`, link: `/plans/${plan.id}` }
    : { kind: 'plan_rejected', message: `Your plan "${plan.title}" needs changes: ${b.comment}`, link: `/plans/${plan.id}` });
  res.json({ ok: true });
});

r.delete('/:id', async (req, res) => {
  const { plan, isOwner } = await loadPlan(req.params.id, req.user);
  if (!isOwner || !['draft', 'rejected'].includes(plan.status)) throw new HttpError(409, 'Only your own draft or rejected plans can be deleted.');
  await one('DELETE FROM plans WHERE id=$1 RETURNING id', [plan.id]);
  res.json({ ok: true });
});

export default r;
