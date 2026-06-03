# API Plan 4 — Dashboard + Audit + Invites + Resend (M7 + M8 + M9)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The final plan. Wire the audit log (middleware + writes on every existing write endpoint + `/api/audit` query + `/api/dashboard/activity` mapping); ship the three dashboard read-models the frontend Dashboard.vue + StatCards need; build the invite-and-accept flow; swap the ConsoleMailer for a real Resend driver with proper HTML templates per email type. After this plan, the API is feature-complete against `2026-05-21-api-completion-design.md`.

**Architecture:**
- Audit: every write endpoint calls `auditEvent(req, { entity, action, entityId, diff })` after success. Reads land in `/api/audit` (admin) and `/api/dashboard/activity` (mapped to UI-friendly events).
- Dashboard: `/api/dashboard/stats` does 4 SQL aggregates in parallel; `/api/dashboard/activity` reads the last N audit rows; `/api/dashboard/hours-this-week` is a thin reuse of the timer's weekly aggregator.
- Invites: admin POSTs an invite → Resend sends the accept link → invitee POSTs to `/api/invites/accept` → creates User linked to existing-or-new Employee → auto-login.
- Email: `EmailService` interface gets a `ResendMailer` impl alongside `ConsoleMailer`. `MAIL_DRIVER=resend` activates it (if `RESEND_API_KEY` is set); otherwise falls back to console.

**Tech Stack:** Same as Plans 1-3. New dep: `resend`.

**Spec reference:** `api/docs/superpowers/specs/2026-05-21-api-completion-design.md` §§12.12–12.14, §13, §14, §15.

**Conventions:** Same as Plans 1-3 — absolute paths, smoke tests via `curl`, no git commits, sandbox-disabled for `npm run dev` / `psql` / `curl localhost`. Founder cookie: `/tmp/sp-cookies-login.txt`; relog if expired with `desmond@squarefeet.com` / `newhunter22` / `square-feet`.

---

## Task 1: Install `resend` and wire env

**Files:**
- Modify: `api/package.json`
- Modify: `api/.env.example`

- [ ] **Step 1: Install**

From `api/`:
```bash
npm install resend
```

- [ ] **Step 2: Confirm `.env.example` already has the mailer block (it should from Plan 1)**

It should contain:
```
MAIL_DRIVER=console
RESEND_API_KEY=
RESEND_FROM=SquarePeople <no-reply@squarepeople.squarefeetltd.com>
```

If `MAIL_DRIVER` is missing add it; if `RESEND_*` are missing add them. Don't touch the user's local `api/.env`.

---

## Task 2: Add real Resend mailer + load HTML/text templates from disk

**Files:**
- Modify: `api/utils/mailer.js` (full rewrite of the file from Plan 2)
- Create: `api/emails/invite.html`
- Create: `api/emails/invite.txt`
- Create: `api/emails/password-reset.html`
- Create: `api/emails/password-reset.txt`
- Create: `api/emails/leave-submitted.html`
- Create: `api/emails/leave-submitted.txt`
- Create: `api/emails/leave-decision.html`
- Create: `api/emails/leave-decision.txt`

- [ ] **Step 1: Replace `api/utils/mailer.js`**

```javascript
const fs = require('fs');
const path = require('path');
const env = require('../config/env');

const EMAILS_DIR = path.join(__dirname, '..', 'emails');

const SUBJECTS = {
  invite: 'You\'re invited to join {{companyName}} on SquarePeople',
  'password-reset': 'Reset your SquarePeople password',
  'leave-submitted': 'New leave request from {{employeeName}}',
  'leave-decision': 'Your leave request was {{decision}}',
};

function render(template, data) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => (data[k] ?? ''));
}

function loadTemplate(name) {
  const html = fs.readFileSync(path.join(EMAILS_DIR, `${name}.html`), 'utf8');
  const text = fs.readFileSync(path.join(EMAILS_DIR, `${name}.txt`), 'utf8');
  return { html, text };
}

class ConsoleMailer {
  async send({ to, template, data }) {
    const subject = render(SUBJECTS[template] || `[${template}]`, data);
    const { text } = loadTemplate(template);
    const body = render(text, data);
    // eslint-disable-next-line no-console
    console.log('\n=== [ConsoleMailer] ===');
    console.log(`To:      ${to}`);
    console.log(`From:    ${env.RESEND_FROM || 'SquarePeople <no-reply@example.test>'}`);
    console.log(`Subject: ${subject}`);
    console.log('---');
    console.log(body);
    console.log('=== end ===\n');
    return { delivered: 'console', to, subject };
  }
}

class ResendMailer {
  constructor(apiKey, from) {
    const { Resend } = require('resend');
    this.client = new Resend(apiKey);
    this.from = from;
  }
  async send({ to, template, data }) {
    const subject = render(SUBJECTS[template] || `[${template}]`, data);
    const { html, text } = loadTemplate(template);
    const result = await this.client.emails.send({
      from: this.from,
      to,
      subject,
      html: render(html, data),
      text: render(text, data),
    });
    return { delivered: 'resend', to, subject, id: result.id };
  }
}

function makeMailer() {
  if (env.MAIL_DRIVER === 'resend' && env.RESEND_API_KEY && env.RESEND_FROM) {
    return new ResendMailer(env.RESEND_API_KEY, env.RESEND_FROM);
  }
  return new ConsoleMailer();
}

module.exports = { mailer: makeMailer(), ConsoleMailer, ResendMailer };
```

- [ ] **Step 2: Create `api/emails/invite.html`**

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>You're invited</title></head>
<body style="font-family:'Plus Jakarta Sans',sans-serif;background:#fffbf5;color:#402729;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #efbd89;border-radius:8px;padding:32px;">
    <div style="font-weight:700;font-size:18px;color:#7a4f08;margin-bottom:24px;">SquarePeople <span style="font-weight:400;color:#bd834c;font-size:12px;">by Square Feet</span></div>
    <h1 style="font-size:20px;margin:0 0 12px;">You're invited to join {{companyName}}</h1>
    <p style="line-height:1.6;margin:0 0 16px;">{{inviterName}} added you as <strong>{{role}}</strong>. Click below to accept the invite and set your password.</p>
    <p style="margin:24px 0;"><a href="{{acceptUrl}}" style="display:inline-block;background:#f9ac1b;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600;">Accept invite</a></p>
    <p style="font-size:12px;color:#bd834c;">This link expires in 7 days. If you didn't expect this, ignore the email.</p>
  </div>
</body></html>
```

- [ ] **Step 3: Create `api/emails/invite.txt`**

```
You're invited to join {{companyName}} on SquarePeople.

{{inviterName}} added you as {{role}}.

Accept the invite (expires in 7 days):
{{acceptUrl}}

— SquarePeople by Square Feet
```

- [ ] **Step 4: Create `api/emails/password-reset.html`**

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Reset your password</title></head>
<body style="font-family:'Plus Jakarta Sans',sans-serif;background:#fffbf5;color:#402729;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #efbd89;border-radius:8px;padding:32px;">
    <div style="font-weight:700;font-size:18px;color:#7a4f08;margin-bottom:24px;">SquarePeople <span style="font-weight:400;color:#bd834c;font-size:12px;">by Square Feet</span></div>
    <h1 style="font-size:20px;margin:0 0 12px;">Reset your password</h1>
    <p style="line-height:1.6;margin:0 0 16px;">Hi {{name}}, click below to set a new password. The link expires in 30 minutes.</p>
    <p style="margin:24px 0;"><a href="{{resetUrl}}" style="display:inline-block;background:#f9ac1b;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600;">Reset password</a></p>
    <p style="font-size:12px;color:#bd834c;">If you didn't request a reset, ignore this email — your password stays the same.</p>
  </div>
</body></html>
```

- [ ] **Step 5: Create `api/emails/password-reset.txt`**

```
Hi {{name}},

Reset your SquarePeople password using the link below. The link expires in 30 minutes.

{{resetUrl}}

If you didn't request this, ignore this email.

— SquarePeople by Square Feet
```

- [ ] **Step 6: Create `api/emails/leave-submitted.html`**

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>New leave request</title></head>
<body style="font-family:'Plus Jakarta Sans',sans-serif;background:#fffbf5;color:#402729;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #efbd89;border-radius:8px;padding:32px;">
    <div style="font-weight:700;font-size:18px;color:#7a4f08;margin-bottom:24px;">SquarePeople <span style="font-weight:400;color:#bd834c;font-size:12px;">by Square Feet</span></div>
    <h1 style="font-size:20px;margin:0 0 12px;">New leave request</h1>
    <p style="line-height:1.6;margin:0 0 12px;"><strong>{{employeeName}}</strong> submitted a leave request:</p>
    <ul style="line-height:1.7;margin:0 0 16px;">
      <li>Type: <strong>{{leaveType}}</strong></li>
      <li>Dates: <strong>{{startDate}}</strong> &ndash; <strong>{{endDate}}</strong> ({{days}} day{{daysPlural}})</li>
      <li>Reason: {{reason}}</li>
    </ul>
    <p style="margin:24px 0;"><a href="{{reviewUrl}}" style="display:inline-block;background:#f9ac1b;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600;">Review request</a></p>
  </div>
</body></html>
```

- [ ] **Step 7: Create `api/emails/leave-submitted.txt`**

```
New leave request

{{employeeName}} submitted a leave request:
- Type: {{leaveType}}
- Dates: {{startDate}} to {{endDate}} ({{days}} day{{daysPlural}})
- Reason: {{reason}}

Review at: {{reviewUrl}}

— SquarePeople by Square Feet
```

- [ ] **Step 8: Create `api/emails/leave-decision.html`**

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Leave {{decision}}</title></head>
<body style="font-family:'Plus Jakarta Sans',sans-serif;background:#fffbf5;color:#402729;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #efbd89;border-radius:8px;padding:32px;">
    <div style="font-weight:700;font-size:18px;color:#7a4f08;margin-bottom:24px;">SquarePeople <span style="font-weight:400;color:#bd834c;font-size:12px;">by Square Feet</span></div>
    <h1 style="font-size:20px;margin:0 0 12px;">Your leave request was {{decision}}</h1>
    <p style="line-height:1.6;margin:0 0 12px;">Hi {{employeeName}},</p>
    <ul style="line-height:1.7;margin:0 0 16px;">
      <li>Type: <strong>{{leaveType}}</strong></li>
      <li>Dates: <strong>{{startDate}}</strong> &ndash; <strong>{{endDate}}</strong> ({{days}} day{{daysPlural}})</li>
      <li>Decision: <strong>{{decision}}</strong></li>
      <li>Note: {{reason}}</li>
    </ul>
  </div>
</body></html>
```

- [ ] **Step 9: Create `api/emails/leave-decision.txt`**

```
Hi {{employeeName}},

Your leave request was {{decision}}.

- Type: {{leaveType}}
- Dates: {{startDate}} to {{endDate}} ({{days}} day{{daysPlural}})
- Note: {{reason}}

— SquarePeople by Square Feet
```

- [ ] **Step 10: Smoke test the new mailer**

From `api/`:
```bash
node -e "(async () => { const { mailer } = require('./utils/mailer'); await mailer.send({ to: 'demo@example.com', template: 'invite', data: { companyName: 'Square Feet', inviterName: 'Desmond', role: 'admin', acceptUrl: 'http://localhost:5173/accept-invite?token=abc' } }); })()"
```

Expected (assuming `MAIL_DRIVER=console` in your `.env`): the formatted email block prints to stdout with subject `You're invited to join Square Feet on SquarePeople` and the rendered text body.

---

## Task 3: Create `utils/auditEvents.js` and `middleware/auditLogger.js`

- `auditEvents.js` exposes a single `auditEvent(req, { entity, action, entityId, diff })` helper that controllers call after a successful write. It writes one row to `audit_log` with the actor/company/ip/ua/diff. It's safe to call (errors are swallowed and logged).
- `middleware/auditLogger.js` exports an `audit(entity, action)` factory that wraps a handler so the entry is auto-written after a 2xx response — controllers that prefer auto-wrap can use this.

**Files:**
- Create: `api/utils/auditEvents.js`
- Create: `api/middleware/auditLogger.js`

- [ ] **Step 1: Create `api/utils/auditEvents.js`**

```javascript
const { AuditLog } = require('../association');

// Diff helper: keep only changed keys from `next` compared to `prev`.
function computeDiff(prev, next) {
  if (!prev || !next) return next || null;
  const out = {};
  for (const k of Object.keys(next)) {
    if (JSON.stringify(prev[k]) !== JSON.stringify(next[k])) out[k] = { from: prev[k] ?? null, to: next[k] ?? null };
  }
  return Object.keys(out).length ? out : null;
}

async function auditEvent(req, { entity, action, entityId = null, diff = null }) {
  try {
    if (!req?.user?.companyId) return;
    await AuditLog.create({
      company_id: req.user.companyId,
      actor_user_id: req.user.id ?? null,
      entity,
      entity_id: entityId == null ? null : String(entityId),
      action,
      diff,
      ip: req.ip || null,
      ua: req.headers?.['user-agent'] || null,
    });
  } catch (err) {
    if (req?.log) req.log.warn({ err }, 'auditEvent failed');
    else console.warn('auditEvent failed:', err.message);
  }
}

module.exports = { auditEvent, computeDiff };
```

- [ ] **Step 2: Create `api/middleware/auditLogger.js`**

```javascript
const { auditEvent } = require('../utils/auditEvents');

// Usage: router.post('/', audit('department', 'create'), handler)
// Wraps res.json so the audit row fires after the handler returns 2xx.
// For richer diffs / entity_id, controllers should call auditEvent() directly.
function audit(entity, action) {
  return (req, res, next) => {
    const origJson = res.json.bind(res);
    res.json = (payload) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const entityId = payload?.id || payload?.data?.id || null;
        auditEvent(req, { entity, action, entityId });
      }
      return origJson(payload);
    };
    next();
  };
}

module.exports = audit;
```

- [ ] **Step 3: Smoke test (quick check that the helper compiles)**

From `api/`:
```bash
node -e "console.log(typeof require('./utils/auditEvents').auditEvent, typeof require('./middleware/auditLogger'))"
```

Expected: `function function`.

---

## Task 4: Add `auditEvent(...)` calls to existing write endpoints

The cleanest approach: edit each Plan 3 controller and append an `auditEvent(req, {...})` call at the bottom of every successful write (after `res.json`/`res.status(201).json(...)` would be too late since the response has already been sent; instead call it **before** the response). Since Node-Express responses are non-blocking, calling auditEvent without await is fine — but we'll await for correctness in low-traffic scenarios.

**Pattern:**
```javascript
const created = await Model.create(...);
await auditEvent(req, { entity: 'department', action: 'create', entityId: created.id });
res.status(201).json(toDto(created));
```

**Files:**
- Modify: `api/controllers/departmentController.js`
- Modify: `api/controllers/roleController.js`
- Modify: `api/controllers/employeeController.js`
- Modify: `api/controllers/teamController.js`
- Modify: `api/controllers/projectController.js`
- Modify: `api/controllers/taskController.js`
- Modify: `api/controllers/subtaskController.js`
- Modify: `api/controllers/worktrackingController.js`
- Modify: `api/controllers/attendanceController.js`
- Modify: `api/controllers/leaverequestController.js`
- Modify: `api/controllers/leaveapprovalController.js`
- Modify: `api/controllers/companyController.js`
- Modify: `api/controllers/authController.js`

- [ ] **Step 1: Add the require + audit calls per controller**

At the top of each file above, ensure:
```javascript
const { auditEvent } = require('../utils/auditEvents');
```

Then for each write method, add the audit call. Specifically:

| Controller | Method | `entity` | `action` | `entityId` |
|---|---|---|---|---|
| auth | signup | `user` | `signup` | `result.user.id` |
| auth | login | `user` | `login` | `user.id` |
| auth | employeeLogin | `user` | `login_pin` | `user.id` |
| auth | logout | `user` | `logout` | `req.user.id` |
| auth | logoutAll | `user` | `logout_all` | `req.user.id` |
| auth | resetPassword | `user` | `password_reset` | `user.id` |
| company | updateMe | `company` | `update` | `company.company_id` |
| department | create / update / remove | `department` | `create` / `update` / `delete` | `d.department_id` |
| role | create / update / remove | `role` | `create` / `update` / `delete` | `r.role_id` |
| employee | create / update / remove / assignRoles / removeRole | `employee` | `create` / `update` / `delete` / `assign_roles` / `remove_role` | `e.employee_id` |
| team | create / update / remove / setMembers / removeMember | `team` | `create` / `update` / `delete` / `set_members` / `remove_member` | `t.team_id` |
| project | create / update / remove / setTeams / removeTeam | `project` | `create` / `update` / `delete` / `set_teams` / `remove_team` | `p.project_id` |
| task | create / update / remove / move | `task` | `create` / `update` / `delete` / `kanban_move` | `t.task_id` |
| subtask | create / update / remove | `subtask` | `create` / `update` / `delete` | `s.subtask_id` |
| worktracking | start / pause / resume / stop | `worktracking` | `timer_start` / `timer_stop` / `timer_start` / `timer_stop` | `entry.log_id` |
| attendance | signIn / signOut | `attendance` | `sign_in` / `sign_out` | `row.attendance_id` |
| leaverequest | create / update / cancel | `leaverequest` | `create` / `update` / `delete` | `lr.leave_id` |
| leaveapproval | approve / reject | `leaverequest` | `approve` / `reject` | `lr.leave_id` |

(Place each call just BEFORE the `res.json(...)` line — calling after the response would still work, but before keeps the linear flow honest.)

For update-style endpoints where you want a `diff` field, capture `prev = instance.toJSON()` before `update`, then call `auditEvent(req, { ..., diff: computeDiff(prev, instance.toJSON()) })`. For now: any audit row is better than none — diffs can be added as a quick follow-up.

- [ ] **Step 2: Smoke test that one write goes through**

Boot the server in the background. Re-login if needed. Then create a department and verify the audit row:

```bash
curl -s -b /tmp/sp-cookies-login.txt -X POST http://localhost:3000/api/departments \
  -H 'Content-Type: application/json' \
  -d '{"name":"Marketing","description":"Acquisition + brand"}'

# Verify in DB
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c \
  "select id, entity, action, entity_id, actor_user_id, created_at from audit_log order by id desc limit 3;"
```

Expected: one new `audit_log` row with `entity='department', action='create', entity_id=<id>, actor_user_id=<founder user id>`.

Kill the server.

---

## Task 5: `/api/audit` endpoint (admin list)

**Files:**
- Create: `api/controllers/auditController.js`
- Create: `api/routes/auditRoutes.js`
- Modify: `api/index.js` (mount)

- [ ] **Step 1: Create `api/controllers/auditController.js`**

```javascript
const { Op } = require('sequelize');
const { AuditLog, User } = require('../association');
const { paginated, parsePageQuery } = require('../utils/serializer');

const auditController = {
  list: async (req, res, next) => {
    try {
      const { page, perPage, offset } = parsePageQuery(req.query);
      const where = { company_id: req.user.companyId };
      if (req.query.entity) where.entity = req.query.entity;
      if (req.query.action) where.action = req.query.action;
      if (req.query.actorId) where.actor_user_id = Number(req.query.actorId);
      if (req.query.from || req.query.to) {
        where.created_at = {};
        if (req.query.from) where.created_at[Op.gte] = new Date(req.query.from);
        if (req.query.to) where.created_at[Op.lte] = new Date(req.query.to);
      }
      const { rows, count } = await AuditLog.findAndCountAll({
        where,
        include: [{ model: User, as: 'actor', attributes: ['id', 'email'] }],
        order: [['created_at', 'DESC']],
        limit: perPage, offset,
      });
      const data = rows.map((r) => ({
        id: String(r.id),
        entity: r.entity,
        action: r.action,
        entityId: r.entity_id,
        actor: r.actor ? { id: r.actor.id, email: r.actor.email } : null,
        diff: r.diff,
        ip: r.ip,
        userAgent: r.ua,
        createdAt: r.created_at,
      }));
      res.json(paginated(data, { page, perPage, total: count }));
    } catch (err) { next(err); }
  },
};

module.exports = auditController;
```

- [ ] **Step 2: Create `api/routes/auditRoutes.js`**

```javascript
const express = require('express');
const router = express.Router();
const { z } = require('zod');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const requireTenant = require('../middleware/requireTenant');
const validate = require('../middleware/validate');
const controller = require('../controllers/auditController');

const auditQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  perPage: z.coerce.number().int().positive().max(100).optional(),
  entity: z.string().optional(),
  action: z.string().optional(),
  actorId: z.coerce.number().int().positive().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

router.use(requireAuth, requireTenant, requireRole('admin'));
router.get('/', validate({ query: auditQuery }), controller.list);

module.exports = router;
```

- [ ] **Step 3: Wire into `api/index.js`**

```javascript
const auditRoutes = require('./routes/auditRoutes');
// ...
app.use('/api/audit', auditRoutes);
```

- [ ] **Step 4: Smoke test**

```bash
curl -s -b /tmp/sp-cookies-login.txt 'http://localhost:3000/api/audit?perPage=5'
# expect: 200 with { data: [...], meta: { ... } } — at minimum the department.create row from Task 4
```

---

## Task 6: `/api/dashboard/stats`

**Files:**
- Create: `api/controllers/statsController.js`
- Create: `api/routes/statsRoutes.js`
- Modify: `api/index.js`

- [ ] **Step 1: Create `api/controllers/statsController.js`**

```javascript
const { Op } = require('sequelize');
const { Employee, Task, Attendance, LeaveRequest } = require('../association');

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

const statsController = {
  stats: async (req, res, next) => {
    try {
      const companyId = req.user.companyId;
      const [activeEmployees, newThisMonth, inProgressTasks, totalEmployees, presentToday, pendingLeaves, pendingAwaitingMe] = await Promise.all([
        Employee.count({ where: { company_id: companyId, status: 'active' } }),
        Employee.count({ where: { company_id: companyId, status: 'active', hire_date: { [Op.gte]: startOfMonth() } } }),
        Task.count({ where: { company_id: companyId, status: 'in_progress' } }),
        Employee.count({ where: { company_id: companyId, status: 'active' } }),
        Attendance.count({
          where: {
            company_id: companyId,
            logged_date: today(),
            status: { [Op.in]: ['present', 'late'] },
            signed_in_at: { [Op.ne]: null },
          },
        }),
        LeaveRequest.count({ where: { company_id: companyId, status: 'pending' } }),
        // Awaiting-me approximation: all pending where current user is admin+. Manager-team-filtering deferred.
        LeaveRequest.count({ where: { company_id: companyId, status: 'pending' } }),
      ]);

      const percentToday = totalEmployees > 0 ? Math.round((presentToday / totalEmployees) * 100) : 0;

      res.json({
        activeEmployees: { value: activeEmployees, delta: newThisMonth > 0 ? `+${newThisMonth} this month` : 'no new this month' },
        inProgressTasks: { value: inProgressTasks, sub: '' },
        todayAttendance: { value: `${presentToday} / ${totalEmployees}`, sub: `${percentToday}% present` },
        pendingLeaves: { value: pendingLeaves, sub: pendingAwaitingMe > 0 ? `${pendingAwaitingMe} awaiting your approval` : 'none awaiting you' },
      });
    } catch (err) { next(err); }
  },
};

module.exports = statsController;
```

- [ ] **Step 2: Create `api/routes/statsRoutes.js`**

Note: this file holds both `/stats`, `/activity`, and `/hours-this-week` under `/api/dashboard`. Routes for activity + hours-this-week get added in Tasks 7 + 8.

```javascript
const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const requireTenant = require('../middleware/requireTenant');
const statsController = require('../controllers/statsController');

router.use(requireAuth, requireTenant);
router.get('/stats', statsController.stats);

module.exports = router;
```

- [ ] **Step 3: Wire into `api/index.js`**

```javascript
const dashboardRoutes = require('./routes/statsRoutes');
// ...
app.use('/api/dashboard', dashboardRoutes);
```

- [ ] **Step 4: Smoke test**

```bash
curl -s -b /tmp/sp-cookies-login.txt http://localhost:3000/api/dashboard/stats
# expect: 200 { activeEmployees: {value, delta}, inProgressTasks: {value, sub}, todayAttendance: {value, sub}, pendingLeaves: {value, sub} }
```

---

## Task 7: `/api/dashboard/activity`

Reads from `audit_log` and maps each (entity, action) to a UI-friendly event the ActivityFeed component understands.

**Files:**
- Create: `api/controllers/activityController.js`
- Modify: `api/routes/statsRoutes.js` (add route)

- [ ] **Step 1: Create `api/controllers/activityController.js`**

```javascript
const { Op } = require('sequelize');
const { AuditLog, User, Employee } = require('../association');

// Filter to events that make sense in the activity feed.
const SURFACE = new Set([
  'task:create', 'task:kanban_move', 'task:update',
  'leaverequest:create', 'leaverequest:approve', 'leaverequest:reject',
  'project:create',
  'team:set_members', 'team:create',
  'worktracking:timer_start',
  'user:signup', 'user:login_pin',
]);

function mapRow(row) {
  const actorName = row.actor?.Employee?.name || row.actor?.email || 'Someone';
  const ent = row.entity;
  const act = row.action;
  let kind = `${ent}-${act}`.replace('_', '-');
  let text = '';
  switch (`${ent}:${act}`) {
    case 'task:create':         text = `created task ${row.entity_id ? '#' + row.entity_id : ''}`.trim(); kind = 'task-create'; break;
    case 'task:kanban_move':    text = `moved a task`; kind = 'task-move'; break;
    case 'task:update':         text = `updated a task`; kind = 'task-update'; break;
    case 'leaverequest:create': text = `requested leave`; kind = 'leave-request'; break;
    case 'leaverequest:approve':text = `approved a leave request`; kind = 'leave-approve'; break;
    case 'leaverequest:reject': text = `rejected a leave request`; kind = 'leave-reject'; break;
    case 'project:create':      text = `created a new project`; kind = 'project-create'; break;
    case 'team:create':         text = `created a new team`; kind = 'team-create'; break;
    case 'team:set_members':    text = `updated team members`; kind = 'team-members'; break;
    case 'worktracking:timer_start': text = `started a timer`; kind = 'timer-start'; break;
    case 'user:signup':         text = `signed up`; kind = 'user-signup'; break;
    case 'user:login_pin':      text = `clocked in via PIN`; kind = 'user-login'; break;
  }
  return {
    id: String(row.id),
    kind,
    actor: row.actor ? { name: actorName } : null,
    text,
    timestamp: row.created_at,
  };
}

const activityController = {
  list: async (req, res, next) => {
    try {
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '10', 10)));
      const rows = await AuditLog.findAll({
        where: { company_id: req.user.companyId },
        include: [{ model: User, as: 'actor', include: [{ model: Employee, attributes: ['name'] }], attributes: ['id', 'email'] }],
        order: [['created_at', 'DESC']],
        limit: limit * 3, // over-fetch then filter to SURFACE
      });
      const surfaced = rows.filter((r) => SURFACE.has(`${r.entity}:${r.action}`)).slice(0, limit);
      res.json({ data: surfaced.map(mapRow) });
    } catch (err) { next(err); }
  },
};

module.exports = activityController;
```

- [ ] **Step 2: Add the route in `api/routes/statsRoutes.js`**

Append above `module.exports`:

```javascript
const activityController = require('../controllers/activityController');
router.get('/activity', activityController.list);
```

- [ ] **Step 3: Smoke test**

```bash
curl -s -b /tmp/sp-cookies-login.txt 'http://localhost:3000/api/dashboard/activity?limit=5'
# expect: 200 { data: [ { id, kind, actor: { name }, text, timestamp }, ... ] }
```

---

## Task 8: `/api/dashboard/hours-this-week`

Thin alias for `/api/time/weekly-hours` for the Dashboard chart card; same controller logic.

**Files:**
- Modify: `api/routes/statsRoutes.js` (add route delegating to worktracking)

- [ ] **Step 1: Add the route**

In `api/routes/statsRoutes.js`, append above `module.exports`:

```javascript
const worktrackingController = require('../controllers/worktrackingController');
router.get('/hours-this-week', worktrackingController.weeklyHours);
```

- [ ] **Step 2: Smoke test**

```bash
curl -s -b /tmp/sp-cookies-login.txt http://localhost:3000/api/dashboard/hours-this-week
# expect: 200 { data: [{day, date, sec, percent}, ...] } — 7 days Mon→Sun
```

---

## Task 9: Refine leave-event emails (use real templates + route to managers)

The Plan 3 leave controllers send hard-coded emails to `manager@example.com` with the generic `invite` template. Fix that.

**Files:**
- Modify: `api/controllers/leaverequestController.js` (`create` method)
- Modify: `api/controllers/leaveapprovalController.js` (`approve` + `reject` methods)

- [ ] **Step 1: Update `create` in `leaverequestController.js`**

Replace the existing "Notify manager(s)" try/catch block with:

```javascript
      // Notify the user's manager (if any) + all admins/owners as a fallback.
      try {
        const { mailer } = require('../utils/mailer');
        const env = require('../config/env');
        const employee = await Employee.findByPk(req.user.employeeId);
        const recipients = new Set();
        if (employee?.manager_id) {
          const manager = await Employee.findByPk(employee.manager_id);
          if (manager?.email) recipients.add(manager.email);
        }
        if (recipients.size === 0) {
          const { User } = require('../association');
          const admins = await User.findAll({ where: { company_id: req.user.companyId, role: ['owner', 'admin'] }, attributes: ['email'] });
          for (const u of admins) recipients.add(u.email);
        }
        const days = lr.days;
        for (const to of recipients) {
          await mailer.send({
            to,
            template: 'leave-submitted',
            data: {
              employeeName: employee?.name || 'A team member',
              leaveType: lr.leave_type,
              startDate: lr.start_date,
              endDate: lr.end_date,
              days,
              daysPlural: days === 1 ? '' : 's',
              reason: lr.reason || '(no reason given)',
              reviewUrl: `${env.FRONTEND_URL}/app/leaves`,
            },
          });
        }
      } catch (e) { /* best effort */ }
```

- [ ] **Step 2: Update `approve` in `leaveapprovalController.js`**

Replace the existing "Best-effort email" block with:

```javascript
      try {
        const { mailer } = require('../utils/mailer');
        const requester = await Employee.findByPk(result.employee_id);
        if (requester?.email) {
          const days = result.days;
          await mailer.send({
            to: requester.email,
            template: 'leave-decision',
            data: {
              employeeName: requester.name,
              decision: 'approved',
              leaveType: result.leave_type,
              startDate: result.start_date,
              endDate: result.end_date,
              days,
              daysPlural: days === 1 ? '' : 's',
              reason: '(none)',
            },
          });
        }
      } catch (e) { /* best effort */ }
```

- [ ] **Step 3: Update `reject` similarly**

Replace its email block with:

```javascript
      try {
        const { mailer } = require('../utils/mailer');
        const requester = await Employee.findByPk(lr.employee_id);
        if (requester?.email) {
          const days = lr.days;
          await mailer.send({
            to: requester.email,
            template: 'leave-decision',
            data: {
              employeeName: requester.name,
              decision: 'rejected',
              leaveType: lr.leave_type,
              startDate: lr.start_date,
              endDate: lr.end_date,
              days,
              daysPlural: days === 1 ? '' : 's',
              reason: req.body?.reason || '(no reason given)',
            },
          });
        }
      } catch (e) { /* best effort */ }
```

- [ ] **Step 4: Smoke test (with the server running)**

Submit a new leave + watch the server log for the `leave-submitted` email block (ConsoleMailer prints it). Approve it and watch for the `leave-decision` block.

```bash
curl -s -b /tmp/sp-cookies-login.txt -X POST http://localhost:3000/api/leaves \
  -H 'Content-Type: application/json' \
  -d '{"type":"sick","startDate":"2026-07-01","endDate":"2026-07-02","reason":"Flu"}'
# expect: 201; server log shows leave-submitted email block with proper recipient
# Capture the returned id, then:
curl -s -b /tmp/sp-cookies-login.txt -X POST "http://localhost:3000/api/leaves/<id>/approve"
# expect: 200; server log shows leave-decision email block with decision=approved
```

---

## Task 10: Invites — admin endpoints (create/list/delete/resend)

**Files:**
- Create: `api/controllers/inviteController.js`
- Create: `api/routes/inviteRoutes.js`
- Modify: `api/index.js` (mount)
- Modify: `api/validators/resourceValidators.js` (add invite schemas)

- [ ] **Step 1: Add invite Zod schemas to `api/validators/resourceValidators.js`**

Append to the file (before `module.exports`):

```javascript
const inviteCreateBody = z.object({
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'manager', 'member']).default('member'),
  employeeId: z.number().int().positive().optional().nullable(),
});

const inviteAcceptBody = z.object({
  token: z.string().min(10),
  fullName: z.string().min(1).max(120),
  password: z.string().min(8),
  pin: z.string().regex(/^\d{4}$/).optional(),
});
```

Add them to `module.exports` (the exports list at the bottom).

- [ ] **Step 2: Create `api/controllers/inviteController.js`**

```javascript
const crypto = require('crypto');
const { Op } = require('sequelize');
const { Invite, Employee, Company, User } = require('../association');
const { hashToken } = require('../utils/jwt');
const { hashPassword } = require('../utils/password');
const { hashPin } = require('../utils/pin');
const { mailer } = require('../utils/mailer');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const { auditEvent } = require('../utils/auditEvents');

const INVITE_TTL_DAYS = 7;

function toInviteDto(i) {
  return {
    id: i.id,
    email: i.email,
    role: i.role,
    employeeId: i.employee_id,
    expiresAt: i.expires_at,
    acceptedAt: i.accepted_at,
    createdAt: i.createdAt,
  };
}

async function emailInvite(invite, rawToken, req) {
  const inviter = req.user?.id ? await User.findByPk(req.user.id) : null;
  const inviterEmployee = inviter?.employee_id ? await Employee.findByPk(inviter.employee_id) : null;
  const company = await Company.findByPk(invite.company_id);
  const acceptUrl = `${env.FRONTEND_URL}/accept-invite?token=${rawToken}`;
  await mailer.send({
    to: invite.email,
    template: 'invite',
    data: {
      companyName: company?.name || 'your workspace',
      inviterName: inviterEmployee?.name || inviter?.email || 'An admin',
      role: invite.role,
      acceptUrl,
    },
  });
}

const inviteController = {
  list: async (req, res, next) => {
    try {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const rows = await Invite.findAll({
        where: {
          company_id: req.user.companyId,
          [Op.or]: [{ accepted_at: null }, { accepted_at: { [Op.gte]: cutoff } }],
        },
        order: [['createdAt', 'DESC']],
      });
      res.json({ data: rows.map(toInviteDto) });
    } catch (err) { next(err); }
  },

  create: async (req, res, next) => {
    try {
      const rawToken = crypto.randomBytes(24).toString('hex');
      const invite = await Invite.create({
        company_id: req.user.companyId,
        email: req.body.email,
        role: req.body.role || 'member',
        employee_id: req.body.employeeId || null,
        token_hash: hashToken(rawToken),
        expires_at: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
        created_by_user_id: req.user.id,
      });
      await emailInvite(invite, rawToken, req);
      await auditEvent(req, { entity: 'invite', action: 'create', entityId: invite.id });
      res.status(201).json(toInviteDto(invite));
    } catch (err) { next(err); }
  },

  remove: async (req, res, next) => {
    try {
      const invite = await req.scope(Invite).findByPk(req.params.id);
      if (!invite) return next(AppError.notFound('Invite'));
      if (invite.accepted_at) return next(AppError.businessRule('INVITE_ACCEPTED', 'Cannot revoke an accepted invite.'));
      await invite.destroy();
      await auditEvent(req, { entity: 'invite', action: 'delete', entityId: req.params.id });
      res.json({ ok: true });
    } catch (err) { next(err); }
  },

  resend: async (req, res, next) => {
    try {
      const invite = await req.scope(Invite).findByPk(req.params.id);
      if (!invite) return next(AppError.notFound('Invite'));
      if (invite.accepted_at) return next(AppError.businessRule('INVITE_ACCEPTED', 'Cannot resend an accepted invite.'));
      const rawToken = crypto.randomBytes(24).toString('hex');
      await invite.update({
        token_hash: hashToken(rawToken),
        expires_at: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
      });
      await emailInvite(invite, rawToken, req);
      await auditEvent(req, { entity: 'invite', action: 'resend', entityId: invite.id });
      res.json(toInviteDto(invite));
    } catch (err) { next(err); }
  },
};

module.exports = inviteController;
```

- [ ] **Step 3: Create `api/routes/inviteRoutes.js`**

```javascript
const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const requireTenant = require('../middleware/requireTenant');
const validate = require('../middleware/validate');
const { idParam, inviteCreateBody } = require('../validators/resourceValidators');
const controller = require('../controllers/inviteController');

router.use(requireAuth, requireTenant, requireRole('admin'));

router.get('/', controller.list);
router.post('/', validate({ body: inviteCreateBody }), controller.create);
router.delete('/:id', validate({ params: idParam }), controller.remove);
router.post('/:id/resend', validate({ params: idParam }), controller.resend);

module.exports = router;
```

- [ ] **Step 4: Wire into `api/index.js`**

```javascript
const inviteRoutes = require('./routes/inviteRoutes');
// ...
app.use('/api/invites', inviteRoutes);
```

- [ ] **Step 5: Smoke test**

```bash
curl -s -b /tmp/sp-cookies-login.txt -X POST http://localhost:3000/api/invites \
  -H 'Content-Type: application/json' \
  -d '{"email":"newhire@squarefeet.com","role":"member"}'
# expect: 201 with invite DTO. Server log shows the invite email block with the accept URL containing ?token=<48-hex>

curl -s -b /tmp/sp-cookies-login.txt http://localhost:3000/api/invites
# expect: 200 with data array containing the new invite

# Save the raw token for Task 11. From the server log block, extract the hex string after ?token=
```

---

## Task 11: Invites — public accept (GET + POST)

**Files:**
- Modify: `api/controllers/inviteController.js` (add `acceptGet`, `acceptPost`)
- Modify: `api/routes/inviteRoutes.js` (mount public sub-router that bypasses requireAuth)

- [ ] **Step 1: Add to `inviteController.js`**

```javascript
  acceptGet: async (req, res, next) => {
    try {
      const tokenHash = hashToken(String(req.query.token || ''));
      const invite = await Invite.findOne({ where: { token_hash: tokenHash } });
      if (!invite) return next(AppError.notFound('Invite'));
      if (invite.accepted_at) return res.json({ status: 'accepted' });
      if (invite.expires_at < new Date()) return res.json({ status: 'expired' });
      const company = await Company.findByPk(invite.company_id);
      res.json({
        status: 'pending',
        invite: {
          companyName: company?.name,
          role: invite.role,
          email: invite.email,
        },
      });
    } catch (err) { next(err); }
  },

  acceptPost: async (req, res, next) => {
    const sequelize = require('../config/database');
    const { signAccessToken, signRefreshToken, REFRESH_TTL_SEC } = require('../utils/jwt');
    const { setAccessCookie, setRefreshCookie } = require('../utils/cookies');
    const { RefreshToken } = require('../association');
    const { token, fullName, password, pin } = req.body;
    try {
      const result = await sequelize.transaction(async (t) => {
        const tokenHash = hashToken(token);
        const invite = await Invite.findOne({ where: { token_hash: tokenHash }, transaction: t });
        if (!invite) throw AppError.notFound('Invite');
        if (invite.accepted_at) throw AppError.businessRule('INVITE_ACCEPTED', 'Invite already accepted.');
        if (invite.expires_at < new Date()) throw AppError.businessRule('INVITE_EXPIRED', 'Invite expired.');

        let employee = invite.employee_id ? await Employee.findByPk(invite.employee_id, { transaction: t }) : null;
        if (!employee) {
          employee = await Employee.create({
            company_id: invite.company_id,
            name: fullName,
            email: invite.email,
            status: 'active',
            hire_date: new Date().toISOString().slice(0, 10),
          }, { transaction: t });
        }
        const user = await User.create({
          company_id: invite.company_id,
          employee_id: employee.employee_id,
          email: invite.email,
          password_hash: await hashPassword(password),
          pin_hash: pin ? await hashPin(pin) : null,
          role: invite.role,
        }, { transaction: t });
        await invite.update({ accepted_at: new Date() }, { transaction: t });
        return { user, employee, companyId: invite.company_id };
      });

      // Issue session (post-transaction)
      const access = signAccessToken({ userId: result.user.id, role: result.user.role, companyId: result.user.company_id, employeeId: result.user.employee_id });
      const { token: refresh } = signRefreshToken({ userId: result.user.id, role: result.user.role, companyId: result.user.company_id, employeeId: result.user.employee_id });
      await RefreshToken.create({ user_id: result.user.id, token_hash: hashToken(refresh), expires_at: new Date(Date.now() + REFRESH_TTL_SEC * 1000), ip: req.ip, ua: req.headers['user-agent'] || null });
      setAccessCookie(res, access);
      setRefreshCookie(res, refresh);

      await auditEvent({ ...req, user: { ...result.user.toJSON(), id: result.user.id, companyId: result.user.company_id } }, { entity: 'user', action: 'invite_accept', entityId: result.user.id });

      res.json({
        user: { id: result.user.id, email: result.user.email, role: result.user.role, companyId: result.user.company_id, employeeId: result.user.employee_id },
      });
    } catch (err) {
      if (err instanceof AppError) return next(err);
      next(err);
    }
  },
```

- [ ] **Step 2: Update `inviteRoutes.js` to expose public accept routes**

Restructure the router so accept endpoints are NOT under requireAuth:

```javascript
const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const requireTenant = require('../middleware/requireTenant');
const validate = require('../middleware/validate');
const { idParam, inviteCreateBody, inviteAcceptBody } = require('../validators/resourceValidators');
const controller = require('../controllers/inviteController');

// PUBLIC routes first
router.get('/accept', controller.acceptGet);
router.post('/accept', validate({ body: inviteAcceptBody }), controller.acceptPost);

// AUTHED admin routes after
router.use(requireAuth, requireTenant, requireRole('admin'));
router.get('/', controller.list);
router.post('/', validate({ body: inviteCreateBody }), controller.create);
router.delete('/:id', validate({ params: idParam }), controller.remove);
router.post('/:id/resend', validate({ params: idParam }), controller.resend);

module.exports = router;
```

- [ ] **Step 3: Smoke test the public accept (GET, then POST)**

Using the raw token from Task 10:

```bash
TOKEN=<paste-hex-token>
# Pre-flight
curl -s "http://localhost:3000/api/invites/accept?token=$TOKEN"
# expect: 200 { status: 'pending', invite: { companyName, role, email } }

# Accept
curl -s -c /tmp/sp-invite-cookies.txt -X POST http://localhost:3000/api/invites/accept \
  -H 'Content-Type: application/json' \
  -d "{\"token\":\"$TOKEN\",\"fullName\":\"New Hire\",\"password\":\"hireme22\",\"pin\":\"5678\"}"
# expect: 200 { user: { ... } }, cookies set

# Confirm the new user can hit /me
curl -s -b /tmp/sp-invite-cookies.txt http://localhost:3000/api/me | head -c 200
# expect: 200 with their own user/company/employee/permissions
```

Replay the GET — should now return `{ status: 'accepted' }`.

---

## Task 12: README smoke-test recipes

The spec calls for a `README.md` with manual smoke-test recipes per endpoint group (curl examples + expected responses). One file at `api/README.md`.

**Files:**
- Create: `api/README.md`

- [ ] **Step 1: Create `api/README.md`**

```markdown
# SquarePeople API

Express 5 + Sequelize 6 + PostgreSQL. Multi-tenant SaaS backend for the SquarePeople Vue 3 frontend.

## Run locally

1. Copy `.env.example` to `.env` and fill in `DB_*` for your local Postgres, plus two random 32-byte hex strings for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`. Generate with:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. Create the DB:
   ```bash
   psql -h $DB_HOST -U $DB_USER -d postgres -c "CREATE DATABASE squarepeople;"
   ```
3. `npm install` and `npm run dev`. Sequelize syncs all tables on first boot.

## Conventions

- All endpoints under `/api`.
- Auth via httpOnly cookies (`sp_access`, `sp_refresh`). Frontend must send `axios` with `withCredentials: true`.
- Lists return `{ data: [...], meta: { page, perPage, total } }`. Single resources return a bare DTO.
- Errors return `{ error: { code, message, details } }`.
- Status codes used: 200, 201, 400 (validation), 401 (no/bad auth), 403 (wrong role), 404, 409 (conflict), 422 (business rule), 500.

## Smoke tests by area

### Auth + /me

```bash
# Signup
curl -s -c /tmp/sp.txt -X POST http://localhost:3000/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"fullName":"Owner","email":"owner@example.com","password":"hunter22","companyName":"Example","workspaceSlug":"example","industry":"Technology","workdays":["Mon","Tue","Wed","Thu","Fri"]}'

# Login (later)
curl -s -c /tmp/sp.txt -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@example.com","password":"hunter22","workspaceSlug":"example"}'

# Me
curl -s -b /tmp/sp.txt http://localhost:3000/api/me
```

### Org

```bash
curl -s -b /tmp/sp.txt -X POST http://localhost:3000/api/departments -H 'Content-Type: application/json' -d '{"name":"Engineering"}'
curl -s -b /tmp/sp.txt -X POST http://localhost:3000/api/roles -H 'Content-Type: application/json' -d '{"name":"Senior Dev","color":"#f9ac1b"}'
curl -s -b /tmp/sp.txt -X POST http://localhost:3000/api/employees -H 'Content-Type: application/json' -d '{"name":"Maya","email":"maya@ex.com","hireDate":"2026-01-01"}'
curl -s -b /tmp/sp.txt -X POST http://localhost:3000/api/teams -H 'Content-Type: application/json' -d '{"name":"Frontend","leadEmployeeId":1}'
```

### Work

```bash
curl -s -b /tmp/sp.txt -X POST http://localhost:3000/api/projects -H 'Content-Type: application/json' -d '{"name":"Mobile redesign","status":"in-progress"}'
curl -s -b /tmp/sp.txt -X POST http://localhost:3000/api/tasks -H 'Content-Type: application/json' -d '{"projectId":1,"title":"Build login","priority":"high"}'
curl -s -b /tmp/sp.txt 'http://localhost:3000/api/tasks/kanban?projectId=1'
curl -s -b /tmp/sp.txt -X POST http://localhost:3000/api/tasks/1/move -H 'Content-Type: application/json' -d '{"toColumn":"inProgress","toIndex":0}'
```

### Time

```bash
curl -s -b /tmp/sp.txt -X POST http://localhost:3000/api/time/start -H 'Content-Type: application/json' -d '{"taskId":1}'
curl -s -b /tmp/sp.txt http://localhost:3000/api/time/entries
curl -s -b /tmp/sp.txt -X POST http://localhost:3000/api/time/1/stop
```

### Attendance + Leaves

```bash
curl -s -b /tmp/sp.txt -X POST http://localhost:3000/api/attendance/sign-in
curl -s -b /tmp/sp.txt 'http://localhost:3000/api/attendance/month?year=2026&month=5'

curl -s -b /tmp/sp.txt -X POST http://localhost:3000/api/leaves -H 'Content-Type: application/json' -d '{"type":"annual","startDate":"2026-06-10","endDate":"2026-06-14","reason":"Family"}'
curl -s -b /tmp/sp.txt -X POST http://localhost:3000/api/leaves/1/approve
```

### Dashboard

```bash
curl -s -b /tmp/sp.txt http://localhost:3000/api/dashboard/stats
curl -s -b /tmp/sp.txt 'http://localhost:3000/api/dashboard/activity?limit=10'
curl -s -b /tmp/sp.txt http://localhost:3000/api/dashboard/hours-this-week
```

### Invites

```bash
curl -s -b /tmp/sp.txt -X POST http://localhost:3000/api/invites -H 'Content-Type: application/json' -d '{"email":"new@example.com","role":"member"}'
# Grab the token from the server log (ConsoleMailer block) or your Resend dashboard.

curl -s 'http://localhost:3000/api/invites/accept?token=<TOKEN>'
curl -s -c /tmp/sp-new.txt -X POST http://localhost:3000/api/invites/accept -H 'Content-Type: application/json' -d '{"token":"<TOKEN>","fullName":"New Hire","password":"hireme22","pin":"5678"}'
```

### Audit

```bash
curl -s -b /tmp/sp.txt 'http://localhost:3000/api/audit?perPage=20'
```
```

---

## Task 13: End-to-end smoke test

Confirms every Plan 4 endpoint works and tenancy still holds.

- [ ] **Step 1: Boot the server in the background**

- [ ] **Step 2: Log in as founder if needed**

- [ ] **Step 3: Walk through Plan 4 endpoints**

```bash
for path in \
  /api/dashboard/stats \
  /api/dashboard/activity?limit=10 \
  /api/dashboard/hours-this-week \
  /api/audit?perPage=10 \
  /api/invites \
; do
  echo "=== $path ==="
  curl -s -o /tmp/resp -w "%{http_code}\n" -b /tmp/sp-cookies-login.txt "http://localhost:3000$path"
  head -c 200 /tmp/resp; echo
done
```

Expected: every line prints `200` and a sensible JSON snippet.

- [ ] **Step 4: Create one invite + accept it end-to-end**

(Same as Task 11 Step 3.) Verify the new user can hit `/api/me`.

- [ ] **Step 5: Audit log should have rows for all the writes during this test**

```bash
curl -s -b /tmp/sp-cookies-login.txt 'http://localhost:3000/api/audit?perPage=20' | head -c 600
```

Expected: at least 5 recent rows including the invite create, the new user accept (entity `user`, action `invite_accept`), and any other writes you did.

- [ ] **Step 6: Kill the server**

---

## Done

After this plan the API is feature-complete per the spec. Every screen in the frontend has the data it needs, every write is audited, the dashboard aggregates work, invites + email work end-to-end (Console or Resend), and the response shapes match what the frontend's mocks were emitting.

**Final shape:**
- 30+ endpoints across `/api/auth`, `/api/me`, `/api/companies`, `/api/departments`, `/api/roles`, `/api/employees`, `/api/teams`, `/api/projects`, `/api/tasks`, `/api/tasks/:id/subtasks`, `/api/time`, `/api/attendance`, `/api/leaves`, `/api/invites`, `/api/dashboard`, `/api/audit`.
- Multi-tenant by schema + middleware.
- httpOnly cookie sessions with rotation.
- Pluggable mailer (Console / Resend).
- Audit log on every write, exposed via `/api/audit` and surfaced on the dashboard.

**Deferred for future work (explicit non-goals, see spec §20):**
- SSO (Google / Microsoft).
- Real-time notifications / websockets / SSE.
- Automated test suite + CI/CD.
- Real DB migrations (Umzug / sequelize-cli).
- File uploads / avatars.
- Manager-team-membership-aware filtering for `/leaves/pending` and `/dashboard/stats`'s "awaiting your approval" — currently any admin+ sees all.
- Audit log diff field is populated only when controllers opt in by computing it — Plan 4 leaves diff null in most cases. Tightening is a small follow-up.

**Frontend follow-up:**
- Dashboard.vue: swap `useStats` + `useActivity` mock fetches for real `/api/dashboard/stats` + `/api/dashboard/activity`.
- Add `/accept-invite` view consuming `/api/invites/accept`.
- Add an Invites admin UI under Settings or similar (calls `/api/invites` POST/GET/DELETE/POST :id/resend).
- Add an Audit log view if you want to surface `/api/audit`.
