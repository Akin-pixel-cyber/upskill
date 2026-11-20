import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { config } from '../config.js';
import { one } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { HttpError, FILE_NAME_RE } from '../lib/util.js';

const r = Router();
r.use(requireAuth);

r.get('/:kind/:name', async (req, res) => {
  const { kind, name } = req.params;
  if (!['avatars', 'evidence'].includes(kind) || !FILE_NAME_RE.test(name)) throw new HttpError(404, 'File not found.');
  if (kind === 'evidence') {
    const c = await one('SELECT c.user_id, c.evidence_name, u.manager_id FROM checkins c JOIN users u ON u.id=c.user_id WHERE c.evidence_file=$1', [name]);
    const me = req.user;
    if (!c || !(c.user_id === me.id || c.manager_id === me.id || ['hr', 'admin'].includes(me.role))) throw new HttpError(404, 'File not found.');
    const ext = name.split('.').pop();
    const inline = ['png', 'jpg', 'gif', 'webp', 'pdf'].includes(ext);
    const fname = encodeURIComponent(c.evidence_name || name);
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${fname}`);
  }
  const file = path.join(config.uploadDir, kind, name);
  if (!fs.existsSync(file)) throw new HttpError(404, 'File not found.');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.sendFile(file);
});
export default r;
