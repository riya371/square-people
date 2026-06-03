# SquarePeople API Completion — Design Spec

**Date:** 2026-05-21
**Owner:** Desmond Kuet (Square Feet LTD)
**Status:** Draft, pending user review

## 1. Purpose & scope

The SquarePeople Vue 3 frontend (`/frontend`) is complete: every screen, layout, and interaction is wired against mock data in `src/mock/fixtures.js`. This spec defines the backend API work needed to replace those mocks with real, multi-tenant, authenticated endpoints.

**In scope (single spec by user direction):**
- A. Core platform: auth (owner + employee PIN), JWT in httpOnly cookies, tenancy schema + middleware, CORS, error model, RBAC, existing route bug fixes, dead-code cleanup.
- B. Resource APIs: Companies, Departments, Roles (+ assignment), Employees, Teams (+ members), Projects (+ team links), Tasks (+ Kanban move), Subtasks.
- C. Time / Attendance / Leaves: WorkTracking timer, Attendance punch + month grid, Leaves CRUD + approve/reject.
- D. Dashboard read-models: `/me`, `/dashboard/stats`, `/dashboard/activity`, `/dashboard/hours-this-week`, per-employee rollups.
- E. Onboarding & email: Invite table + Resend integration, password reset.
- G. Audit log: append-only, written by middleware, surfaced through `/dashboard/activity` and `/audit`.

**Explicitly out of scope:**
- F. SSO (Google / Microsoft) — dropped per user.
- Real-time notifications, websockets, SSE, webhooks.
- Test scaffolding (Jest/Vitest). Manual smoke-test recipes only.
- Production deployment (Docker, CI/CD).
- Mobile apps.

## 2. Decisions log

| # | Decision | Choice |
|---|---|---|
| D1 | Auth model | **One User per person, role-based.** Single users table holds owners and employees. Owners get a password; employees may have password + PIN. One JWT shape; `role` claim decides what they can do. |
| D2 | Tenancy enforcement | **Enforce now at schema + middleware.** Add `company_id` to every tenant-scoped table; change `Employee.email`, `Role.name`, etc. to composite-unique with `company_id`; `requireTenant` middleware auto-scopes every query. |
| D3 | Scope | **One spec covering A–E + G.** SSO (F) and notifications (subset of G) explicitly dropped. |
| D4 | Payload shape | **camelCase DTOs, no UI fields.** Standard list envelope `{ data, meta }`; standard error envelope `{ error: { code, message, details } }`. |
| D5 | Session model | **Access + refresh tokens in httpOnly cookies.** 15-min access, 30-day refresh. Server-side refresh rotation in `refresh_tokens` table. |
| D6 | Email provider | **Resend.** |
| D7 | Audit & notifications | **Audit-only.** `audit_log` table, `audit()` middleware on every write. Dashboard ActivityFeed reads from it. No in-app notification entity. |
| D8 | DB migrations | **Keep `sequelize.sync({ alter: true })`.** Real migrations deferred. |
| D9 | Scaffolding cleanup | **Delete Product + Category; rewrite User as auth subject.** |
| D10 | Code structure | **Patch existing flat MVC.** Keep `controllers/`, `models/`, `routes/`, `services/` at top level; add `middleware/`, `utils/`, `validators/`, `emails/` siblings. |

## 3. Stack additions

| Dep | Purpose |
|---|---|
| `cors` | Allow Vite dev server (`:5173`) to call the API (`:3000`) with credentials. |
| `cookie-parser` | Parse `sp_access` / `sp_refresh` cookies. |
| `jsonwebtoken` | Sign/verify access + refresh JWTs. |
| `bcryptjs` | Hash passwords and 4-digit PINs. |
| `zod` | Validate request bodies, params, queries (`validate(schema)` middleware). |
| `resend` | Transactional email (invites, password reset, leave notifications). |
| `helmet` | Sensible HTTP security headers. |
| `pino` + `pino-http` | Structured request logging with request IDs. |
| `dotenv` | Load env vars (already in devDependencies; promote to dependencies). |

## 4. File structure (after this work)

```
api/
├── index.js                          # Express bootstrap, route wiring, middleware pipeline
├── association.js                    # cleaned: removed User↔Product, fixed leadTeams alias
├── config/
│   ├── database.js
│   └── env.js                        # NEW — validates required env vars at boot
├── middleware/                       # NEW
│   ├── requireAuth.js
│   ├── requireRole.js
│   ├── requireTenant.js
│   ├── validate.js
│   ├── auditLogger.js
│   └── errorHandler.js
├── utils/                            # NEW
│   ├── jwt.js
│   ├── password.js
│   ├── pin.js
│   ├── mailer.js                     # Resend wrapper + mustache template renderer
│   ├── serializer.js                 # toUserDto, toEmployeeDto, toTaskDto, ...
│   └── AppError.js
├── controllers/
│   ├── authController.js             # NEW
│   ├── meController.js               # NEW
│   ├── inviteController.js           # NEW
│   ├── passwordResetController.js    # NEW
│   ├── statsController.js            # NEW
│   ├── activityController.js         # NEW
│   ├── auditController.js            # NEW
│   ├── companyController.js          # rewritten
│   ├── departmentController.js       # rewritten
│   ├── employeeController.js         # rewritten + roles assignment
│   ├── roleController.js             # rewritten
│   ├── teamController.js             # rewritten + members M:N
│   ├── projectController.js          # rewritten + teams M:N
│   ├── taskController.js             # rewritten + /move, kanban shape
│   ├── subtaskController.js          # rewritten
│   ├── worktrackingController.js     # rewritten (start/pause/resume/stop)
│   ├── attendanceController.js       # rewritten (sign-in/out/month)
│   ├── leaverequestController.js     # rewritten + days computed
│   └── leaveapprovalController.js    # rewritten + writes attendance
├── routes/                           # mirror of controllers
├── models/
│   ├── userModel.js                  # REWRITTEN as auth subject
│   ├── inviteModel.js                # NEW
│   ├── auditLogModel.js              # NEW
│   ├── passwordResetTokenModel.js    # NEW
│   ├── refreshTokenModel.js          # NEW
│   ├── teamMemberModel.js            # NEW — explicit join (M:N)
│   ├── ... (existing models, with multi-tenant changes)
├── validators/                       # NEW — Zod schemas per resource
├── emails/                           # NEW — HTML/text templates (Square Feet-branded)
│   ├── invite.html / invite.txt
│   ├── password-reset.html / .txt
│   ├── leave-submitted.html / .txt
│   └── leave-decision.html / .txt
└── services/
    └── userService.js                # slimmed; most controllers hit Sequelize directly
```

**Deletions:** `controllers/productsController.js`, `routes/productsRoutes.js`, `models/productsModel.js`, `controllers/categoryController.js`, `routes/categoryRoutes.js`, `models/categoryModel.js`, and their wiring in `index.js` + `association.js`.

## 5. Middleware pipeline (`index.js`)

Applied in this order globally:

```
helmet()
  → cors({ origin: FRONTEND_URL, credentials: true })
  → cookieParser()
  → express.json()
  → pinoHttp()        # attaches req.id and structured logs
  → app.use('/api', routes)
  → 404 handler
  → errorHandler      # catches thrown AppError → JSON envelope
```

Per-route guards (composable, applied in each route file):

- `requireAuth` — reads `sp_access` cookie, verifies JWT, attaches `req.user = { id, role, companyId, employeeId }`. 401 on failure.
- `requireRole(...allowed)` — RBAC check against `req.user.role`. Hierarchical: `owner` > `admin` > `manager` > `member`. 403 on failure.
- `requireTenant` — asserts `req.user.companyId`; exposes `req.scope(Model)` helper that auto-injects `{ where: { company_id: req.user.companyId } }` into queries.
- `validate(schema)` — Zod parse of `req.body`, `req.query`, `req.params`. 400 with `details[]` on failure.
- `audit(action, entity)` — wraps the handler; on 2xx response inserts a row into `audit_log`.

## 6. Schema changes

### 6.1 Tenant-scoping changes on existing models

| Model | Change |
|---|---|
| `Company` | Add `slug` (string, unique, lowercase, used for workspace URL). |
| `Employee` | `email` → composite-unique `(company_id, email)`. Add `employee_code` (string, unique within company; used for kiosk login). Add `hire_date`, `termination_date`, `manager_id` (self-FK). Lowercase `status` enum: `'active' | 'inactive' | 'terminated'`. |
| `Role` | `name` → composite-unique `(company_id, name)`. Add `color` (string, optional). |
| `Department` | Already has `company_id` — no change. |
| `Team` | Add `company_id` (denormalised, indexed). Add `description` (string). |
| `Project` | Add `company_id`. Add `status` ENUM (`'on-track' | 'at-risk' | 'in-progress' | 'completed'`), `due_date` (DATEONLY), `description` (text). |
| `Task` | Add `company_id`. Keep `status` ENUM at the DB level (`'pending' | 'in_progress' | 'completed'`). The serializer emits the **DTO** value in camelCase (`'pending' | 'inProgress' | 'completed'`) so the API surface matches the frontend Kanban column keys. Add `position` (integer; position within its status column, used for Kanban ordering). Add `code` (auto-generated `#<seq>` per company). |
| `Subtask` | Add `company_id`. Add `position`. |
| `WorkTracking` | Add `company_id`. |
| `Attendance` | Add `company_id`. Add `status` ENUM (`'present' | 'late' | 'leave' | 'absent'`), `signed_in_at` (DATETIME nullable), `signed_out_at` (DATETIME nullable). Composite-unique `(employee_id, logged_date)`. |
| `LeaveRequest` | Add `company_id`. Lowercase `status` ENUM (`'pending' | 'approved' | 'rejected'`). Add `reason` (text), `days` (integer, computed on create from `end_date - start_date + 1`). |
| `LeaveApproval` | Add `company_id`. |

### 6.2 New models

#### `User` (rewritten — auth subject)

| Column | Type | Notes |
|---|---|---|
| `id` | integer PK | autoincrement |
| `company_id` | integer FK → companies | NOT NULL, indexed |
| `employee_id` | integer FK → employees | NULL allowed for admin invitees who aren't yet linked to an Employee row. The founding owner's User is always linked because signup creates Company + Employee + User atomically in one transaction. |
| `email` | string | composite-unique `(company_id, email)` |
| `password_hash` | string | NOT NULL (SSO removed; every account has a password) |
| `pin_hash` | string | NULL allowed; set if user uses kiosk login |
| `role` | ENUM | `'owner' | 'admin' | 'manager' | 'member'` |
| `last_login_at` | datetime | nullable |
| `last_login_ip` | string | nullable |
| `created_at`, `updated_at` | datetime | |

#### `RefreshToken`

| Column | Type | Notes |
|---|---|---|
| `id` | integer PK | |
| `user_id` | integer FK → users | indexed |
| `token_hash` | string | SHA-256 of the raw token; raw token only in the cookie |
| `expires_at` | datetime | |
| `revoked_at` | datetime | nullable |
| `ip`, `ua` | string | nullable |

#### `PasswordResetToken`

| Column | Type | Notes |
|---|---|---|
| `id` | integer PK | |
| `user_id` | integer FK → users | indexed |
| `token_hash` | string | |
| `expires_at` | datetime | 30 minutes after creation |
| `used_at` | datetime | nullable |

#### `Invite`

| Column | Type | Notes |
|---|---|---|
| `id` | integer PK | |
| `company_id` | integer FK | |
| `email` | string | |
| `role` | ENUM | (same as User.role) |
| `employee_id` | integer FK → employees | nullable; if set, invite links an existing Employee row |
| `token_hash` | string | |
| `expires_at` | datetime | 7 days |
| `accepted_at` | datetime | nullable |
| `created_by_user_id` | integer FK → users | |

#### `AuditLog`

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `company_id` | integer FK | indexed |
| `actor_user_id` | integer FK → users | nullable (e.g. system events) |
| `entity` | string | `'employee' | 'task' | 'project' | ...` |
| `entity_id` | string | string for flexibility (most are integers) |
| `action` | string | `'create' | 'update' | 'delete' | 'approve' | 'reject' | 'login' | 'logout' | 'kanban_move' | 'sign_in' | 'sign_out' | 'timer_start' | 'timer_stop' | ...` |
| `diff` | jsonb | for updates, only the changed fields; for creates, the full payload |
| `ip`, `ua` | string | nullable |
| `created_at` | datetime | |

Indexed on `(company_id, created_at DESC)` for fast ActivityFeed reads.

#### `TeamMember`

Explicit join (M:N between Team and Employee, distinct from team leader).

| Column | Type | Notes |
|---|---|---|
| `team_id` | integer FK | composite PK |
| `employee_id` | integer FK | composite PK |
| `company_id` | integer FK | denormalised |
| `joined_at` | datetime | |

### 6.3 Schema evolution

`sequelize.sync({ alter: true })` continues to run at boot. Real migrations (Umzug / sequelize-cli) are deferred to a later spec. Acceptable risk while in pre-launch.

## 7. Roles & RBAC

Four roles, hierarchical:

| Role | Capabilities |
|---|---|
| `owner` | Everything. One per company; cannot be removed; ownership can be transferred. |
| `admin` | Manage users, employees, departments, roles, teams, projects, tasks, leaves; view audit log; cannot delete company. |
| `manager` | Manage teams they lead and projects/tasks/leave-approvals for their team members; read-only on company-level resources. |
| `member` | Read employees; manage own profile, own tasks (status updates only), own time, own attendance, own leaves. |

`requireRole('admin')` means **admin-or-higher**. Manager-specific checks (e.g. "can this manager approve THIS leave?") use a per-resource policy function inside the controller.

## 8. Environment variables (`config/env.js`)

```
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
DATABASE_URL=postgres://...
JWT_ACCESS_SECRET=<long random>
JWT_REFRESH_SECRET=<long random>
COOKIE_DOMAIN=localhost
COOKIE_SECURE=false           # true in prod (HTTPS)
MAIL_DRIVER=resend            # 'resend' | 'console'; defaults to console if RESEND_API_KEY unset
RESEND_API_KEY=...            # optional in dev
RESEND_FROM='SquarePeople <no-reply@squarepeople.squarefeetltd.com>'
```

`config/env.js` parses these with Zod at boot. Missing required vars → process exits with a clear message.

## 9. Auth endpoints (`/api/auth`)

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| `POST` | `/auth/signup` | public | `{ fullName, email, password, companyName, workspaceSlug, companySize, industry, workdays }` | Atomically creates `Company` + founding `Employee` + `User` (role=`owner`). Logs in. Returns `{ user, company }` + sets cookies. |
| `POST` | `/auth/login` | public | `{ email, password, workspaceSlug? }` | Resolves company (see §10), verifies bcrypt password, issues cookies. 409 if email matches users in multiple companies and no `workspaceSlug` given. |
| `POST` | `/auth/employee-login` | public | `{ companySlug, employeeCode, pin }` | Looks up `Employee` by `(company_id, employee_code)`. Resolves the linked `User`, verifies PIN. Issues cookies with the user's `role`. |
| `POST` | `/auth/refresh` | refresh cookie | — | Rotates both tokens; old refresh row marked `revoked_at`. |
| `POST` | `/auth/logout` | access cookie | — | Revokes current refresh row; clears both cookies. |
| `POST` | `/auth/logout-all` | access cookie | — | Revokes all refresh rows for the user. |
| `POST` | `/auth/forgot-password` | public | `{ email }` | Always returns 200 (no email-enumeration leak). If user exists, emails a reset link with a `PasswordResetToken` (30-min TTL). |
| `POST` | `/auth/reset-password` | public | `{ token, newPassword }` | Validates token, sets new password, marks token used, revokes all refresh rows. |

### 9.1 JWT payload

Access token:
```json
{ "sub": <userId>, "role": "owner|admin|manager|member", "companyId": <int>, "employeeId": <int|null>, "iat": ..., "exp": ..., "jti": "<uuid>" }
```

Refresh token: same payload + a `type: "refresh"` claim. Always validated against `refresh_tokens` row by `jti`.

### 9.2 Cookies

```
sp_access:  HttpOnly Secure SameSite=Lax Path=/         MaxAge=900       (15 min)
sp_refresh: HttpOnly Secure SameSite=Lax Path=/api/auth MaxAge=2592000   (30 days)
```

CORS configured with `credentials: true`; frontend uses `axios.defaults.withCredentials = true`.

## 10. Workspace resolution for login

Because `(company_id, email)` is composite-unique, the same email can exist in multiple companies. Login must resolve which company.

**Resolution order:**
1. `body.workspaceSlug` if provided.
2. `req.headers.host` parsed for a subdomain in prod (e.g. `square-feet.squarepeople.app` → `square-feet`).
3. If neither, query `User WHERE email = ?` across all companies. If exactly one match: log in. If 0 matches: 401. If 2+ matches: 409 with `{ error: { code: 'MULTIPLE_WORKSPACES', details: { companies: [{ slug, name }] } } }`. Frontend renders a picker.

**Signup workspace check:** `GET /api/companies/me/workspace-check?slug=foo` (public) returns `{ available: bool }` so the Signup wizard can validate the workspace URL in real time.

## 11. `/me` endpoints (`/api/me`)

| Method | Path | Notes |
|---|---|---|
| `GET` | `/me` | Returns `{ user, company, employee, permissions: [...] }`. Frontend calls on boot instead of reading `localStorage`. |
| `PATCH` | `/me` | Update own name + phone (limited safe fields). |
| `POST` | `/me/change-password` | `{ currentPassword, newPassword }`. |
| `POST` | `/me/set-pin` | `{ currentPassword, pin }` — employee self-sets kiosk PIN. |

## 12. Resource endpoints

All under `/api`, all require `requireAuth + requireTenant` unless marked public. All write endpoints run through `audit()` middleware. List endpoints share `?page=1&perPage=20&q=&sort=&order=asc|desc` query contract.

### 12.1 Companies (`/api/companies`)

| Method | Path | Role | Notes |
|---|---|---|---|
| `GET` | `/companies/me` | any | Full company DTO (workdays, working hours, headcount, plan). |
| `PATCH` | `/companies/me` | admin+ | Update company profile / workdays / hours. |
| `GET` | `/companies/me/workspace-check?slug=` | **public** | `{ available: bool }`. |

### 12.2 Departments (`/api/departments`)

CRUD + list. DTO: `{ id, name, description, headcount }`. `headcount` computed via SQL `COUNT` join on Employee.

| Method | Path | Role |
|---|---|---|
| `GET` | `/departments` | any |
| `GET` | `/departments/:id` | any |
| `POST` | `/departments` | admin+ |
| `PATCH` | `/departments/:id` | admin+ |
| `DELETE` | `/departments/:id` | admin+ |

### 12.3 Roles (`/api/roles`)

CRUD + list. Roles here are job titles (e.g. "Senior Dev"), distinct from auth roles. DTO: `{ id, name, color }`.

| Method | Path | Role |
|---|---|---|
| `GET` | `/roles` | any |
| `POST` | `/roles` | admin+ |
| `PATCH` | `/roles/:id` | admin+ |
| `DELETE` | `/roles/:id` | admin+ |

### 12.4 Employees (`/api/employees`)

| Method | Path | Role | Notes |
|---|---|---|---|
| `GET` | `/employees` | any | List. Filters: `?departmentId=`, `?status=`, `?q=`. DTO includes `roles[]`, `department`, `teamsLed[]`. |
| `GET` | `/employees/:id` | any | Detail. Adds `manager`, `stats: { hoursThisMonth, daysPresent, daysExpected, tasksCompleted }`. |
| `POST` | `/employees` | admin+ | Create. Does NOT create a User row — that happens via invite acceptance. |
| `PATCH` | `/employees/:id` | admin+ | Update profile. |
| `DELETE` | `/employees/:id` | admin+ | Soft-delete: sets `status='terminated'`, `termination_date=NOW()`. |
| `POST` | `/employees/:id/roles` | admin+ | `{ roleIds: [...] }`. Replaces full role set. |
| `DELETE` | `/employees/:id/roles/:roleId` | admin+ | Remove single role. |
| `GET` | `/employees/:id/tasks` | any | Used by EmployeeDetail Tasks tab. |
| `GET` | `/employees/:id/attendance?year=&month=` | any | Used by EmployeeDetail Attendance tab. |
| `GET` | `/employees/:id/leaves` | any | Used by EmployeeDetail Leaves tab. |

### 12.5 Teams (`/api/teams`)

| Method | Path | Role | Notes |
|---|---|---|---|
| `GET` | `/teams` | any | DTO: `{ id, name, description, lead: {id,name}, memberCount, activeProjectCount }`. |
| `GET` | `/teams/:id` | any | Adds `members[]`, `projects[]`. |
| `POST` | `/teams` | admin+ | `{ name, description, leadEmployeeId }`. |
| `PATCH` | `/teams/:id` | admin+ | |
| `DELETE` | `/teams/:id` | admin+ | |
| `POST` | `/teams/:id/members` | admin+ or team lead | `{ employeeIds: [...] }`. Replaces member set. |
| `DELETE` | `/teams/:id/members/:employeeId` | admin+ or team lead | Remove single member. |

### 12.6 Projects (`/api/projects`)

| Method | Path | Role | Notes |
|---|---|---|---|
| `GET` | `/projects` | any | DTO: `{ id, name, description, status, dueDate, progress, tasksDone, tasksTotal, teams: [{id,name}] }`. `progress = tasksDone / tasksTotal`. |
| `GET` | `/projects/:id` | any | Adds `tasks[]`, full `teams[]`. |
| `POST` | `/projects` | admin+ or manager | |
| `PATCH` | `/projects/:id` | admin+ or project's manager | |
| `DELETE` | `/projects/:id` | admin+ | |
| `POST` | `/projects/:id/teams` | admin+ | `{ teamIds: [...] }`. Replaces full team set. |
| `DELETE` | `/projects/:id/teams/:teamId` | admin+ | |

### 12.7 Tasks (`/api/tasks`)

| Method | Path | Role | Notes |
|---|---|---|---|
| `GET` | `/tasks` | any | Filters: `?projectId=`, `?assigneeId=`, `?status=`, `?priority=`. |
| `GET` | `/tasks/kanban?projectId=` | any | Returns Kanban shape directly: `{ pending: [...], inProgress: [...], completed: [...] }`, ordered by `position`. |
| `GET` | `/tasks/:id` | any | Adds `subtasks[]`, `assignee`, `project`. |
| `POST` | `/tasks` | admin+, manager, or member (assigned-to-self only) | |
| `PATCH` | `/tasks/:id` | admin+, project manager, or assignee (status only) | |
| `DELETE` | `/tasks/:id` | admin+ or project manager | |
| `POST` | `/tasks/:id/move` | any with access to task | `{ toColumn: 'pending'\|'inProgress'\|'completed', toIndex: <int> }`. Transaction: updates `status` + reorders `position` values within affected column(s). |

**Route bug fix:** `routes/taskRoutes.js` paths change from `/tasks/*` to `/*` (currently double-prefixed to `/tasks/tasks/...`).

### 12.8 Subtasks (`/api/tasks/:taskId/subtasks`)

CRUD nested under task. `position` for ordering. DTO mirrors Task DTO.

### 12.9 WorkTracking / Timer (`/api/time`)

| Method | Path | Role | Notes |
|---|---|---|---|
| `GET` | `/time/entries?date=YYYY-MM-DD` | any | List own entries for the date (default = today). |
| `GET` | `/time/today-total` | any | `{ totalSec }`. |
| `POST` | `/time/start` | any | `{ taskId, subtaskId? }`. Auto-stops any other running timer for the same user first. Returns the new entry. |
| `POST` | `/time/:id/pause` | any | Sets `end_time=NOW()`, computes `duration_minutes`. |
| `POST` | `/time/:id/resume` | any | Creates a new entry with the same task/subtask. |
| `POST` | `/time/:id/stop` | any | Same as pause; final stop. |
| `GET` | `/time/weekly-hours?weekOf=YYYY-MM-DD` | any | Returns `[{ day, sec, percent }]` for the dashboard chart. |

### 12.10 Attendance (`/api/attendance`)

| Method | Path | Role | Notes |
|---|---|---|---|
| `GET` | `/attendance/today` | any | `{ signedInAt, signedOutAt, status }` for current user. |
| `GET` | `/attendance/month?year=&month=` | any | `{ "YYYY-MM-DD": "present" \| "late" \| "leave" \| "absent" }` — exact shape the calendar consumes. |
| `POST` | `/attendance/sign-in` | any | Punch in. Idempotent for today. Status derived from company workingHours start time (`present` vs `late`). |
| `POST` | `/attendance/sign-out` | any | Punch out. |
| `GET` | `/attendance/summary?date=` | manager+ | Org-wide: `{ totalEmployees, presentToday, percent }` (powers dashboard stat card). |

### 12.11 Leaves (`/api/leaves`)

| Method | Path | Role | Notes |
|---|---|---|---|
| `GET` | `/leaves/mine` | any | DTO: `{ id, type, startDate, endDate, days, status, submittedAt }`. |
| `GET` | `/leaves/pending` | manager+ | Pending approvals for teams the user manages (all, for admin+). Includes nested `employee`. |
| `POST` | `/leaves` | any | `{ type, startDate, endDate, reason }`. Computes `days`. Emails manager(s) via Resend. |
| `PATCH` | `/leaves/:id` | requester (pending only) | |
| `DELETE` | `/leaves/:id` | requester (pending only) | |
| `POST` | `/leaves/:id/approve` | manager+ | Creates `LeaveApproval`. Sets `status='approved'`. Writes `attendance` rows with `status='leave'` for date range. Emails requester. |
| `POST` | `/leaves/:id/reject` | manager+ | `{ reason? }`. Sets `status='rejected'`. Emails requester. |

### 12.12 Invites (`/api/invites`)

| Method | Path | Role | Notes |
|---|---|---|---|
| `POST` | `/invites` | admin+ | `{ email, role, employeeId? }`. Creates `Invite`, emails accept link. 7-day TTL. |
| `GET` | `/invites` | admin+ | List pending + last-30-days accepted. |
| `DELETE` | `/invites/:id` | admin+ | Revoke pending invite. |
| `POST` | `/invites/:id/resend` | admin+ | Regenerate token + re-email. |
| `GET` | `/invites/accept` | **public** | `?token=...`. Returns `{ companyName, role, email, status }`. |
| `POST` | `/invites/accept` | **public** | `{ token, fullName, password, pin? }`. Creates User, marks invite accepted, logs in. |

### 12.13 Dashboard (`/api/dashboard`)

| Method | Path | Role | Notes |
|---|---|---|---|
| `GET` | `/dashboard/stats` | any | All four stat cards in one call. `{ activeEmployees: { value, delta }, inProgressTasks: { value, sub }, todayAttendance: { value, sub }, pendingLeaves: { value, sub } }`. |
| `GET` | `/dashboard/activity?limit=10` | any | Reads `audit_log`, maps to UI-friendly events: `[{ id, kind, actor: { name } \| null, text, timestamp }]`. |
| `GET` | `/dashboard/hours-this-week` | any | `[{ day, sec, percent }]` for the bar chart. |

### 12.14 Audit (`/api/audit`)

| Method | Path | Role | Notes |
|---|---|---|---|
| `GET` | `/audit?entity=&action=&actorId=&from=&to=&page=&perPage=` | admin+ | Paginated, tenant-scoped audit log. |

## 13. Response & error envelopes

**List envelope:**
```json
{ "data": [...], "meta": { "page": 1, "perPage": 20, "total": 134 } }
```

**Single-resource:** bare DTO, e.g. `{ "id": 1, "name": "Maya", ... }`.

**Error envelope (4xx / 5xx):**
```json
{ "error": { "code": "INVALID_CREDENTIALS", "message": "Email or password is incorrect.", "details": null } }
```

Validation errors: `details: [{ "path": "email", "message": "Invalid email" }]`.

Standard codes:
- `400 INVALID_INPUT` / `400 VALIDATION_FAILED`
- `401 UNAUTHENTICATED`
- `403 FORBIDDEN`
- `404 NOT_FOUND`
- `409 CONFLICT` (e.g. `MULTIPLE_WORKSPACES`, `EMAIL_TAKEN`, `WORKSPACE_SLUG_TAKEN`)
- `422 BUSINESS_RULE` (e.g. cannot delete owner)
- `500 INTERNAL`

`AppError` class in `utils/AppError.js` carries `(httpStatus, code, message, details)`; `errorHandler` middleware converts it to the JSON envelope. Unexpected errors become 500 with `INTERNAL`; full stack logged via pino.

## 14. Audit log mapping (for `/dashboard/activity`)

Audit rows have raw `(entity, action)` pairs. The activity controller maps them to UI-friendly text:

| `(entity, action)` | UI kind | Text template |
|---|---|---|
| `task, create` | `task-create` | `New task #{code} created` |
| `task, update` (when `status` change to `completed`) | `task-complete` | `completed "{title}"` |
| `task, kanban_move` | `task-move` | `moved "{title}" to {column}` |
| `leaverequest, create` | `leave-request` | `requested {days} days leave` |
| `leaverequest, approve` | `leave-approve` | `approved {requesterName}'s leave` |
| `leaverequest, reject` | `leave-reject` | `rejected {requesterName}'s leave` |
| `project, create` | `project-create` | `New project "{name}" created` |
| `teammember, create` | `team-join` | `joined the {teamName} team` |
| `worktracking, timer_start` | `timer-start` | `started working on "{taskTitle}"` |
| `user, login` (members only) | `user-login` | `signed in` |

Other audit events exist (every write generates one) but are excluded from the activity feed for noise reduction. They remain visible in `/audit`.

## 15. Email integration (Resend)

`utils/mailer.js` exposes an `EmailService` interface:

```js
email.send({ to, template: 'invite', data: { ... } })
```

Implementation reads `emails/<template>.html` + `emails/<template>.txt`, renders with a tiny mustache substitution (no full templating engine), passes to Resend client. `RESEND_API_KEY` and `RESEND_FROM` env vars required.

Templates ship with Square Feet branding (cream-50 background, brand-500 CTA buttons, "by Square Feet" footer):

- `invite.html / .txt` — "Join {companyName} on SquarePeople" + accept link.
- `password-reset.html / .txt` — "Reset your SquarePeople password" + reset link (30-min expiry note).
- `leave-submitted.html / .txt` — sent to manager(s) when a member submits a leave request.
- `leave-decision.html / .txt` — sent to requester on approve/reject.

For offline / no-key development, the mailer falls back to a console adapter that logs the rendered email + recipient + link to the server log (controlled by a `MAIL_DRIVER=console|resend` env var; default `resend` if `RESEND_API_KEY` is set, else `console`).

## 16. Cleanup & bug-fix tasks (in scope of implementation)

1. **Delete** `controllers/productsController.js`, `routes/productsRoutes.js`, `models/productsModel.js`, `controllers/categoryController.js`, `routes/categoryRoutes.js`, `models/categoryModel.js`. Remove their imports from `index.js` and `association.js`.
2. **Rewrite** `models/userModel.js` as the auth subject (see §6.2).
3. **Fix** `routes/taskRoutes.js` double-prefix bug — paths become `/`, `/:id` (not `/tasks`, `/tasks/:id`).
4. **Add** `cors` middleware with `credentials: true` and `origin: FRONTEND_URL`.
5. **Normalize** status ENUMs to lowercase across `Employee.status` (`active`/`inactive`/`terminated`), `LeaveRequest.status` (`pending`/`approved`/`rejected`).
6. **Add** `slug` column to `Company` (unique, lowercase). Backfill for any existing rows via a one-time script.
7. **Refactor** `association.js`: remove `User ↔ Product` association; fix `as: "leadTeams"` / `as: "ledTeams"` mismatch (settle on `as: "leadTeams"`); clean commented-out `team` re-import.
8. **Slim or delete** `services/userService.js` — most rewritten controllers will hit Sequelize directly per existing pattern; keep only if multiple controllers share a helper.
9. **Add** an `/api` prefix on every route in `index.js` (matches frontend convention).

## 17. Testing scope

No automated test scaffolding in this spec. Implementation plan will include a `README.md` section with **manual smoke-test recipes** — curl commands per endpoint group with expected responses, plus a Postman/Insomnia collection JSON in `api/docs/`. Adding Jest/Vitest + a CI pipeline is a separate spec.

## 18. Frontend follow-up (NOT part of this API spec — for downstream awareness)

These changes will be needed in `/frontend` to consume the new API; they belong in a separate frontend integration spec.

- Replace mock-mode `delay()` calls in `frontend/src/api/*.js` with axios calls (`withCredentials: true`) to the new `/api/...` endpoints.
- Replace `useSession.js` localStorage logic with a `GET /api/me` call on app boot. Add a `useAuth` composable for `/auth/login`, `/auth/employee-login`, `/auth/logout`.
- **Hide** Google + Microsoft SSO buttons on `Login.vue` and `Signup.vue` (SSO out of scope).
- Add an optional **Workspace** field to `Login.vue` (and a company-picker UI for the 409 `MULTIPLE_WORKSPACES` case).
- Add a `/accept-invite` view for invite redemption (Vue route + form).
- Add a `/reset-password` view for password-reset redemption.
- Add a `companySlug` field to `EmployeeLogin.vue`.

## 19. Implementation milestones (rough order for the plan)

Suggested ordering (to be turned into a real plan by `writing-plans`):

1. **M1 — Foundation:** dep installs, env validation, helmet/cors/cookie-parser/pino-http wiring, `AppError` + errorHandler, `validate` middleware, delete Product/Category, fix task route bug.
2. **M2 — Schema & associations:** all model changes (composite uniques, denormalised `company_id`, new tables), refactored `association.js`, rewritten `User` model.
3. **M3 — Auth:** `/auth/signup`, `/auth/login`, `/auth/employee-login`, `/auth/refresh`, `/auth/logout`, JWT utils, cookies, `requireAuth` + `requireRole` + `requireTenant` middleware, `/me`.
4. **M4 — Resource CRUD (org):** Companies, Departments, Roles, Employees (incl. role assignment), Teams (incl. members).
5. **M5 — Resource CRUD (work):** Projects (incl. teams M:N), Tasks (incl. `/move` + kanban shape), Subtasks.
6. **M6 — Time / Attendance / Leaves:** WorkTracking endpoints, Attendance endpoints, Leaves + LeaveApproval workflow.
7. **M7 — Dashboard + Audit:** `audit()` middleware, `/audit`, `/dashboard/stats`, `/dashboard/activity` (with audit-row mapping), `/dashboard/hours-this-week`.
8. **M8 — Invites + Password reset + Email:** Resend integration, templates, Invite endpoints, password-reset endpoints.
9. **M9 — Polish:** smoke-test README, Postman collection, audit-log noise filtering, final endpoint review.

## 20. Out of scope (explicit)

- SSO (Google / Microsoft OAuth).
- Real-time notifications, websockets, SSE, webhooks, push.
- Automated test suite (Jest/Vitest/Supertest).
- Real DB migrations (Umzug / sequelize-cli).
- File uploads / avatars (frontend still derives initials).
- Subscription billing / plans / usage limits.
- Internationalisation.
- Production deployment configuration (Docker, CI/CD, secrets management).
- Mobile app or kiosk-device-specific concerns beyond the PIN login endpoint.
