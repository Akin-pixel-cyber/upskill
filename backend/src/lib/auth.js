import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { one } from './db.js';
import { HttpError } from './util.js';

export const COOKIE = 'upskill_session';

export function setSession(res, user) {
  const token = jwt.sign({ uid: user.id, tv: user.token_version }, config.sessionSecret, { expiresIn: '7d' });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, maxAge: 7 * 864e5, path: '/' });
}

export async function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) throw new HttpError(401, 'Please sign in to continue.');
  let payload;
  try { payload = jwt.verify(token, config.sessionSecret); } catch { throw new HttpError(401, 'Your session expired. Please sign in again.'); }
  const user = await one('SELECT * FROM users WHERE id=$1', [payload.uid]);
  if (!user || !user.is_active || user.token_version !== payload.tv) throw new HttpError(401, 'Your session expired. Please sign in again.');
  req.user = user;
  next();
}

// Admin passes every role check.
export const requireRole = (...roles) => (req, res, next) => {
  if (req.user.role === 'admin' || roles.includes(req.user.role)) return next();
  throw new HttpError(403, 'You do not have permission to do that.');
};
