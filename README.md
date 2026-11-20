# Exquis Upskill

Internal learning workspace for Exquis App Factory. Employees set goals through a short skill interview, get an AI-assisted (or template-based) learning plan, have it approved by their manager, and share progress through check-ins. HR assigns courses and tracks completion.

Deploying? Start with **[STEPS.md](STEPS.md)**: zero to running on AWS, backups, disaster recovery, HTTPS.

## Features

- **Dashboard**: active plan, check-in cadence, last check-in, next due (red and flagged when overdue), focus item, role-aware quick actions.
- **Skill interview**: 5-step wizard (Role, Skills, Goal, Capacity, Review) with a live "Draft signals" panel. Progress is kept locally if you leave the page.
- **Plan generation**: uses OpenAI or Anthropic when `AI_PROVIDER` and `AI_API_KEY` are set; otherwise (or on any failure) a built-in template generator builds a weekly roadmap from the same answers. The result is always an editable draft.
- **Plans**: Draft → Submitted → Approved (becomes the single active plan) or Rejected with comments → revise and resubmit. Older plans move to history. Items can be edited, reordered and ticked off, with a progress bar.
- **Check-ins**: target the active plan or an HR assignment; progress, blockers, next steps, file or link evidence; local autosave. Updates can be submitted repeatedly; work only closes when explicitly marked complete.
- **My assignments**: courses from HR with deadline, status and overdue flag. Mark started or complete.
- **Team** (Managers): approvals queue with comments, direct reports with plan progress, last check-in, overdue state, assignments and recent check-ins.
- **Assign courses** (HR): assign to many people, track everyone's status, remove assignments.
- **Admin**: roles, reporting managers, activate or deactivate users, verification status.
- **Profile**: picture with built-in crop and zoom, details, change password.
- **Notifications**: in-app bell plus email for plan submitted, approved or rejected, course assigned, check-in overdue (checked hourly).
- Every page has loading, empty and error states. Requests time out after 20 seconds with a retry button, so nothing can spin forever.

## Roles

| Role | Can do |
|---|---|
| Employee | Interviews, plans, check-ins, assignments, profile |
| Manager | Everything an Employee can, plus approve or reject direct reports' plans and the Team view |
| HR | Everything an Employee can, plus assign courses to anyone and see company-wide assignment progress |
| Admin | Everything, plus users, roles, reporting managers, deactivation |

Everyone signs up as Employee. Emails in `ADMIN_EMAILS` become Admin on signup. **Only Admins change roles.** Plans from people with no reporting manager go to Admins. An Admin may approve their own plan only if they have no manager.

## Architecture

```
Browser ──► Caddy (container "web", :8080 or :80/:443)
              ├─ /            static React build (Vite)
              └─ /api/*  ──►  Express API (container "api", :4000)
                                 ├─ PostgreSQL 16 (container "db", volume pgdata)
                                 └─ uploads (volume "uploads")
Nightly cron on the host ► scripts/backup.sh ► S3 (pg_dump + uploads tarball, via IAM instance role)
```

- **Frontend**: React 18, Vite, React Router. Plain CSS, no UI framework.
- **Backend**: Node 20, Express, `pg`, zod validation, bcrypt (bcryptjs, 12 rounds), JWT in an httpOnly SameSite=Lax cookie (Secure over HTTPS), rate limiting on auth routes, helmet, multer with file type sniffing from bytes (not from the client).
- **Security notes**: signup domain is enforced server-side and case-insensitively; unverified or deactivated users cannot log in; password change/reset and deactivation invalidate existing sessions; uploaded evidence is only served to the owner, their manager, HR and Admins; all user-supplied links must be http(s).
- **Overdue logic**: next check-in due = last check-in on the active plan (or the approval time if none) + the plan's cadence. An assignment is overdue when its deadline date has passed and it is not complete.
- **Email**: Nodemailer over SMTP (Zoho). With no SMTP configured, links are printed to the API log.
- **Reverse proxy**: `SITE_ADDRESS` selects `:8080` (plain HTTP on the IP) or a domain (automatic HTTPS from Let's Encrypt). See STEPS.md Part 13.

## Repository layout

```
backend/            Express API (src/routes, src/lib, schema.sql, Dockerfile)
frontend/           React app (src/pages, ui.jsx, styles.css)
proxy/              Caddyfile + Dockerfile that builds the frontend and serves it
scripts/            backup.sh, restore.sh, install-cron.sh
deploy/             IAM policy, trust policy, S3 lifecycle JSON
docker-compose.yml  db, api, web (+ named volumes, health checks, restart policy)
.env.example        every setting, documented
STEPS.md            full deployment guide
```

The database schema is created automatically on first start (`backend/src/schema.sql`, idempotent). The production start is empty: no demo data is created.

## Local development

Requirements: Node 20+, Docker (for PostgreSQL).

```bash
# 1. Database
docker run -d --name upskill-pg -e POSTGRES_USER=upskill -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=upskill -p 5432:5432 postgres:16-alpine

# 2. API (terminal 1)
cd backend && npm install
export POSTGRES_HOST=localhost POSTGRES_USER=upskill POSTGRES_PASSWORD=dev POSTGRES_DB=upskill \
       SESSION_SECRET=$(openssl rand -hex 32) APP_URL=http://localhost:5173 \
       ADMIN_EMAILS=you@exquisappfactory.com UPLOAD_DIR=$PWD/.uploads
npm run dev

# 3. Web (terminal 2). Vite proxies /api to localhost:4000
cd frontend && npm install && npm run dev
```

Open http://localhost:5173. With no SMTP configured, verification links appear in the API terminal (look for `LINK:`).

## Using the full stack locally

```bash
cp .env.example .env     # set POSTGRES_PASSWORD, SESSION_SECRET, ADMIN_EMAILS, APP_URL=http://localhost:8080
docker compose up -d --build
```
