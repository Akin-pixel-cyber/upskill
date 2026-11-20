import { z } from 'zod';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function parse(schema, data) {
  const r = schema.safeParse(data ?? {});
  if (!r.success) {
    const i = r.error.issues[0];
    const field = i.path.join('.');
    throw new HttpError(400, field ? `${field.replace(/_/g, ' ')}: ${i.message}` : i.message);
  }
  return r.data;
}

export const urlOrEmpty = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), 'must start with http:// or https://')
  .optional()
  .default('');

export const sha256 = (t) => crypto.createHash('sha256').update(t).digest('hex');
export const addDays = (d, n) => new Date(new Date(d).getTime() + n * 864e5);
export const isoDate = (d) => new Date(d).toISOString().slice(0, 10);

export function userOut(u) {
  return {
    id: u.id,
    email: u.email,
    display_name: u.display_name,
    role: u.role,
    manager_id: u.manager_id,
    manager_name: u.manager_name ?? null,
    is_active: u.is_active,
    email_verified: u.email_verified,
    avatar_url: u.avatar_file ? `/api/files/avatars/${u.avatar_file}` : null,
    job_title: u.job_title,
    department: u.department,
    bio: u.bio,
    phone: u.phone,
    location: u.location,
    interests: u.interests,
    created_at: u.created_at,
  };
}

// ---- uploads: type is detected from file bytes, never trusted from the client ----
export function sniff(b) {
  if (!b || b.length < 12) return null;
  if (b[0] === 0x89 && b.toString('ascii', 1, 4) === 'PNG') return { ext: 'png' };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg' };
  if (b.toString('ascii', 0, 4) === 'GIF8') return { ext: 'gif' };
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return { ext: 'webp' };
  if (b.toString('ascii', 0, 4) === '%PDF') return { ext: 'pdf' };
  if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 3 && b[3] === 4) return { ext: 'zip' };
  return null;
}

export const FILE_NAME_RE = /^[a-f0-9-]{36}\.[a-z0-9]{2,5}$/;

export function saveUpload(kind, buffer, ext) {
  const name = `${crypto.randomUUID()}.${ext}`;
  const dir = path.join(config.uploadDir, kind);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), buffer);
  return name;
}

export function removeUpload(kind, name) {
  if (!name || !FILE_NAME_RE.test(name)) return;
  fs.unlink(path.join(config.uploadDir, kind, name), () => {});
}
