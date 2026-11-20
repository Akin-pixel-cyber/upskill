import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { q, one } from '../lib/db.js';
import { HttpError, parse, sha256, userOut } from '../lib/util.js';
import { sendMail } from '../lib/mail.js';
import { setSession, COOKIE, requireAuth } from '../lib/auth.js';

const r = Router();
r.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Please wait a few minutes and try again.' } }));

const email = z.string().trim().toLowerCase().email('enter a valid email address');
const password = z.string().min(10, 'must be at least 10 characters').max(128).regex(/[A-Za-z]/, 'must include a letter').regex(/\d/, 'must include a number');
const domainOk = (e) => e.split('@').length === 2 && e.endsWith('@' + config.emailDomain);
const DUMMY = bcrypt.hashSync('not-a-real-password', 10);

async function issueToken(userId, kind, hours) {
  await q('DELETE FROM auth_tokens WHERE user_id=$1 AND kind=$2', [userId, kind]);
  const raw = crypto.randomBytes(32).toString('hex');
  await q(`INSERT INTO auth_tokens(user_id,kind,token_hash,expires_at) VALUES($1,$2,$3, now() + ($4 || ' hours')::interval)`, [userId, kind, sha256(raw), String(hours)]);
  return raw;
}

async function sendVerification(user) {
  const url = `${config.appUrl}/verify?token=${await issueToken(user.id, 'verify', 24)}`;
  await sendMail(user.email, 'Verify your Exquis Upskill account', `Hi ${user.display_name},\n\nWelcome to Exquis Upskill. Please confirm your email address to activate your account. This link expires in 24 hours.`, { url, label: 'Verify email' });
}

r.post('/signup', async (req, res) => {
  const b = parse(z.object({ email, password, display_name: z.string().trim().min(2, 'enter your name').max(80) }), req.body);
  if (!domainOk(b.email)) throw new HttpError(400, `Only @${config.emailDomain} email addresses can sign up.`);
  if (await one('SELECT 1 FROM users WHERE email=$1', [b.email])) throw new HttpError(409, 'An account with this email already exists. Try signing in or resetting your password.');
  const role = config.adminEmails.includes(b.email) ? 'admin' : 'employee';
  const user = await one('INSERT INTO users(email,password_hash,display_name,role) VALUES($1,$2,$3,$4) RETURNING *', [b.email, await bcrypt.hash(b.password, 12), b.display_name, role]);
  await sendVerification(user);
  res.status(201).json({ ok: true, message: 'Account created. Check your email for a verification link.' });
});

r.post('/verify', async (req, res) => {
  const { token } = parse(z.object({ token: z.string().min(10).max(200) }), req.body);
  const t = await one(`SELECT * FROM auth_tokens WHERE token_hash=$1 AND kind='verify' AND used_at IS NULL AND expires_at > now()`, [sha256(token)]);
  if (!t) throw new HttpError(400, 'This verification link is invalid, already used, or expired. Request a new one from the sign-in page.');
  await q('UPDATE users SET email_verified=true WHERE id=$1', [t.user_id]);
  await q('UPDATE auth_tokens SET used_at=now() WHERE id=$1', [t.id]);
  res.json({ ok: true });
});

r.post('/resend', async (req, res) => {
  const b = parse(z.object({ email }), req.body);
  const u = await one('SELECT * FROM users WHERE email=$1 AND email_verified=false AND is_active', [b.email]);
  if (u) await sendVerification(u);
  res.json({ ok: true, message: 'If that account needs verification, a new link is on its way.' });
});

r.post('/login', async (req, res) => {
  const b = parse(z.object({ email, password: z.string().min(1).max(128) }), req.body);
  let u = await one('SELECT * FROM users WHERE email=$1', [b.email]);
  const ok = await bcrypt.compare(b.password, u ? u.password_hash : DUMMY);
  if (!u || !ok) throw new HttpError(401, 'Incorrect email or password.');
  if (!u.email_verified) throw new HttpError(403, 'Please verify your email first. Check your inbox for the link.');
  if (!u.is_active) throw new HttpError(403, 'This account has been deactivated. Contact an admin.');
  if (config.adminEmails.includes(u.email) && u.role !== 'admin') u = await one(`UPDATE users SET role='admin' WHERE id=$1 RETURNING *`, [u.id]);
  setSession(res, u);
  res.json({ user: userOut(u) });
});

r.post('/logout', (req, res) => {
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
});

r.post('/forgot', async (req, res) => {
  const b = parse(z.object({ email }), req.body);
  const u = await one('SELECT * FROM users WHERE email=$1 AND is_active', [b.email]);
  if (u) {
    const url = `${config.appUrl}/reset?token=${await issueToken(u.id, 'reset', 1)}`;
    await sendMail(u.email, 'Reset your Exquis Upskill password', `Hi ${u.display_name},\n\nWe received a request to reset your password. This link expires in 1 hour. If you did not ask for it, you can ignore this email.`, { url, label: 'Reset password' });
  }
  res.json({ ok: true, message: 'If an account exists for that email, a reset link is on its way.' });
});

r.post('/reset', async (req, res) => {
  const b = parse(z.object({ token: z.string().min(10).max(200), password }), req.body);
  const t = await one(`SELECT * FROM auth_tokens WHERE token_hash=$1 AND kind='reset' AND used_at IS NULL AND expires_at > now()`, [sha256(b.token)]);
  if (!t) throw new HttpError(400, 'This reset link is invalid, already used, or expired. Request a new one.');
  await q('UPDATE users SET password_hash=$1, token_version=token_version+1, email_verified=true WHERE id=$2', [await bcrypt.hash(b.password, 12), t.user_id]);
  await q('UPDATE auth_tokens SET used_at=now() WHERE id=$1', [t.id]);
  res.json({ ok: true });
});

export default r;
