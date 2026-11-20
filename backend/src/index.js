import 'express-async-errors';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';
import { config } from './config.js';
import { migrate, one } from './lib/db.js';
import { HttpError } from './lib/util.js';
import authRoutes from './routes/auth.js';
import meRoutes from './routes/me.js';
import plansRoutes from './routes/plans.js';
import teamRoutes from './routes/team.js';
import assignmentRoutes from './routes/assignments.js';
import checkinRoutes from './routes/checkins.js';
import notificationRoutes from './routes/notifications.js';
import adminRoutes from './routes/admin.js';
import dashboardRoutes from './routes/dashboard.js';
import fileRoutes from './routes/files.js';
import { startScheduler } from './scheduler.js';

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false, hsts: config.cookieSecure, crossOriginResourcePolicy: { policy: 'same-site' } }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/api/health', async (req, res) => {
  try { await one('SELECT 1'); res.json({ ok: true }); } catch { res.status(503).json({ ok: false }); }
});
app.use('/api/auth', authRoutes);
app.use('/api/me', meRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/checkins', checkinRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/files', fileRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'That file is too large.' });
  if (err.code === '22P02') return res.status(404).json({ error: 'Not found.' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request body.' });
  console.error('[error]', req.method, req.url, err);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
});

for (const d of ['avatars', 'evidence']) fs.mkdirSync(path.join(config.uploadDir, d), { recursive: true });
await migrate();
startScheduler();
app.listen(config.port, () => console.log(`[api] listening on :${config.port} (${config.appUrl})`));
