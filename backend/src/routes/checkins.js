import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { z } from 'zod';
import { one, many, tx } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { HttpError, parse, urlOrEmpty, sniff, saveUpload } from '../lib/util.js';
import { planStatusFor } from '../lib/status.js';

const r = Router();
r.use(requireAuth);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

r.get('/targets', async (req, res) => {
  const st = (await planStatusFor([req.user.id]))[req.user.id];
  let plan = null;
  if (st.plan) {
    const items = await many('SELECT id,title,week,due_date,completed_at FROM plan_items WHERE plan_id=$1 ORDER BY position', [st.plan.id]);
    const owner = await one('SELECT m.display_name FROM plans p JOIN users u ON u.id=p.user_id LEFT JOIN users m ON m.id=p.decided_by WHERE p.id=$1', [st.plan.id]);
    plan = { ...st.plan, items, approved_by: owner?.display_name || null };
  }
  const assignments = await many(
    `SELECT a.id,a.title,a.description,a.link,a.deadline,a.status, a.deadline < current_date AS overdue, b.display_name AS assigned_by_name
       FROM assignments a LEFT JOIN users b ON b.id=a.assigned_by WHERE a.assigned_to=$1 AND a.status<>'completed' ORDER BY a.deadline`, [req.user.id]);
  res.json({ plan, assignments });
});

r.get('/mine', async (req, res) => {
  res.json({ items: await many(
    `SELECT c.id,c.progress,c.blockers,c.next_steps,c.evidence_link,c.evidence_file,c.evidence_name,c.created_at, COALESCE(p.title,a.title) AS target
       FROM checkins c LEFT JOIN plans p ON p.id=c.plan_id LEFT JOIN assignments a ON a.id=c.assignment_id
      WHERE c.user_id=$1 ORDER BY c.created_at DESC LIMIT 15`, [req.user.id]) });
});

r.post('/', upload.single('file'), async (req, res) => {
  const b = parse(z.object({
    target_type: z.enum(['plan', 'assignment']),
    target_id: z.string().uuid('choose what this check-in is for'),
    progress: z.string().trim().min(3, 'tell us what progress you made').max(5000),
    blockers: z.string().trim().max(5000).optional().default(''),
    next_steps: z.string().trim().max(5000).optional().default(''),
    link: urlOrEmpty,
    mark_complete: z.enum(['true', 'false']).optional().default('false'),
    complete_item_ids: z.string().optional().default('[]'),
  }), req.body);

  let fileName = null, origName = null;
  if (req.file) {
    const t = sniff(req.file.buffer);
    let ext = t?.ext;
    if (ext === 'zip') ext = ['docx', 'xlsx', 'pptx'].find((e) => req.file.originalname.toLowerCase().endsWith('.' + e));
    if (!ext) throw new HttpError(400, 'Evidence must be an image, PDF, or Word/Excel/PowerPoint file up to 10 MB. For anything else, add a link.');
    fileName = saveUpload('evidence', req.file.buffer, ext);
    origName = path.basename(req.file.originalname).slice(0, 150);
  }

  const result = await tx(async (c) => {
    let planId = null, assignmentId = null;
    if (b.target_type === 'plan') {
      const p = (await c.query(`SELECT id FROM plans WHERE id=$1 AND user_id=$2 AND status='approved'`, [b.target_id, req.user.id])).rows[0];
      if (!p) throw new HttpError(404, 'That plan is not your active plan.');
      planId = p.id;
      let ids = [];
      try { ids = JSON.parse(b.complete_item_ids); } catch { /* ignore */ }
      ids = Array.isArray(ids) ? ids.filter((x) => /^[0-9a-f-]{36}$/i.test(x)) : [];
      if (ids.length) await c.query('UPDATE plan_items SET completed_at=now() WHERE plan_id=$1 AND id = ANY($2) AND completed_at IS NULL', [planId, ids]);
    } else {
      const a = (await c.query(`SELECT id,status FROM assignments WHERE id=$1 AND assigned_to=$2`, [b.target_id, req.user.id])).rows[0];
      if (!a) throw new HttpError(404, 'That assignment is not yours.');
      assignmentId = a.id;
      if (b.mark_complete === 'true') await c.query(`UPDATE assignments SET status='completed', completed_at=now() WHERE id=$1`, [a.id]);
      else if (a.status === 'not_started') await c.query(`UPDATE assignments SET status='in_progress' WHERE id=$1`, [a.id]);
    }
    return (await c.query(
      `INSERT INTO checkins(user_id,plan_id,assignment_id,progress,blockers,next_steps,evidence_link,evidence_file,evidence_name)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,created_at`,
      [req.user.id, planId, assignmentId, b.progress, b.blockers, b.next_steps, b.link, fileName, origName])).rows[0];
  });
  res.status(201).json({ checkin: result });
});
export default r;
