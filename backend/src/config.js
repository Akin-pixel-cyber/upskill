const e = process.env;
const appUrl = (e.APP_URL || 'http://localhost:8080').replace(/\/+$/, '');
const list = (v) => (v || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

export const config = {
  port: 4000,
  appUrl,
  databaseUrl: `postgres://${encodeURIComponent(e.POSTGRES_USER || 'upskill')}:${encodeURIComponent(e.POSTGRES_PASSWORD || '')}@${e.POSTGRES_HOST || 'db'}:5432/${e.POSTGRES_DB || 'upskill'}`,
  sessionSecret: e.SESSION_SECRET || '',
  cookieSecure: e.COOKIE_SECURE ? e.COOKIE_SECURE === 'true' : appUrl.startsWith('https://'),
  emailDomain: (e.EMAIL_DOMAIN || 'exquisappfactory.com').toLowerCase(),
  adminEmails: list(e.ADMIN_EMAILS),
  uploadDir: e.UPLOAD_DIR || '/data/uploads',
  smtp: {
    host: e.SMTP_HOST || '',
    port: Number(e.SMTP_PORT || 465),
    user: e.SMTP_USER || '',
    pass: e.SMTP_PASS || '',
    from: e.SMTP_FROM || e.SMTP_USER || '',
  },
  ai: {
    provider: (e.AI_PROVIDER || '').toLowerCase(),
    key: e.AI_API_KEY || '',
    model: e.AI_MODEL || '',
  },
};

if (config.sessionSecret.length < 32) {
  console.error('FATAL: SESSION_SECRET must be set to a random string of at least 32 characters (see .env.example).');
  process.exit(1);
}
