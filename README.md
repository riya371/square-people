# SquarePeople

A multi-tenant workforce-management SaaS (square-feet). Companies manage employees,
teams, departments, projects, a tasks kanban, time tracking, attendance, and leave
approvals from one dashboard.

- **Frontend** (`frontend/`) — Vue 3 + Pinia + Vue Router + Tailwind, built with Vite.
- **API** (`api/`) — Express 5 + Sequelize 6 + PostgreSQL, JWT auth via httpOnly cookies.

The two run as separate dev servers and talk over HTTP. You need **both running** to use the app.

---

## 1. Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | `^20.19` or `>=22.12` | check with `node -v` |
| npm | bundled with Node | |
| PostgreSQL | 14+ | must be **running** before you start the API |

### macOS (Homebrew) Postgres quick start
```bash
brew install postgresql@16          # if not already installed
brew services start postgresql@16   # start it (and keep it running on login)
pg_isready                          # should print "accepting connections"
```

---

## 2. Project layout

```
squarepeople/
├── api/        # Express + Sequelize backend  → http://localhost:3000
├── frontend/   # Vue 3 + Vite frontend        → http://localhost:5173
└── README.md   # this file
```

---

## 3. One-time setup

### 3a. Create the database
```bash
createdb squarepeople_dev
# or:  psql -d postgres -c "CREATE DATABASE squarepeople_dev;"
```
You do **not** need to create any tables — the API auto-creates/syncs them on first boot.

### 3b. Configure the API
```bash
cd api
cp .env.example .env
```
Edit `api/.env` and set at least these (sample values for a typical local macOS setup):
```env
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

DB_NAME=squarepeople_dev
DB_USER=<your-postgres-user>     # e.g. your macOS username, or "postgres"
DB_PASSWORD=                     # often empty for local Homebrew Postgres
DB_HOST=127.0.0.1
DB_PORT=5432

# Generate each secret with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_ACCESS_SECRET=<32-byte-hex-string>
JWT_REFRESH_SECRET=<different-32-byte-hex-string>

COOKIE_DOMAIN=localhost
COOKIE_SECURE=false
BCRYPT_SALT_ROUNDS=10

# Email: "console" just logs invite/reset links to the API terminal (fine for dev).
MAIL_DRIVER=console
```

### 3c. Configure the frontend
`frontend/.env.development` already points at the local API:
```env
VITE_API_BASE_URL=http://localhost:3000
```
No change needed for local dev.

### 3d. Install dependencies
```bash
cd api && npm install
cd ../frontend && npm install
```

### 3e. Seed demo data (recommended)
Load two ready-made Bangladeshi demo companies (employees, teams, projects, tasks,
attendance, time logs, leaves, and an activity feed):
```bash
cd api && npm run seed
```
> ⚠️ `npm run seed` **drops and recreates every table**, then inserts fresh demo data.
> Dev only — never run it against data you care about. Re-run any time to reset to a
> clean demo state. Logins it creates are listed in §5.

---

## 4. Running the app

Open **two terminals**.

**Terminal 1 — API:**
```bash
cd api
npm run dev          # nodemon; restarts on file changes
# → "Server running on http://localhost:3000"
```
Sanity check: `curl http://localhost:3000/health` → `{"ok":true,...}`

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
# → http://localhost:5173/
```

Then open **http://localhost:5173** in your browser.

---

## 5. Logging in to test the system

### ⚡ Seeded accounts — fast login (after `npm run seed`)

The seeder creates two Bangladeshi demo companies. **All accounts use password
`Test1234` and PIN `1234`.**

**Square Feet LTD** — workspace `square-feet` — the data-rich tenant (employees, teams,
projects, kanban tasks, attendance, time logs, leaves, activity feed):

**Email + password** → **http://localhost:5173/login**

| Role | Email | Password |
|------|-------|----------|
| **Owner** (full access) | `tanvir@squarefeet.xyz` | `Test1234` |
| **Admin** | `nusrat@squarefeet.xyz` | `Test1234` |
| **Manager** (approves leaves) | `rakib@squarefeet.xyz` | `Test1234` |
| **Member** (limited access) | `sadia@squarefeet.xyz` | `Test1234` |

**Jamuna Retail Ltd** — workspace `jamuna-retail` (second tenant, lighter data):

| Role | Email | Password |
|------|-------|----------|
| **Owner** | `shahidul@jamunaretail.com` | `Test1234` |

> A workspace slug is only requested if one email exists in more than one company.
> These emails are unique, so you can leave it blank.

**Employee PIN / kiosk login** → login page → **"Employee PIN"** tab

| Person | Workspace | Employee ID | PIN |
|--------|-----------|-------------|-----|
| Tanvir Ahmed (owner) | `square-feet` | `EMP-0001` | `1234` |
| Nusrat Jahan (admin) | `square-feet` | `EMP-0002` | `1234` |
| Rakib Hasan (manager) | `square-feet` | `EMP-0003` | `1234` |
| Sadia Islam (member) | `square-feet` | `EMP-0004` | `1234` |

> These accounts exist only after you've run `npm run seed` (§3e). On a fresh DB without
> seeding, register a new company instead (below).

### 📝 Manual login (step by step)

**Standard login**
1. Open **http://localhost:5173/login**.
2. Enter email + password (e.g. `tanvir@squarefeet.xyz` / `Test1234`).
3. *(Only if prompted)* pick or type the workspace `square-feet`.
4. Click **Sign in** → you land on the Dashboard.

**Employee PIN login** (for staff using a shared kiosk)
1. Open **http://localhost:5173/login** and switch to the **"Employee PIN"** tab.
2. Enter the workspace (`square-feet`), Employee ID (e.g. `EMP-0001`), and 4-digit PIN (`1234`).
3. Click **Sign in**.

**Sign out:** top-left user menu (your name/avatar) → **Sign out**.

### 🆕 Registration (create a brand-new company)

Use this on a fresh database, or to test the onboarding flow.

1. Go to **http://localhost:5173/signup**.
2. **Step 1 — account:** full name, email, password (min **8** characters).
3. **Step 2 — company:** company name, workspace URL slug (must be unique — it's checked
   live as you type), industry, and working days.
4. Submit → you're signed in as the **owner** of a new, empty tenant and dropped on the
   Dashboard. Every employee you create automatically gets an employee code (`EMP-####`);
   set their PIN to enable PIN login for them.

> **Password reset / invites:** with `MAIL_DRIVER=console`, the reset link and invite
> tokens are **printed in the API terminal** — copy them from there during local testing.

---

## 6. What to try (feature checklist)

Once logged in, the full workflow works end-to-end:

- **Dashboard** — stat cards, "hours this week" chart, recent activity feed.
- **Employees** — list/search, create, edit, view detail; **Roles** tab (add/remove a role);
  Teams / Tasks / Attendance / Leaves tabs.
- **Teams** — create; per-card **⋯ menu** → Edit, **Manage members** (add/remove), Delete.
- **Departments** — create; per-row **⋯ menu** → Edit, Delete.
- **Projects** — create; per-card **⋯ menu** → Edit, **Change status**, **Link teams**, Delete.
- **Tasks (Kanban)** — create tasks, drag between Pending / In progress / Completed; subtask counts.
- **Time tracking** — start/stop a timer against a task; today's logs.
- **Attendance** — sign in / sign out; monthly calendar.
- **Leaves** — request leave; approve / reject (as owner/manager).

---

## 7. Troubleshooting

| Symptom | Fix |
|---------|-----|
| API exits with "Unable to start server" / DB error | Postgres isn't running or `DB_*` in `api/.env` is wrong. Run `pg_isready`; start with `brew services start postgresql@16`. Confirm the DB exists (`psql -l`). |
| `port 3000 already in use` | Another process is on it: `lsof -i :3000` then kill it, or change `PORT` in `api/.env`. |
| Frontend loads but every request fails / CORS error | API isn't running, or `FRONTEND_URL` in `api/.env` ≠ `http://localhost:5173`, or `VITE_API_BASE_URL` ≠ `http://localhost:3000`. |
| Login succeeds but you're bounced back to /login | Cookies blocked. Use `http://localhost` (not `127.0.0.1`) in the browser so cookie domain matches; keep `COOKIE_SECURE=false` for local http. |
| Invite / password-reset email "didn't arrive" | With `MAIL_DRIVER=console` the link is **printed in the API terminal** — copy it from there. (Set up Resend for real email.) |
| Forgot the test password | Reset it: `node -e "console.log(require('bcryptjs').hashSync('NewPass123',10))"` then `psql squarepeople_dev -c "UPDATE users SET password_hash='<hash>' WHERE email='tanvir@squarefeet.xyz';"` (or just re-run `npm run seed`) |

---

## 8. Handy commands

```bash
# API health
curl http://localhost:3000/health

# List databases
psql -l

# Inspect data
psql squarepeople_dev -c "\dt"                       # list tables
psql squarepeople_dev -c "SELECT email, role FROM users;"

# Production build of the frontend (outputs to frontend/dist)
cd frontend && npm run build && npm run preview
```

---

## 9. Notes

- The API **auto-syncs** the schema on every boot (`sequelize.sync({ alter: true })`).
  Great for development; before deploying to production, switch to real migrations so
  you never risk altering/dropping columns on live data.
- For production you'll also want: `COOKIE_SECURE=true` behind HTTPS, secrets supplied
  via the host's environment (not committed), a locked-down `FRONTEND_URL`, and a real
  `MAIL_DRIVER` (Resend) for invites and password resets.
