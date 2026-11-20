import { Router } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { z } from 'zod';
import { one, q } from '../lib/db.js';
import { requireAuth, setSession } from '../lib/auth.js';
import { HttpError, parse, userOut, sniff, saveUpload, removeUpload } from '../lib/util.js';

const r = Router();
r.use(requireAuth);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024, files: 1 } });

const withManager = (id) => one('SELECT u.*, m.display_name AS manager_name FROM users u LEFT JOIN users m ON m.id=u.manager_id WHERE u.id=$1', [id]);

r.get('/', async (req, res) => res.json({ user: userOut(await withManager(req.user.id)) }));

r.put('/', async (req, res) => {
  const s = (n) => z.string().trim().max(n).optional().default('');
  const b = parse(z.object({ display_name: z.string().trim().min(2, 'enter your name').max(80), job_title: s(120), department: s(120), bio: s(1000), phone: s(40), location: s(120), interests: s(300) }), req.body);
  await q('UPDATE users SET display_name=$1,job_title=$2,department=$3,bio=$4,phone=$5,location=$6,interests=$7 WHERE id=$8',
    [b.display_name, b.job_title, b.department, b.bio, b.phone, b.location, b.interests, req.user.id]);
  res.json({ user: userOut(await withManager(req.user.id)) });
});

r.post('/avatar', upload.single('avatar'), async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Choose an image to upload.');
  const type = sniff(req.file.buffer);
  if (!type || !['png', 'jpg', 'webp', 'gif'].includes(type.ext)) throw new HttpError(400, 'Profile pictures must be PNG, JPG, WebP or GIF images.');
  const name = saveUpload('avatars', req.file.buffer, type.ext);
  removeUpload('avatars', req.user.avatar_file);
  await q('UPDATE users SET avatar_file=$1 WHERE id=$2', [name, req.user.id]);
  res.json({ user: userOut(await withManager(req.user.id)) });
});

r.delete('/avatar', async (req, res) => {
  removeUpload('avatars', req.user.avatar_file);
  await q('UPDATE users SET avatar_file=NULL WHERE id=$1', [req.user.id]);
  res.json({ user: userOut(await withManager(req.user.id)) });
});

r.post('/password', async (req, res) => {
  const b = parse(z.object({
    current_password: z.string().min(1, 'enter your current password'),
    new_password: z.string().min(10, 'must be at least 10 characters').max(128).regex(/[A-Za-z]/, 'must include a letter').regex(/\d/, 'must include a number'),
  }), req.body);
  if (!(await bcrypt.compare(b.current_password, req.user.password_hash))) throw new HttpError(400, 'Your current password is incorrect.');
  const u = await one('UPDATE users SET password_hash=$1, token_version=token_version+1 WHERE id=$2 RETURNING *', [await bcrypt.hash(b.new_password, 12), req.user.id]);
  setSession(res, u); // keep this device signed in, sign out others
  res.json({ ok: true });
});

export default r;
