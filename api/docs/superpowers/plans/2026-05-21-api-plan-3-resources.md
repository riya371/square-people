# API Plan 3 — Resource CRUD + Time/Attendance/Leaves (M4 + M5 + M6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite every existing CRUD controller to be tenant-scoped (via `req.scope(Model)` from Plan 2), emit camelCase DTOs (no UI fields), enforce RBAC, and add the new endpoints the frontend needs that don't exist yet: Kanban shape + `/tasks/:id/move`, timer start/pause/stop + weekly-hours, attendance sign-in/out + month grid, leaves workflow (create/approve/reject) with auto-attendance side-effects + email notifications. After this plan, every screen in the frontend has real data to consume.

**Architecture:**
- Every authenticated route is `requireAuth → requireTenant → (optional) requireRole → validate → handler`.
- Tenancy: handlers use `req.scope(Model)` everywhere. Never `Model.findX(...)` directly inside a tenant-scoped handler.
- DTOs: a single `utils/serializer.js` exposes `toCompanyDto`, `toEmployeeDto`, `toRoleDto`, etc. Routes return either a bare DTO (single resource) or `{ data, meta }` envelope (list).
- Validation: `validators/resourceValidators.js` houses Zod schemas for every body/query/params shape.
- Email: leave events use the `mailer` from Plan 2 (ConsoleMailer; swapped to Resend in Plan 4).

**Tech Stack:** Same as Plans 1+2. No new deps in this plan.

**Spec reference:** `api/docs/superpowers/specs/2026-05-21-api-completion-design.md` §§12.2–12.11.

**Conventions:** Same as Plans 1+2 — absolute paths, smoke tests via `curl` + `psql`, no git commits, sandbox-disabled for `npm run dev` / `psql` / `curl localhost`. **Smoke tests assume the founder cookie at `/tmp/sp-cookies-login.txt` from Plan 2 is still valid; if it's been expired by the 15-min access TTL, log in fresh:**

```bash
curl -s -c /tmp/sp-cookies-login.txt -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"desmond@squarefeet.com","password":"newhunter22","workspaceSlug":"square-feet"}'
```

(Password was changed in Plan 2 T17.)

---

## Task 1: Create `utils/serializer.js`

A single module of `toXDto(modelInstance)` functions. Used by every controller in this plan. Keeps DTO shape consistent and eliminates duplication.

**Files:**
- Create: `api/utils/serializer.js`

- [ ] **Step 1: Create `api/utils/serializer.js`**

```javascript
function toCompanyDto(c, extras = {}) {
  if (!c) return null;
  return {
    id: c.company_id, slug: c.slug, name: c.name,
    industry: c.industry, companySize: c.companySize,
    workingDays: c.workingDays, workingHours: c.workingHours,
    address: c.address, website: c.website, phone: c.phone,
    ...extras,
  };
}

function toDepartmentDto(d, extras = {}) {
  if (!d) return null;
  return { id: d.department_id, name: d.name, description: d.description, ...extras };
}

function toRoleDto(r) {
  if (!r) return null;
  return { id: r.role_id, name: r.name, description: r.description, color: r.color };
}

function toEmployeeDto(e, extras = {}) {
  if (!e) return null;
  return {
    id: e.employee_id,
    name: e.name,
    email: e.email,
    phone: e.phone,
    employeeCode: e.employee_code,
    departmentId: e.department_id,
    managerId: e.manager_id,
    hireDate: e.hire_date,
    terminationDate: e.termination_date,
    status: e.status,
    department: e.Department ? toDepartmentDto(e.Department) : undefined,
    roles: Array.isArray(e.roles) ? e.roles.map(toRoleDto) : undefined,
    ...extras,
  };
}

function toTeamDto(t, extras = {}) {
  if (!t) return null;
  return {
    id: t.team_id, name: t.name, description: t.description,
    leadEmployeeId: t.lead_employee_id,
    lead: t.leader ? { id: t.leader.employee_id, name: t.leader.name } : null,
    ...extras,
  };
}

function toProjectDto(p, extras = {}) {
  if (!p) return null;
  return {
    id: p.project_id, name: p.name, description: p.description,
    status: p.status, dueDate: p.due_date,
    startDate: p.start_date, endDate: p.end_date,
    teams: Array.isArray(p.teams) ? p.teams.map((t) => ({ id: t.team_id, name: t.name })) : undefined,
    ...extras,
  };
}

const STATUS_DB_TO_DTO = { pending: 'pending', in_progress: 'inProgress', completed: 'completed' };
const STATUS_DTO_TO_DB = { pending: 'pending', inProgress: 'in_progress', completed: 'completed' };

function toTaskDto(t, extras = {}) {
  if (!t) return null;
  return {
    id: t.task_id, code: t.code, title: t.title, description: t.description,
    projectId: t.project_id, assigneeId: t.assigned_to,
    priority: t.priority, status: STATUS_DB_TO_DTO[t.status] || t.status,
    position: t.position,
    assignee: t.assignee ? { id: t.assignee.employee_id, name: t.assignee.name } : null,
    project: t.Project ? { id: t.Project.project_id, name: t.Project.name } : undefined,
    subtasksCount: t.subtasksCount,
    ...extras,
  };
}

function toSubtaskDto(s) {
  if (!s) return null;
  return {
    id: s.subtask_id, taskId: s.task_id, title: s.title, description: s.description,
    assigneeId: s.assigned_to,
    status: STATUS_DB_TO_DTO[s.status] || s.status,
    position: s.position, deadline: s.deadline,
  };
}

function toTimeEntryDto(e) {
  if (!e) return null;
  const startedAt = e.start_time instanceof Date ? e.start_time : new Date(e.start_time);
  const endedAt = e.end_time ? (e.end_time instanceof Date ? e.end_time : new Date(e.end_time)) : null;
  const durationSec = endedAt
    ? Math.round((endedAt - startedAt) / 1000)
    : Math.round((Date.now() - startedAt.getTime()) / 1000);
  return {
    id: e.log_id, taskId: e.task_id, subtaskId: e.subtask_id,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt ? endedAt.toISOString() : null,
    durationSec,
    loggedDate: e.logged_date,
    task: e.Task ? { id: e.Task.task_id, title: e.Task.title } : undefined,
  };
}

function toAttendanceDto(a) {
  if (!a) return null;
  return {
    id: a.attendance_id, loggedDate: a.logged_date,
    signedInAt: a.signed_in_at, signedOutAt: a.signed_out_at,
    status: a.status,
  };
}

function toLeaveRequestDto(lr, extras = {}) {
  if (!lr) return null;
  return {
    id: lr.leave_id,
    employeeId: lr.employee_id,
    type: lr.leave_type,
    status: lr.status,
    startDate: lr.start_date, endDate: lr.end_date,
    days: lr.days, reason: lr.reason,
    submittedAt: lr.created_at,
    employee: lr.employee ? toEmployeeDto(lr.employee) : undefined,
    ...extras,
  };
}

function paginated(rows, meta) {
  return { data: rows, meta };
}

function parsePageQuery(q) {
  const page = Math.max(1, parseInt(q.page || '1', 10));
  const perPage = Math.min(100, Math.max(1, parseInt(q.perPage || '20', 10)));
  return { page, perPage, offset: (page - 1) * perPage };
}

module.exports = {
  toCompanyDto, toDepartmentDto, toRoleDto, toEmployeeDto, toTeamDto,
  toProjectDto, toTaskDto, toSubtaskDto, toTimeEntryDto, toAttendanceDto,
  toLeaveRequestDto, paginated, parsePageQuery,
  STATUS_DB_TO_DTO, STATUS_DTO_TO_DB,
};
```

---

## Task 2: Create `validators/resourceValidators.js`

Single module of Zod schemas for resource bodies/queries. Imported by every route file.

**Files:**
- Create: `api/validators/resourceValidators.js`

- [ ] **Step 1: Create `api/validators/resourceValidators.js`**

```javascript
const { z } = require('zod');

const idParam = z.object({ id: z.coerce.number().int().positive() });
const pageQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  perPage: z.coerce.number().int().positive().max(100).optional(),
  q: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

// Departments
const departmentBody = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
});

// Roles
const roleBody = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  color: z.string().max(40).optional(),
});

// Employees
const employeeBody = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  phone: z.string().max(40).optional(),
  employeeCode: z.string().max(40).optional(),
  departmentId: z.number().int().positive().optional().nullable(),
  managerId: z.number().int().positive().optional().nullable(),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['active', 'inactive', 'terminated']).optional(),
});
const employeeListQuery = pageQuery.extend({
  departmentId: z.coerce.number().int().positive().optional(),
  status: z.enum(['active', 'inactive', 'terminated']).optional(),
});
const assignRolesBody = z.object({
  roleIds: z.array(z.number().int().positive()),
});

// Teams
const teamBody = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  leadEmployeeId: z.number().int().positive().optional().nullable(),
});
const assignTeamMembersBody = z.object({
  employeeIds: z.array(z.number().int().positive()),
});

// Projects
const projectBody = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  status: z.enum(['on-track', 'at-risk', 'in-progress', 'completed']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});
const assignProjectTeamsBody = z.object({
  teamIds: z.array(z.number().int().positive()),
});

// Tasks
const taskBody = z.object({
  projectId: z.number().int().positive(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  assigneeId: z.number().int().positive().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  status: z.enum(['pending', 'inProgress', 'completed']).optional(),
});
const taskUpdateBody = taskBody.partial();
const taskListQuery = pageQuery.extend({
  projectId: z.coerce.number().int().positive().optional(),
  assigneeId: z.coerce.number().int().positive().optional(),
  status: z.enum(['pending', 'inProgress', 'completed']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
});
const taskKanbanQuery = z.object({
  projectId: z.coerce.number().int().positive().optional(),
});
const taskMoveBody = z.object({
  toColumn: z.enum(['pending', 'inProgress', 'completed']),
  toIndex: z.number().int().nonnegative(),
});

// Subtasks
const subtaskBody = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  assigneeId: z.number().int().positive().optional().nullable(),
  status: z.enum(['pending', 'inProgress', 'completed']).optional(),
  deadline: z.string().datetime().optional().nullable(),
});

// Time / WorkTracking
const timerStartBody = z.object({
  taskId: z.number().int().positive(),
  subtaskId: z.number().int().positive().optional().nullable(),
});
const timeEntriesQuery = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
const weeklyHoursQuery = z.object({
  weekOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// Attendance
const attendanceMonthQuery = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});
const attendanceSummaryQuery = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// Leaves
const leaveCreateBody = z.object({
  type: z.enum(['annual', 'sick', 'maternity', 'unpaid', 'other']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(1000).optional(),
});
const leaveRejectBody = z.object({
  reason: z.string().max(1000).optional(),
});

module.exports = {
  idParam, pageQuery,
  departmentBody, roleBody,
  employeeBody, employeeListQuery, assignRolesBody,
  teamBody, assignTeamMembersBody,
  projectBody, assignProjectTeamsBody,
  taskBody, taskUpdateBody, taskListQuery, taskKanbanQuery, taskMoveBody,
  subtaskBody,
  timerStartBody, timeEntriesQuery, weeklyHoursQuery,
  attendanceMonthQuery, attendanceSummaryQuery,
  leaveCreateBody, leaveRejectBody,
};
```

---

## Task 3: Departments controller + routes

**Files:**
- Modify: `api/controllers/departmentController.js` (full rewrite)
- Modify: `api/routes/departmentRoutes.js` (full rewrite)

- [ ] **Step 1: Replace `api/controllers/departmentController.js`**

```javascript
const { Department, Employee } = require('../association');
const { toDepartmentDto, paginated, parsePageQuery } = require('../utils/serializer');
const AppError = require('../utils/AppError');

async function withHeadcount(dept) {
  const headcount = await Employee.count({ where: { department_id: dept.department_id, status: 'active' } });
  return toDepartmentDto(dept, { headcount });
}

const departmentController = {
  list: async (req, res, next) => {
    try {
      const { page, perPage, offset } = parsePageQuery(req.query);
      const { rows, count } = await Department.findAndCountAll({
        where: { company_id: req.user.companyId },
        order: [['name', 'ASC']],
        limit: perPage, offset,
      });
      const data = await Promise.all(rows.map(withHeadcount));
      res.json(paginated(data, { page, perPage, total: count }));
    } catch (err) { next(err); }
  },

  getById: async (req, res, next) => {
    try {
      const d = await req.scope(Department).findByPk(req.params.id);
      if (!d) return next(AppError.notFound('Department'));
      res.json(await withHeadcount(d));
    } catch (err) { next(err); }
  },

  create: async (req, res, next) => {
    try {
      const d = await req.scope(Department).create(req.body);
      res.status(201).json(toDepartmentDto(d, { headcount: 0 }));
    } catch (err) {
      if (err?.name === 'SequelizeUniqueConstraintError') {
        return next(AppError.conflict('DEPARTMENT_NAME_TAKEN', 'A department with that name already exists.'));
      }
      next(err);
    }
  },

  update: async (req, res, next) => {
    try {
      const d = await req.scope(Department).findByPk(req.params.id);
      if (!d) return next(AppError.notFound('Department'));
      await d.update(req.body);
      res.json(await withHeadcount(d));
    } catch (err) { next(err); }
  },

  remove: async (req, res, next) => {
    try {
      const d = await req.scope(Department).findByPk(req.params.id);
      if (!d) return next(AppError.notFound('Department'));
      await d.destroy();
      res.json({ ok: true });
    } catch (err) { next(err); }
  },
};

module.exports = departmentController;
```

- [ ] **Step 2: Replace `api/routes/departmentRoutes.js`**

```javascript
const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const requireTenant = require('../middleware/requireTenant');
const validate = require('../middleware/validate');
const { idParam, departmentBody, pageQuery } = require('../validators/resourceValidators');
const controller = require('../controllers/departmentController');

router.use(requireAuth, requireTenant);

router.get('/', validate({ query: pageQuery }), controller.list);
router.get('/:id', validate({ params: idParam }), controller.getById);
router.post('/', requireRole('admin'), validate({ body: departmentBody }), controller.create);
router.patch('/:id', requireRole('admin'), validate({ params: idParam, body: departmentBody.partial() }), controller.update);
router.delete('/:id', requireRole('admin'), validate({ params: idParam }), controller.remove);

module.exports = router;
```

- [ ] **Step 3: Boot the server in the background, smoke test**

```bash
# create
curl -s -b /tmp/sp-cookies-login.txt -X POST http://localhost:3000/api/departments \
  -H 'Content-Type: application/json' \
  -d '{"name":"Engineering","description":"Builds product"}'
# expect: 201 { id, name: "Engineering", description: ..., headcount: 0 }

# list
curl -s -b /tmp/sp-cookies-login.txt http://localhost:3000/api/departments
# expect: 200 { data: [...], meta: { page:1, perPage:20, total:1 } }
```

Kill the server.

---

## Task 4: Roles controller + routes

**Files:**
- Modify: `api/controllers/roleController.js` (full rewrite)
- Modify: `api/routes/roleRoutes.js` (full rewrite)

- [ ] **Step 1: Replace `api/controllers/roleController.js`**

```javascript
const { Role } = require('../association');
const { toRoleDto, paginated, parsePageQuery } = require('../utils/serializer');
const AppError = require('../utils/AppError');

const roleController = {
  list: async (req, res, next) => {
    try {
      const { page, perPage, offset } = parsePageQuery(req.query);
      const { rows, count } = await Role.findAndCountAll({
        where: { company_id: req.user.companyId },
        order: [['name', 'ASC']],
        limit: perPage, offset,
      });
      res.json(paginated(rows.map(toRoleDto), { page, perPage, total: count }));
    } catch (err) { next(err); }
  },
  getById: async (req, res, next) => {
    try {
      const r = await req.scope(Role).findByPk(req.params.id);
      if (!r) return next(AppError.notFound('Role'));
      res.json(toRoleDto(r));
    } catch (err) { next(err); }
  },
  create: async (req, res, next) => {
    try {
      const r = await req.scope(Role).create(req.body);
      res.status(201).json(toRoleDto(r));
    } catch (err) {
      if (err?.name === 'SequelizeUniqueConstraintError') {
        return next(AppError.conflict('ROLE_NAME_TAKEN', 'A role with that name already exists.'));
      }
      next(err);
    }
  },
  update: async (req, res, next) => {
    try {
      const r = await req.scope(Role).findByPk(req.params.id);
      if (!r) return next(AppError.notFound('Role'));
      await r.update(req.body);
      res.json(toRoleDto(r));
    } catch (err) { next(err); }
  },
  remove: async (req, res, next) => {
    try {
      const r = await req.scope(Role).findByPk(req.params.id);
      if (!r) return next(AppError.notFound('Role'));
      await r.destroy();
      res.json({ ok: true });
    } catch (err) { next(err); }
  },
};

module.exports = roleController;
```

- [ ] **Step 2: Replace `api/routes/roleRoutes.js`**

```javascript
const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const requireTenant = require('../middleware/requireTenant');
const validate = require('../middleware/validate');
const { idParam, roleBody, pageQuery } = require('../validators/resourceValidators');
const controller = require('../controllers/roleController');

router.use(requireAuth, requireTenant);

router.get('/', validate({ query: pageQuery }), controller.list);
router.get('/:id', validate({ params: idParam }), controller.getById);
router.post('/', requireRole('admin'), validate({ body: roleBody }), controller.create);
router.patch('/:id', requireRole('admin'), validate({ params: idParam, body: roleBody.partial() }), controller.update);
router.delete('/:id', requireRole('admin'), validate({ params: idParam }), controller.remove);

module.exports = router;
```

- [ ] **Step 3: Smoke test**

```bash
curl -s -b /tmp/sp-cookies-login.txt -X POST http://localhost:3000/api/roles \
  -H 'Content-Type: application/json' \
  -d '{"name":"Senior Dev","color":"#f9ac1b"}'
# expect: 201 { id, name: "Senior Dev", color: "#f9ac1b", ... }
curl -s -b /tmp/sp-cookies-login.txt http://localhost:3000/api/roles
# expect: 200 with data array
```

---

## Task 5: Employees controller (CRUD + roles assignment)

**Files:**
- Modify: `api/controllers/employeeController.js` (full rewrite)
- Modify: `api/routes/employeeRoutes.js` (full rewrite)

- [ ] **Step 1: Replace `api/controllers/employeeController.js`**

```javascript
const { Op } = require('sequelize');
const { Employee, Department, Role, Team, Task, Attendance, LeaveRequest } = require('../association');
const { toEmployeeDto, paginated, parsePageQuery, toTaskDto, toAttendanceDto, toLeaveRequestDto } = require('../utils/serializer');
const AppError = require('../utils/AppError');

async function loadWithRelations(employee, companyId) {
  return Employee.findOne({
    where: { employee_id: employee.employee_id, company_id: companyId },
    include: [
      { model: Department },
      { model: Role, as: 'roles', through: { attributes: [] } },
      { model: Team, as: 'leadTeams', attributes: ['team_id', 'name'] },
    ],
  });
}

const employeeController = {
  list: async (req, res, next) => {
    try {
      const { page, perPage, offset } = parsePageQuery(req.query);
      const where = { company_id: req.user.companyId };
      if (req.query.departmentId) where.department_id = Number(req.query.departmentId);
      if (req.query.status) where.status = req.query.status;
      if (req.query.q) {
        where[Op.or] = [{ name: { [Op.iLike]: `%${req.query.q}%` } }, { email: { [Op.iLike]: `%${req.query.q}%` } }];
      }
      const { rows, count } = await Employee.findAndCountAll({
        where,
        include: [{ model: Department }, { model: Role, as: 'roles', through: { attributes: [] } }, { model: Team, as: 'leadTeams', attributes: ['team_id', 'name'] }],
        order: [['name', 'ASC']],
        limit: perPage, offset, distinct: true,
      });
      const data = rows.map((e) => toEmployeeDto(e, {
        teamsLed: e.leadTeams?.map((t) => ({ id: t.team_id, name: t.name })) || [],
      }));
      res.json(paginated(data, { page, perPage, total: count }));
    } catch (err) { next(err); }
  },

  getById: async (req, res, next) => {
    try {
      const e = await req.scope(Employee).findByPk(req.params.id, {
        include: [{ model: Department }, { model: Role, as: 'roles', through: { attributes: [] } }, { model: Team, as: 'leadTeams', attributes: ['team_id', 'name'] }],
      });
      if (!e) return next(AppError.notFound('Employee'));
      res.json(toEmployeeDto(e, {
        teamsLed: e.leadTeams?.map((t) => ({ id: t.team_id, name: t.name })) || [],
      }));
    } catch (err) { next(err); }
  },

  create: async (req, res, next) => {
    try {
      const dbBody = {
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
        employee_code: req.body.employeeCode,
        department_id: req.body.departmentId,
        manager_id: req.body.managerId,
        hire_date: req.body.hireDate,
        status: req.body.status || 'active',
      };
      const created = await req.scope(Employee).create(dbBody);
      const e = await loadWithRelations(created, req.user.companyId);
      res.status(201).json(toEmployeeDto(e));
    } catch (err) {
      if (err?.name === 'SequelizeUniqueConstraintError') {
        return next(AppError.conflict('EMPLOYEE_EMAIL_TAKEN', 'An employee with that email already exists in this company.'));
      }
      next(err);
    }
  },

  update: async (req, res, next) => {
    try {
      const e = await req.scope(Employee).findByPk(req.params.id);
      if (!e) return next(AppError.notFound('Employee'));
      const dbBody = {};
      if (req.body.name !== undefined) dbBody.name = req.body.name;
      if (req.body.email !== undefined) dbBody.email = req.body.email;
      if (req.body.phone !== undefined) dbBody.phone = req.body.phone;
      if (req.body.employeeCode !== undefined) dbBody.employee_code = req.body.employeeCode;
      if (req.body.departmentId !== undefined) dbBody.department_id = req.body.departmentId;
      if (req.body.managerId !== undefined) dbBody.manager_id = req.body.managerId;
      if (req.body.hireDate !== undefined) dbBody.hire_date = req.body.hireDate;
      if (req.body.status !== undefined) dbBody.status = req.body.status;
      await e.update(dbBody);
      const full = await loadWithRelations(e, req.user.companyId);
      res.json(toEmployeeDto(full));
    } catch (err) { next(err); }
  },

  remove: async (req, res, next) => {
    try {
      const e = await req.scope(Employee).findByPk(req.params.id);
      if (!e) return next(AppError.notFound('Employee'));
      await e.update({ status: 'terminated', termination_date: new Date().toISOString().slice(0, 10) });
      res.json({ ok: true });
    } catch (err) { next(err); }
  },

  assignRoles: async (req, res, next) => {
    try {
      const e = await req.scope(Employee).findByPk(req.params.id);
      if (!e) return next(AppError.notFound('Employee'));
      const roles = await Role.findAll({ where: { company_id: req.user.companyId, role_id: req.body.roleIds } });
      if (roles.length !== req.body.roleIds.length) {
        return next(AppError.badRequest('One or more role ids are invalid.'));
      }
      await e.setRoles(roles);
      const full = await loadWithRelations(e, req.user.companyId);
      res.json(toEmployeeDto(full));
    } catch (err) { next(err); }
  },

  removeRole: async (req, res, next) => {
    try {
      const e = await req.scope(Employee).findByPk(req.params.id);
      if (!e) return next(AppError.notFound('Employee'));
      const role = await Role.findOne({ where: { company_id: req.user.companyId, role_id: req.params.roleId } });
      if (!role) return next(AppError.notFound('Role'));
      await e.removeRole(role);
      res.json({ ok: true });
    } catch (err) { next(err); }
  },

  listTasks: async (req, res, next) => {
    try {
      const e = await req.scope(Employee).findByPk(req.params.id);
      if (!e) return next(AppError.notFound('Employee'));
      const tasks = await req.scope(Task).findAll({ where: { assigned_to: e.employee_id }, order: [['updatedAt', 'DESC']] });
      res.json({ data: tasks.map(toTaskDto) });
    } catch (err) { next(err); }
  },

  listAttendance: async (req, res, next) => {
    try {
      const e = await req.scope(Employee).findByPk(req.params.id);
      if (!e) return next(AppError.notFound('Employee'));
      const where = { employee_id: e.employee_id, company_id: req.user.companyId };
      if (req.query.year && req.query.month) {
        const yyyy = String(req.query.year);
        const mm = String(req.query.month).padStart(2, '0');
        const start = `${yyyy}-${mm}-01`;
        const endDate = new Date(Number(yyyy), Number(req.query.month), 1);
        const end = endDate.toISOString().slice(0, 10);
        where.logged_date = { [Op.gte]: start, [Op.lt]: end };
      }
      const rows = await Attendance.findAll({ where, order: [['logged_date', 'ASC']] });
      res.json({ data: rows.map(toAttendanceDto) });
    } catch (err) { next(err); }
  },

  listLeaves: async (req, res, next) => {
    try {
      const e = await req.scope(Employee).findByPk(req.params.id);
      if (!e) return next(AppError.notFound('Employee'));
      const rows = await LeaveRequest.findAll({
        where: { employee_id: e.employee_id, company_id: req.user.companyId },
        order: [['created_at', 'DESC']],
      });
      res.json({ data: rows.map(toLeaveRequestDto) });
    } catch (err) { next(err); }
  },
};

module.exports = employeeController;
```

- [ ] **Step 2: Replace `api/routes/employeeRoutes.js`**

```javascript
const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const requireTenant = require('../middleware/requireTenant');
const validate = require('../middleware/validate');
const { z } = require('zod');
const { idParam, employeeBody, employeeListQuery, assignRolesBody } = require('../validators/resourceValidators');
const controller = require('../controllers/employeeController');

router.use(requireAuth, requireTenant);

router.get('/', validate({ query: employeeListQuery }), controller.list);
router.get('/:id', validate({ params: idParam }), controller.getById);
router.post('/', requireRole('admin'), validate({ body: employeeBody }), controller.create);
router.patch('/:id', requireRole('admin'), validate({ params: idParam, body: employeeBody.partial() }), controller.update);
router.delete('/:id', requireRole('admin'), validate({ params: idParam }), controller.remove);

router.post('/:id/roles', requireRole('admin'), validate({ params: idParam, body: assignRolesBody }), controller.assignRoles);
router.delete('/:id/roles/:roleId',
  requireRole('admin'),
  validate({ params: z.object({ id: z.coerce.number().int().positive(), roleId: z.coerce.number().int().positive() }) }),
  controller.removeRole,
);

router.get('/:id/tasks', validate({ params: idParam }), controller.listTasks);
router.get('/:id/attendance', validate({ params: idParam, query: z.object({ year: z.coerce.number().int().optional(), month: z.coerce.number().int().optional() }) }), controller.listAttendance);
router.get('/:id/leaves', validate({ params: idParam }), controller.listLeaves);

module.exports = router;
```

- [ ] **Step 3: Smoke test (with server running)**

```bash
# create
curl -s -b /tmp/sp-cookies-login.txt -X POST http://localhost:3000/api/employees \
  -H 'Content-Type: application/json' \
  -d '{"name":"Maya Krishnan","email":"maya@squarefeet.com","phone":"+91 98765 43210","employeeCode":"EMP-0002","hireDate":"2023-03-01","status":"active"}'
# expect: 201, employee DTO with id

# list
curl -s -b /tmp/sp-cookies-login.txt 'http://localhost:3000/api/employees?perPage=10'
# expect: 200 with data array (Desmond + Maya at minimum)

# assign roles (uses the role created in Task 4)
# get role id
ROLE_ID=$(curl -s -b /tmp/sp-cookies-login.txt http://localhost:3000/api/roles | node -e "let s=''; process.stdin.on('data',c=>s+=c); process.stdin.on('end',()=>{const r=JSON.parse(s).data[0]; console.log(r.id)})")
# assign
curl -s -b /tmp/sp-cookies-login.txt -X POST "http://localhost:3000/api/employees/2/roles" \
  -H 'Content-Type: application/json' \
  -d "{\"roleIds\":[$ROLE_ID]}"
# expect: 200 employee DTO with roles: [{id, name: "Senior Dev", color: ...}]
```

---

## Task 6: Teams controller + routes (with members M:N)

**Files:**
- Modify: `api/controllers/teamController.js` (full rewrite)
- Modify: `api/routes/teamRoutes.js` (full rewrite)

- [ ] **Step 1: Replace `api/controllers/teamController.js`**

```javascript
const { Team, Employee, Project, TeamMember } = require('../association');
const { toTeamDto, toEmployeeDto, paginated, parsePageQuery } = require('../utils/serializer');
const AppError = require('../utils/AppError');

async function withCounts(team) {
  const memberCount = await TeamMember.count({ where: { team_id: team.team_id } });
  const projects = await team.getProjects({ attributes: ['project_id', 'name', 'status'] });
  const activeProjectCount = projects.filter((p) => p.status !== 'completed').length;
  return toTeamDto(team, { memberCount, activeProjectCount });
}

const teamController = {
  list: async (req, res, next) => {
    try {
      const { page, perPage, offset } = parsePageQuery(req.query);
      const { rows, count } = await Team.findAndCountAll({
        where: { company_id: req.user.companyId },
        include: [{ model: Employee, as: 'leader', attributes: ['employee_id', 'name'] }],
        order: [['name', 'ASC']],
        limit: perPage, offset,
      });
      const data = await Promise.all(rows.map(withCounts));
      res.json(paginated(data, { page, perPage, total: count }));
    } catch (err) { next(err); }
  },

  getById: async (req, res, next) => {
    try {
      const t = await req.scope(Team).findByPk(req.params.id, {
        include: [
          { model: Employee, as: 'leader', attributes: ['employee_id', 'name'] },
          { model: Employee, as: 'members', through: { attributes: [] } },
          { model: Project, as: 'projects', through: { attributes: [] }, attributes: ['project_id', 'name', 'status'] },
        ],
      });
      if (!t) return next(AppError.notFound('Team'));
      res.json(toTeamDto(t, {
        members: t.members?.map((m) => ({ id: m.employee_id, name: m.name })) || [],
        projects: t.projects?.map((p) => ({ id: p.project_id, name: p.name, status: p.status })) || [],
      }));
    } catch (err) { next(err); }
  },

  create: async (req, res, next) => {
    try {
      const dbBody = {
        name: req.body.name,
        description: req.body.description,
        lead_employee_id: req.body.leadEmployeeId,
      };
      const t = await req.scope(Team).create(dbBody);
      res.status(201).json(toTeamDto(t, { memberCount: 0, activeProjectCount: 0 }));
    } catch (err) { next(err); }
  },

  update: async (req, res, next) => {
    try {
      const t = await req.scope(Team).findByPk(req.params.id);
      if (!t) return next(AppError.notFound('Team'));
      const dbBody = {};
      if (req.body.name !== undefined) dbBody.name = req.body.name;
      if (req.body.description !== undefined) dbBody.description = req.body.description;
      if (req.body.leadEmployeeId !== undefined) dbBody.lead_employee_id = req.body.leadEmployeeId;
      await t.update(dbBody);
      res.json(await withCounts(t));
    } catch (err) { next(err); }
  },

  remove: async (req, res, next) => {
    try {
      const t = await req.scope(Team).findByPk(req.params.id);
      if (!t) return next(AppError.notFound('Team'));
      await t.destroy();
      res.json({ ok: true });
    } catch (err) { next(err); }
  },

  setMembers: async (req, res, next) => {
    try {
      const t = await req.scope(Team).findByPk(req.params.id);
      if (!t) return next(AppError.notFound('Team'));
      const emps = await Employee.findAll({ where: { company_id: req.user.companyId, employee_id: req.body.employeeIds } });
      if (emps.length !== req.body.employeeIds.length) {
        return next(AppError.badRequest('One or more employee ids are invalid.'));
      }
      // Replace the join rows. Use the through model so company_id is set.
      await TeamMember.destroy({ where: { team_id: t.team_id } });
      await TeamMember.bulkCreate(emps.map((e) => ({
        team_id: t.team_id, employee_id: e.employee_id, company_id: req.user.companyId,
      })));
      res.json(await withCounts(t));
    } catch (err) { next(err); }
  },

  removeMember: async (req, res, next) => {
    try {
      const t = await req.scope(Team).findByPk(req.params.id);
      if (!t) return next(AppError.notFound('Team'));
      await TeamMember.destroy({ where: { team_id: t.team_id, employee_id: req.params.employeeId } });
      res.json({ ok: true });
    } catch (err) { next(err); }
  },
};

module.exports = teamController;
```

- [ ] **Step 2: Replace `api/routes/teamRoutes.js`**

```javascript
const express = require('express');
const router = express.Router();
const { z } = require('zod');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const requireTenant = require('../middleware/requireTenant');
const validate = require('../middleware/validate');
const { idParam, teamBody, assignTeamMembersBody, pageQuery } = require('../validators/resourceValidators');
const controller = require('../controllers/teamController');

router.use(requireAuth, requireTenant);

router.get('/', validate({ query: pageQuery }), controller.list);
router.get('/:id', validate({ params: idParam }), controller.getById);
router.post('/', requireRole('admin'), validate({ body: teamBody }), controller.create);
router.patch('/:id', requireRole('admin'), validate({ params: idParam, body: teamBody.partial() }), controller.update);
router.delete('/:id', requireRole('admin'), validate({ params: idParam }), controller.remove);

router.post('/:id/members', requireRole('admin'), validate({ params: idParam, body: assignTeamMembersBody }), controller.setMembers);
router.delete('/:id/members/:employeeId',
  requireRole('admin'),
  validate({ params: z.object({ id: z.coerce.number().int().positive(), employeeId: z.coerce.number().int().positive() }) }),
  controller.removeMember,
);

module.exports = router;
```

- [ ] **Step 3: Smoke test**

```bash
# create
curl -s -b /tmp/sp-cookies-login.txt -X POST http://localhost:3000/api/teams \
  -H 'Content-Type: application/json' \
  -d '{"name":"Frontend Team","description":"Owns customer-facing apps","leadEmployeeId":2}'
# expect: 201 with team DTO

# add members
curl -s -b /tmp/sp-cookies-login.txt -X POST http://localhost:3000/api/teams/1/members \
  -H 'Content-Type: application/json' \
  -d '{"employeeIds":[1,2]}'
# expect: 200 with memberCount: 2

# detail
curl -s -b /tmp/sp-cookies-login.txt http://localhost:3000/api/teams/1
# expect: 200 with members: [...]
```

---

## Task 7: Projects controller + routes (with teams M:N)

**Files:**
- Modify: `api/controllers/projectController.js` (full rewrite)
- Modify: `api/routes/projectRoutes.js` (full rewrite)

- [ ] **Step 1: Replace `api/controllers/projectController.js`**

```javascript
const { Project, Team, Task } = require('../association');
const { toProjectDto, paginated, parsePageQuery } = require('../utils/serializer');
const AppError = require('../utils/AppError');

async function withTasksMeta(project) {
  const tasksTotal = await Task.count({ where: { project_id: project.project_id } });
  const tasksDone = await Task.count({ where: { project_id: project.project_id, status: 'completed' } });
  const progress = tasksTotal > 0 ? tasksDone / tasksTotal : 0;
  return toProjectDto(project, { tasksTotal, tasksDone, progress });
}

const projectController = {
  list: async (req, res, next) => {
    try {
      const { page, perPage, offset } = parsePageQuery(req.query);
      const { rows, count } = await Project.findAndCountAll({
        where: { company_id: req.user.companyId },
        include: [{ model: Team, as: 'teams', through: { attributes: [] }, attributes: ['team_id', 'name'] }],
        order: [['name', 'ASC']],
        limit: perPage, offset, distinct: true,
      });
      const data = await Promise.all(rows.map(withTasksMeta));
      res.json(paginated(data, { page, perPage, total: count }));
    } catch (err) { next(err); }
  },

  getById: async (req, res, next) => {
    try {
      const p = await req.scope(Project).findByPk(req.params.id, {
        include: [{ model: Team, as: 'teams', through: { attributes: [] } }, { model: Task }],
      });
      if (!p) return next(AppError.notFound('Project'));
      res.json(await withTasksMeta(p));
    } catch (err) { next(err); }
  },

  create: async (req, res, next) => {
    try {
      const dbBody = {
        name: req.body.name,
        description: req.body.description,
        status: req.body.status || 'in-progress',
        start_date: req.body.startDate,
        end_date: req.body.endDate,
        due_date: req.body.dueDate,
      };
      const p = await req.scope(Project).create(dbBody);
      res.status(201).json(toProjectDto(p, { tasksTotal: 0, tasksDone: 0, progress: 0, teams: [] }));
    } catch (err) { next(err); }
  },

  update: async (req, res, next) => {
    try {
      const p = await req.scope(Project).findByPk(req.params.id);
      if (!p) return next(AppError.notFound('Project'));
      const dbBody = {};
      if (req.body.name !== undefined) dbBody.name = req.body.name;
      if (req.body.description !== undefined) dbBody.description = req.body.description;
      if (req.body.status !== undefined) dbBody.status = req.body.status;
      if (req.body.startDate !== undefined) dbBody.start_date = req.body.startDate;
      if (req.body.endDate !== undefined) dbBody.end_date = req.body.endDate;
      if (req.body.dueDate !== undefined) dbBody.due_date = req.body.dueDate;
      await p.update(dbBody);
      res.json(await withTasksMeta(p));
    } catch (err) { next(err); }
  },

  remove: async (req, res, next) => {
    try {
      const p = await req.scope(Project).findByPk(req.params.id);
      if (!p) return next(AppError.notFound('Project'));
      await p.destroy();
      res.json({ ok: true });
    } catch (err) { next(err); }
  },

  setTeams: async (req, res, next) => {
    try {
      const p = await req.scope(Project).findByPk(req.params.id);
      if (!p) return next(AppError.notFound('Project'));
      const teams = await Team.findAll({ where: { company_id: req.user.companyId, team_id: req.body.teamIds } });
      if (teams.length !== req.body.teamIds.length) {
        return next(AppError.badRequest('One or more team ids are invalid.'));
      }
      await p.setTeams(teams);
      res.json(await withTasksMeta(p));
    } catch (err) { next(err); }
  },

  removeTeam: async (req, res, next) => {
    try {
      const p = await req.scope(Project).findByPk(req.params.id);
      if (!p) return next(AppError.notFound('Project'));
      const team = await Team.findOne({ where: { company_id: req.user.companyId, team_id: req.params.teamId } });
      if (!team) return next(AppError.notFound('Team'));
      await p.removeTeam(team);
      res.json({ ok: true });
    } catch (err) { next(err); }
  },
};

module.exports = projectController;
```

- [ ] **Step 2: Replace `api/routes/projectRoutes.js`**

```javascript
const express = require('express');
const router = express.Router();
const { z } = require('zod');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const requireTenant = require('../middleware/requireTenant');
const validate = require('../middleware/validate');
const { idParam, projectBody, assignProjectTeamsBody, pageQuery } = require('../validators/resourceValidators');
const controller = require('../controllers/projectController');

router.use(requireAuth, requireTenant);

router.get('/', validate({ query: pageQuery }), controller.list);
router.get('/:id', validate({ params: idParam }), controller.getById);
router.post('/', requireRole('manager'), validate({ body: projectBody }), controller.create);
router.patch('/:id', requireRole('manager'), validate({ params: idParam, body: projectBody.partial() }), controller.update);
router.delete('/:id', requireRole('admin'), validate({ params: idParam }), controller.remove);

router.post('/:id/teams', requireRole('admin'), validate({ params: idParam, body: assignProjectTeamsBody }), controller.setTeams);
router.delete('/:id/teams/:teamId',
  requireRole('admin'),
  validate({ params: z.object({ id: z.coerce.number().int().positive(), teamId: z.coerce.number().int().positive() }) }),
  controller.removeTeam,
);

module.exports = router;
```

- [ ] **Step 3: Smoke test**

```bash
curl -s -b /tmp/sp-cookies-login.txt -X POST http://localhost:3000/api/projects \
  -H 'Content-Type: application/json' \
  -d '{"name":"Mobile redesign","description":"Q2 launch","status":"in-progress","dueDate":"2026-06-30"}'
# expect: 201 with project DTO

curl -s -b /tmp/sp-cookies-login.txt -X POST http://localhost:3000/api/projects/1/teams \
  -H 'Content-Type: application/json' \
  -d '{"teamIds":[1]}'
# expect: 200 with teams: [{id:1, name:"Frontend Team"}]
```

---

## Task 8: Tasks controller — CRUD + list + Kanban shape

**Files:**
- Modify: `api/controllers/taskController.js` (full rewrite — but `/move` comes in Task 9)
- Modify: `api/routes/taskRoutes.js` (full rewrite)

- [ ] **Step 1: Replace `api/controllers/taskController.js`**

```javascript
const { Op } = require('sequelize');
const { Task, Subtask, Employee, Project } = require('../association');
const { toTaskDto, paginated, parsePageQuery, STATUS_DTO_TO_DB } = require('../utils/serializer');
const AppError = require('../utils/AppError');

async function nextCode(companyId) {
  // Simple counter: count existing + 1 (acceptable for v1; tighten with a sequence in Plan 4).
  const n = await Task.count({ where: { company_id: companyId } });
  return `#${100 + n + 1}`;
}

async function nextPosition(projectId, status) {
  const max = await Task.max('position', { where: { project_id: projectId, status } });
  return (Number.isFinite(max) ? max : -1) + 1;
}

const taskController = {
  list: async (req, res, next) => {
    try {
      const { page, perPage, offset } = parsePageQuery(req.query);
      const where = { company_id: req.user.companyId };
      if (req.query.projectId) where.project_id = Number(req.query.projectId);
      if (req.query.assigneeId) where.assigned_to = Number(req.query.assigneeId);
      if (req.query.status) where.status = STATUS_DTO_TO_DB[req.query.status] || req.query.status;
      if (req.query.priority) where.priority = req.query.priority;
      if (req.query.q) where.title = { [Op.iLike]: `%${req.query.q}%` };
      const { rows, count } = await Task.findAndCountAll({
        where,
        include: [{ model: Employee, as: 'assignee', attributes: ['employee_id', 'name'] }, { model: Project, attributes: ['project_id', 'name'] }],
        order: [['updatedAt', 'DESC']],
        limit: perPage, offset,
      });
      res.json(paginated(rows.map(toTaskDto), { page, perPage, total: count }));
    } catch (err) { next(err); }
  },

  kanban: async (req, res, next) => {
    try {
      const where = { company_id: req.user.companyId };
      if (req.query.projectId) where.project_id = Number(req.query.projectId);
      const rows = await Task.findAll({
        where,
        include: [{ model: Employee, as: 'assignee', attributes: ['employee_id', 'name'] }, { model: Project, attributes: ['project_id', 'name'] }],
        order: [['status', 'ASC'], ['position', 'ASC']],
      });
      const columns = { pending: [], inProgress: [], completed: [] };
      for (const t of rows) {
        const key = t.status === 'in_progress' ? 'inProgress' : t.status;
        columns[key].push(toTaskDto(t));
      }
      res.json(columns);
    } catch (err) { next(err); }
  },

  getById: async (req, res, next) => {
    try {
      const t = await req.scope(Task).findByPk(req.params.id, {
        include: [{ model: Employee, as: 'assignee' }, { model: Project }, { model: Subtask }],
      });
      if (!t) return next(AppError.notFound('Task'));
      res.json(toTaskDto(t, { subtasks: t.Subtasks?.map((s) => ({ id: s.subtask_id, title: s.title, status: s.status, position: s.position })) || [] }));
    } catch (err) { next(err); }
  },

  create: async (req, res, next) => {
    try {
      // Verify project belongs to tenant
      const project = await Project.findOne({ where: { project_id: req.body.projectId, company_id: req.user.companyId } });
      if (!project) return next(AppError.notFound('Project'));
      const status = STATUS_DTO_TO_DB[req.body.status || 'pending'] || 'pending';
      const dbBody = {
        title: req.body.title,
        description: req.body.description,
        project_id: req.body.projectId,
        assigned_to: req.body.assigneeId ?? null,
        priority: req.body.priority || 'medium',
        status,
        code: await nextCode(req.user.companyId),
        position: await nextPosition(req.body.projectId, status),
      };
      const t = await req.scope(Task).create(dbBody);
      res.status(201).json(toTaskDto(t));
    } catch (err) { next(err); }
  },

  update: async (req, res, next) => {
    try {
      const t = await req.scope(Task).findByPk(req.params.id);
      if (!t) return next(AppError.notFound('Task'));
      const dbBody = {};
      if (req.body.title !== undefined) dbBody.title = req.body.title;
      if (req.body.description !== undefined) dbBody.description = req.body.description;
      if (req.body.assigneeId !== undefined) dbBody.assigned_to = req.body.assigneeId;
      if (req.body.priority !== undefined) dbBody.priority = req.body.priority;
      if (req.body.status !== undefined) dbBody.status = STATUS_DTO_TO_DB[req.body.status] || req.body.status;
      // projectId changes are unusual; allow it but recompute position
      if (req.body.projectId !== undefined && req.body.projectId !== t.project_id) {
        dbBody.project_id = req.body.projectId;
        dbBody.position = await nextPosition(req.body.projectId, dbBody.status || t.status);
      }
      await t.update(dbBody);
      res.json(toTaskDto(t));
    } catch (err) { next(err); }
  },

  remove: async (req, res, next) => {
    try {
      const t = await req.scope(Task).findByPk(req.params.id);
      if (!t) return next(AppError.notFound('Task'));
      await t.destroy();
      res.json({ ok: true });
    } catch (err) { next(err); }
  },
};

module.exports = taskController;
```

- [ ] **Step 2: Replace `api/routes/taskRoutes.js`**

```javascript
const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const requireTenant = require('../middleware/requireTenant');
const validate = require('../middleware/validate');
const { idParam, taskBody, taskUpdateBody, taskListQuery, taskKanbanQuery } = require('../validators/resourceValidators');
const controller = require('../controllers/taskController');

router.use(requireAuth, requireTenant);

router.get('/kanban', validate({ query: taskKanbanQuery }), controller.kanban);
router.get('/', validate({ query: taskListQuery }), controller.list);
router.get('/:id', validate({ params: idParam }), controller.getById);
router.post('/', validate({ body: taskBody }), controller.create);
router.patch('/:id', validate({ params: idParam, body: taskUpdateBody }), controller.update);
router.delete('/:id', validate({ params: idParam }), controller.remove);

module.exports = router;
```

- [ ] **Step 3: Smoke test**

```bash
# create
curl -s -b /tmp/sp-cookies-login.txt -X POST http://localhost:3000/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{"projectId":1,"title":"Wire auth middleware","priority":"high","assigneeId":2}'
# expect: 201 with task DTO; code like "#101"

# kanban
curl -s -b /tmp/sp-cookies-login.txt 'http://localhost:3000/api/tasks/kanban?projectId=1'
# expect: 200 { pending: [...], inProgress: [], completed: [] }
```

---

## Task 9: `POST /api/tasks/:id/move` (Kanban drag-drop)

**Files:**
- Modify: `api/controllers/taskController.js` (add `move` method)
- Modify: `api/routes/taskRoutes.js` (add `/:id/move`)

- [ ] **Step 1: Add `move` to `taskController`**

Append to the `taskController` object:

```javascript
  move: async (req, res, next) => {
    const sequelize = require('../config/database');
    const { STATUS_DTO_TO_DB } = require('../utils/serializer');
    const { toColumn, toIndex } = req.body;
    const targetStatus = STATUS_DTO_TO_DB[toColumn];
    try {
      const result = await sequelize.transaction(async (tx) => {
        const task = await Task.findOne({
          where: { task_id: req.params.id, company_id: req.user.companyId },
          transaction: tx,
        });
        if (!task) throw AppError.notFound('Task');

        const fromStatus = task.status;
        const projectId = task.project_id;

        // 1. Open a gap in destination at toIndex.
        const destSiblings = await Task.findAll({
          where: { project_id: projectId, company_id: req.user.companyId, status: targetStatus, task_id: { [require('sequelize').Op.ne]: task.task_id } },
          order: [['position', 'ASC']],
          transaction: tx, lock: true,
        });
        // Compute new positions: 0..toIndex-1 keep, then task slot, then rest shifted by 1.
        const clampedIndex = Math.min(toIndex, destSiblings.length);

        // 2. Close gap in source (only matters if same column or task is leaving the column).
        if (fromStatus !== targetStatus) {
          const sourceSiblings = await Task.findAll({
            where: { project_id: projectId, company_id: req.user.companyId, status: fromStatus, task_id: { [require('sequelize').Op.ne]: task.task_id } },
            order: [['position', 'ASC']],
            transaction: tx, lock: true,
          });
          for (let i = 0; i < sourceSiblings.length; i++) {
            await sourceSiblings[i].update({ position: i }, { transaction: tx });
          }
        }

        // Renumber destSiblings, inserting task at clampedIndex
        for (let i = 0, write = 0; i < destSiblings.length + 1; i++) {
          if (i === clampedIndex) {
            await task.update({ status: targetStatus, position: clampedIndex }, { transaction: tx });
            continue;
          }
          const idx = write < clampedIndex ? write : write + 1;
          if (write < destSiblings.length) {
            await destSiblings[write].update({ position: idx }, { transaction: tx });
            write++;
          }
        }

        // Refresh
        await task.reload({ transaction: tx });
        return task;
      });

      res.json({ ok: true, task: { id: result.task_id, status: toColumn, position: result.position } });
    } catch (err) {
      if (err instanceof AppError) return next(err);
      next(err);
    }
  },
```

- [ ] **Step 2: Add the route to `taskRoutes.js`**

In the imports of `taskRoutes.js`, add `taskMoveBody` to the destructure:

```javascript
const { idParam, taskBody, taskUpdateBody, taskListQuery, taskKanbanQuery, taskMoveBody } = require('../validators/resourceValidators');
```

Add the route (above `module.exports`):

```javascript
router.post('/:id/move', validate({ params: idParam, body: taskMoveBody }), controller.move);
```

- [ ] **Step 3: Smoke test**

Boot. Use the task created in Task 8:

```bash
# Move task 1 from pending → inProgress at position 0
curl -s -b /tmp/sp-cookies-login.txt -X POST http://localhost:3000/api/tasks/1/move \
  -H 'Content-Type: application/json' \
  -d '{"toColumn":"inProgress","toIndex":0}'
# expect: 200 { ok: true, task: { id:1, status:"in_progress", position:0 } } (or "inProgress" — verify both DB and DTO consistency)

# Re-fetch kanban
curl -s -b /tmp/sp-cookies-login.txt 'http://localhost:3000/api/tasks/kanban?projectId=1'
# expect: task 1 now in inProgress column at index 0
```

---

## Task 10: Subtasks controller + routes

**Files:**
- Create: route module if not present
- Modify: `api/controllers/subtaskController.js` (full rewrite)
- Modify: `api/routes/subtaskRoute.js` (full rewrite)

- [ ] **Step 1: Replace `api/controllers/subtaskController.js`**

```javascript
const { Subtask, Task } = require('../association');
const { toSubtaskDto, STATUS_DTO_TO_DB } = require('../utils/serializer');
const AppError = require('../utils/AppError');

async function assertTaskInTenant(taskId, companyId) {
  const t = await Task.findOne({ where: { task_id: taskId, company_id: companyId } });
  if (!t) throw AppError.notFound('Task');
  return t;
}
async function nextPosition(taskId) {
  const max = await Subtask.max('position', { where: { task_id: taskId } });
  return (Number.isFinite(max) ? max : -1) + 1;
}

const subtaskController = {
  listForTask: async (req, res, next) => {
    try {
      await assertTaskInTenant(req.params.taskId, req.user.companyId);
      const rows = await Subtask.findAll({
        where: { task_id: req.params.taskId, company_id: req.user.companyId },
        order: [['position', 'ASC']],
      });
      res.json({ data: rows.map(toSubtaskDto) });
    } catch (err) { next(err); }
  },
  create: async (req, res, next) => {
    try {
      await assertTaskInTenant(req.params.taskId, req.user.companyId);
      const dbBody = {
        task_id: Number(req.params.taskId),
        company_id: req.user.companyId,
        title: req.body.title,
        description: req.body.description,
        assigned_to: req.body.assigneeId ?? null,
        status: STATUS_DTO_TO_DB[req.body.status || 'pending'] || 'pending',
        deadline: req.body.deadline,
        position: await nextPosition(req.params.taskId),
      };
      const s = await Subtask.create(dbBody);
      res.status(201).json(toSubtaskDto(s));
    } catch (err) { next(err); }
  },
  update: async (req, res, next) => {
    try {
      await assertTaskInTenant(req.params.taskId, req.user.companyId);
      const s = await Subtask.findOne({
        where: { subtask_id: req.params.id, task_id: req.params.taskId, company_id: req.user.companyId },
      });
      if (!s) return next(AppError.notFound('Subtask'));
      const dbBody = {};
      if (req.body.title !== undefined) dbBody.title = req.body.title;
      if (req.body.description !== undefined) dbBody.description = req.body.description;
      if (req.body.assigneeId !== undefined) dbBody.assigned_to = req.body.assigneeId;
      if (req.body.status !== undefined) dbBody.status = STATUS_DTO_TO_DB[req.body.status] || req.body.status;
      if (req.body.deadline !== undefined) dbBody.deadline = req.body.deadline;
      await s.update(dbBody);
      res.json(toSubtaskDto(s));
    } catch (err) { next(err); }
  },
  remove: async (req, res, next) => {
    try {
      const s = await Subtask.findOne({
        where: { subtask_id: req.params.id, task_id: req.params.taskId, company_id: req.user.companyId },
      });
      if (!s) return next(AppError.notFound('Subtask'));
      await s.destroy();
      res.json({ ok: true });
    } catch (err) { next(err); }
  },
};

module.exports = subtaskController;
```

- [ ] **Step 2: Replace `api/routes/subtaskRoute.js`**

```javascript
const express = require('express');
const router = express.Router({ mergeParams: true });
const { z } = require('zod');
const requireAuth = require('../middleware/requireAuth');
const requireTenant = require('../middleware/requireTenant');
const validate = require('../middleware/validate');
const { subtaskBody } = require('../validators/resourceValidators');
const controller = require('../controllers/subtaskController');

const paramsCreate = z.object({ taskId: z.coerce.number().int().positive() });
const paramsItem = z.object({ taskId: z.coerce.number().int().positive(), id: z.coerce.number().int().positive() });

router.use(requireAuth, requireTenant);

router.get('/tasks/:taskId/subtasks', validate({ params: paramsCreate }), controller.listForTask);
router.post('/tasks/:taskId/subtasks', validate({ params: paramsCreate, body: subtaskBody }), controller.create);
router.patch('/tasks/:taskId/subtasks/:id', validate({ params: paramsItem, body: subtaskBody.partial() }), controller.update);
router.delete('/tasks/:taskId/subtasks/:id', validate({ params: paramsItem }), controller.remove);

module.exports = router;
```

- [ ] **Step 3: Update `api/index.js` to mount subtasks at `/api`** (since route paths include `/tasks/:taskId/subtasks`)

Find the line `app.use('/api/subtasks', subtaskRoute);` and replace with:

```javascript
app.use('/api', subtaskRoute);
```

- [ ] **Step 4: Smoke test**

```bash
curl -s -b /tmp/sp-cookies-login.txt -X POST http://localhost:3000/api/tasks/1/subtasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"Wire axios interceptor","status":"pending"}'
# expect: 201 with subtask DTO
curl -s -b /tmp/sp-cookies-login.txt http://localhost:3000/api/tasks/1/subtasks
# expect: 200 { data: [...] }
```

---

## Task 11: WorkTracking (timer) — start / pause / resume / stop

**Files:**
- Modify: `api/controllers/worktrackingController.js` (full rewrite)
- Modify: `api/routes/worktrackingRoutes.js` (full rewrite)

- [ ] **Step 1: Replace `api/controllers/worktrackingController.js`**

```javascript
const { Op } = require('sequelize');
const { WorkTracking, Task } = require('../association');
const { toTimeEntryDto } = require('../utils/serializer');
const AppError = require('../utils/AppError');

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

const worktrackingController = {
  start: async (req, res, next) => {
    try {
      if (!req.user.employeeId) return next(AppError.badRequest('User has no linked employee.'));
      // Auto-stop any running entry for this employee.
      const running = await WorkTracking.findAll({ where: { employee_id: req.user.employeeId, end_time: null } });
      const now = new Date();
      for (const r of running) {
        const duration = Math.round((now - new Date(r.start_time)) / 60000);
        await r.update({ end_time: now, duration_minutes: duration });
      }
      // Confirm task belongs to tenant
      const task = await Task.findOne({ where: { task_id: req.body.taskId, company_id: req.user.companyId } });
      if (!task) return next(AppError.notFound('Task'));
      const entry = await WorkTracking.create({
        company_id: req.user.companyId,
        employee_id: req.user.employeeId,
        task_id: req.body.taskId,
        subtask_id: req.body.subtaskId || null,
        start_time: new Date(),
        end_time: null,
        logged_date: todayDate(),
      });
      res.status(201).json(toTimeEntryDto(entry));
    } catch (err) { next(err); }
  },

  pause: async (req, res, next) => {
    try {
      const entry = await WorkTracking.findOne({
        where: { log_id: req.params.id, employee_id: req.user.employeeId, company_id: req.user.companyId },
      });
      if (!entry) return next(AppError.notFound('Time entry'));
      if (entry.end_time) return next(AppError.badRequest('Entry already stopped.'));
      const end = new Date();
      const duration = Math.round((end - new Date(entry.start_time)) / 60000);
      await entry.update({ end_time: end, duration_minutes: duration });
      res.json(toTimeEntryDto(entry));
    } catch (err) { next(err); }
  },

  resume: async (req, res, next) => {
    try {
      const old = await WorkTracking.findOne({
        where: { log_id: req.params.id, employee_id: req.user.employeeId, company_id: req.user.companyId },
      });
      if (!old) return next(AppError.notFound('Time entry'));
      const entry = await WorkTracking.create({
        company_id: req.user.companyId,
        employee_id: req.user.employeeId,
        task_id: old.task_id,
        subtask_id: old.subtask_id,
        start_time: new Date(),
        end_time: null,
        logged_date: todayDate(),
      });
      res.status(201).json(toTimeEntryDto(entry));
    } catch (err) { next(err); }
  },

  stop: async (req, res, next) => {
    // alias for pause; explicit endpoint for the frontend's stop button
    return worktrackingController.pause(req, res, next);
  },

  entries: async (req, res, next) => {
    try {
      const date = req.query.date || todayDate();
      const rows = await WorkTracking.findAll({
        where: { employee_id: req.user.employeeId, company_id: req.user.companyId, logged_date: date },
        include: [{ model: Task, attributes: ['task_id', 'title'] }],
        order: [['start_time', 'ASC']],
      });
      res.json({ data: rows.map(toTimeEntryDto) });
    } catch (err) { next(err); }
  },

  todayTotal: async (req, res, next) => {
    try {
      const rows = await WorkTracking.findAll({
        where: { employee_id: req.user.employeeId, company_id: req.user.companyId, logged_date: todayDate() },
      });
      const totalSec = rows.reduce((acc, r) => {
        const end = r.end_time ? new Date(r.end_time) : new Date();
        return acc + Math.round((end - new Date(r.start_time)) / 1000);
      }, 0);
      res.json({ totalSec });
    } catch (err) { next(err); }
  },

  weeklyHours: async (req, res, next) => {
    try {
      const weekOf = req.query.weekOf || todayDate();
      // Build Mon..Sun starting from weekOf if it's a Monday, else snap back.
      const d = new Date(weekOf);
      const dayOfWeek = (d.getDay() + 6) % 7; // 0 = Mon
      const monday = new Date(d);
      monday.setDate(d.getDate() - dayOfWeek);
      const days = [];
      for (let i = 0; i < 7; i++) {
        const day = new Date(monday);
        day.setDate(monday.getDate() + i);
        days.push(day.toISOString().slice(0, 10));
      }
      const rows = await WorkTracking.findAll({
        where: {
          employee_id: req.user.employeeId, company_id: req.user.companyId,
          logged_date: { [Op.in]: days },
        },
      });
      const byDay = {};
      for (const day of days) byDay[day] = 0;
      for (const r of rows) {
        const end = r.end_time ? new Date(r.end_time) : new Date();
        byDay[r.logged_date] += Math.round((end - new Date(r.start_time)) / 1000);
      }
      const max = Math.max(1, ...Object.values(byDay));
      const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const data = days.map((day, i) => ({
        day: labels[i],
        date: day,
        sec: byDay[day],
        percent: Math.round((byDay[day] / max) * 100),
      }));
      res.json({ data });
    } catch (err) { next(err); }
  },
};

module.exports = worktrackingController;
```

- [ ] **Step 2: Replace `api/routes/worktrackingRoutes.js`**

```javascript
const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const requireTenant = require('../middleware/requireTenant');
const validate = require('../middleware/validate');
const { idParam, timerStartBody, timeEntriesQuery, weeklyHoursQuery } = require('../validators/resourceValidators');
const controller = require('../controllers/worktrackingController');

router.use(requireAuth, requireTenant);

router.get('/entries', validate({ query: timeEntriesQuery }), controller.entries);
router.get('/today-total', controller.todayTotal);
router.get('/weekly-hours', validate({ query: weeklyHoursQuery }), controller.weeklyHours);

router.post('/start', validate({ body: timerStartBody }), controller.start);
router.post('/:id/pause', validate({ params: idParam }), controller.pause);
router.post('/:id/resume', validate({ params: idParam }), controller.resume);
router.post('/:id/stop', validate({ params: idParam }), controller.stop);

module.exports = router;
```

- [ ] **Step 3: Wire the new path prefix in `api/index.js`**

Replace `app.use('/api/worktracking', worktrackingRoutes);` with:

```javascript
app.use('/api/time', worktrackingRoutes);
```

(Frontend `useTimeEntries.js` / `useTimer.js` call `/api/time/...`.)

- [ ] **Step 4: Smoke test**

```bash
# start
curl -s -b /tmp/sp-cookies-login.txt -X POST http://localhost:3000/api/time/start \
  -H 'Content-Type: application/json' \
  -d '{"taskId":1}'
# expect: 201 with time entry DTO (endedAt: null)

# entries today
curl -s -b /tmp/sp-cookies-login.txt http://localhost:3000/api/time/entries
# expect: 200 { data: [...] }

# today total
curl -s -b /tmp/sp-cookies-login.txt http://localhost:3000/api/time/today-total
# expect: 200 { totalSec: <number> }

# stop the entry (use returned id from start)
curl -s -b /tmp/sp-cookies-login.txt -X POST http://localhost:3000/api/time/1/stop
# expect: 200 with endedAt set, durationSec > 0
```

---

## Task 12: Attendance — sign-in / sign-out / month grid / summary

**Files:**
- Modify: `api/controllers/attendanceController.js` (full rewrite)
- Modify: `api/routes/attendanceRoutes.js` (full rewrite)

- [ ] **Step 1: Replace `api/controllers/attendanceController.js`**

```javascript
const { Op } = require('sequelize');
const { Attendance, Employee } = require('../association');
const { toAttendanceDto } = require('../utils/serializer');
const AppError = require('../utils/AppError');

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

const attendanceController = {
  today: async (req, res, next) => {
    try {
      if (!req.user.employeeId) return next(AppError.badRequest('User has no linked employee.'));
      const row = await Attendance.findOne({
        where: { employee_id: req.user.employeeId, company_id: req.user.companyId, logged_date: todayDate() },
      });
      res.json(row ? toAttendanceDto(row) : { loggedDate: todayDate(), signedInAt: null, signedOutAt: null, status: null });
    } catch (err) { next(err); }
  },

  month: async (req, res, next) => {
    try {
      if (!req.user.employeeId) return next(AppError.badRequest('User has no linked employee.'));
      const { year, month } = req.query;
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = new Date(Number(year), Number(month), 1);
      const end = endDate.toISOString().slice(0, 10);
      const rows = await Attendance.findAll({
        where: {
          employee_id: req.user.employeeId, company_id: req.user.companyId,
          logged_date: { [Op.gte]: start, [Op.lt]: end },
        },
      });
      const result = {};
      for (const r of rows) result[r.logged_date] = r.status;
      res.json(result);
    } catch (err) { next(err); }
  },

  signIn: async (req, res, next) => {
    try {
      if (!req.user.employeeId) return next(AppError.badRequest('User has no linked employee.'));
      const today = todayDate();
      let row = await Attendance.findOne({
        where: { employee_id: req.user.employeeId, company_id: req.user.companyId, logged_date: today },
      });
      const now = new Date();
      // Simple "late" heuristic: after 09:30 local.
      const isLate = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 30);
      const status = isLate ? 'late' : 'present';
      if (row) {
        if (row.signed_in_at) return res.json(toAttendanceDto(row)); // idempotent
        await row.update({ signed_in_at: now, status });
      } else {
        row = await Attendance.create({
          company_id: req.user.companyId,
          employee_id: req.user.employeeId,
          logged_date: today,
          signed_in_at: now,
          status,
        });
      }
      res.json(toAttendanceDto(row));
    } catch (err) { next(err); }
  },

  signOut: async (req, res, next) => {
    try {
      if (!req.user.employeeId) return next(AppError.badRequest('User has no linked employee.'));
      const row = await Attendance.findOne({
        where: { employee_id: req.user.employeeId, company_id: req.user.companyId, logged_date: todayDate() },
      });
      if (!row) return next(AppError.badRequest('No sign-in for today.'));
      await row.update({ signed_out_at: new Date() });
      res.json(toAttendanceDto(row));
    } catch (err) { next(err); }
  },

  summary: async (req, res, next) => {
    try {
      const date = req.query.date || todayDate();
      const total = await Employee.count({ where: { company_id: req.user.companyId, status: 'active' } });
      const present = await Attendance.count({
        where: {
          company_id: req.user.companyId, logged_date: date,
          status: { [Op.in]: ['present', 'late'] },
          signed_in_at: { [Op.ne]: null },
        },
      });
      const percent = total > 0 ? Math.round((present / total) * 100) : 0;
      res.json({ date, totalEmployees: total, presentToday: present, percent });
    } catch (err) { next(err); }
  },
};

module.exports = attendanceController;
```

- [ ] **Step 2: Replace `api/routes/attendanceRoutes.js`**

```javascript
const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const requireTenant = require('../middleware/requireTenant');
const validate = require('../middleware/validate');
const { attendanceMonthQuery, attendanceSummaryQuery } = require('../validators/resourceValidators');
const controller = require('../controllers/attendanceController');

router.use(requireAuth, requireTenant);

router.get('/today', controller.today);
router.get('/month', validate({ query: attendanceMonthQuery }), controller.month);
router.post('/sign-in', controller.signIn);
router.post('/sign-out', controller.signOut);
router.get('/summary', requireRole('manager'), validate({ query: attendanceSummaryQuery }), controller.summary);

module.exports = router;
```

- [ ] **Step 3: Smoke test**

```bash
# sign in
curl -s -b /tmp/sp-cookies-login.txt -X POST http://localhost:3000/api/attendance/sign-in
# expect: 200 attendance DTO with signedInAt: <iso>, status: "present" or "late"

# today
curl -s -b /tmp/sp-cookies-login.txt http://localhost:3000/api/attendance/today
# expect: 200 same data

# month
curl -s -b /tmp/sp-cookies-login.txt 'http://localhost:3000/api/attendance/month?year=2026&month=5'
# expect: 200 { "2026-05-21": "present" } (or "late")

# summary (owner is admin+)
curl -s -b /tmp/sp-cookies-login.txt 'http://localhost:3000/api/attendance/summary'
# expect: 200 { date, totalEmployees, presentToday, percent }

# sign out
curl -s -b /tmp/sp-cookies-login.txt -X POST http://localhost:3000/api/attendance/sign-out
# expect: 200 with signedOutAt set
```

---

## Task 13: Leaves — CRUD (`mine`, `pending`, create, update, cancel)

**Files:**
- Modify: `api/controllers/leaverequestController.js` (full rewrite)
- Modify: `api/routes/leaverequestRoutes.js` (full rewrite)

- [ ] **Step 1: Replace `api/controllers/leaverequestController.js`**

```javascript
const { Op } = require('sequelize');
const { LeaveRequest, Employee } = require('../association');
const { toLeaveRequestDto } = require('../utils/serializer');
const AppError = require('../utils/AppError');

function diffDays(start, end) {
  const a = new Date(start);
  const b = new Date(end);
  return Math.round((b - a) / 86400000) + 1;
}

const leaveController = {
  mine: async (req, res, next) => {
    try {
      if (!req.user.employeeId) return next(AppError.badRequest('User has no linked employee.'));
      const rows = await LeaveRequest.findAll({
        where: { company_id: req.user.companyId, employee_id: req.user.employeeId },
        order: [['created_at', 'DESC']],
      });
      res.json({ data: rows.map(toLeaveRequestDto) });
    } catch (err) { next(err); }
  },

  pending: async (req, res, next) => {
    try {
      // Admin+: see all pending. Manager: see only their team members' pending (deferred until team-membership lookup is needed).
      // For v1: admin+ sees all; manager-only filtering is a Plan 4 concern.
      const rows = await LeaveRequest.findAll({
        where: { company_id: req.user.companyId, status: 'pending' },
        include: [{ model: Employee, as: 'employee' }],
        order: [['created_at', 'DESC']],
      });
      res.json({ data: rows.map(toLeaveRequestDto) });
    } catch (err) { next(err); }
  },

  create: async (req, res, next) => {
    try {
      if (!req.user.employeeId) return next(AppError.badRequest('User has no linked employee.'));
      const { type, startDate, endDate, reason } = req.body;
      if (new Date(endDate) < new Date(startDate)) {
        return next(AppError.badRequest('End date must be on or after start date.'));
      }
      const lr = await LeaveRequest.create({
        company_id: req.user.companyId,
        employee_id: req.user.employeeId,
        leave_type: type,
        start_date: startDate,
        end_date: endDate,
        days: diffDays(startDate, endDate),
        reason: reason || null,
        status: 'pending',
      });

      // Notify manager(s) via the ConsoleMailer for now.
      try {
        const { mailer } = require('../utils/mailer');
        const employee = await Employee.findByPk(req.user.employeeId);
        await mailer.send({
          to: 'manager@example.com', // Plan 4 routes to real manager(s)
          template: 'invite', // reuse generic template; Plan 4 swaps for 'leave-submitted'
          data: { companyName: 'Your workspace', inviterName: employee?.name || 'A team member', acceptUrl: '(see app)' },
        });
      } catch { /* mailer is best-effort here */ }

      res.status(201).json(toLeaveRequestDto(lr));
    } catch (err) { next(err); }
  },

  update: async (req, res, next) => {
    try {
      const lr = await LeaveRequest.findOne({
        where: { leave_id: req.params.id, company_id: req.user.companyId, employee_id: req.user.employeeId },
      });
      if (!lr) return next(AppError.notFound('Leave request'));
      if (lr.status !== 'pending') return next(AppError.businessRule('LEAVE_NOT_EDITABLE', 'Only pending requests can be edited.'));
      const dbBody = {};
      if (req.body.type !== undefined) dbBody.leave_type = req.body.type;
      if (req.body.startDate !== undefined) dbBody.start_date = req.body.startDate;
      if (req.body.endDate !== undefined) dbBody.end_date = req.body.endDate;
      if (req.body.reason !== undefined) dbBody.reason = req.body.reason;
      if (dbBody.start_date || dbBody.end_date) {
        const s = dbBody.start_date || lr.start_date;
        const e = dbBody.end_date || lr.end_date;
        if (new Date(e) < new Date(s)) return next(AppError.badRequest('End date must be on or after start date.'));
        dbBody.days = diffDays(s, e);
      }
      await lr.update(dbBody);
      res.json(toLeaveRequestDto(lr));
    } catch (err) { next(err); }
  },

  cancel: async (req, res, next) => {
    try {
      const lr = await LeaveRequest.findOne({
        where: { leave_id: req.params.id, company_id: req.user.companyId, employee_id: req.user.employeeId },
      });
      if (!lr) return next(AppError.notFound('Leave request'));
      if (lr.status !== 'pending') return next(AppError.businessRule('LEAVE_NOT_CANCELABLE', 'Only pending requests can be cancelled.'));
      await lr.destroy();
      res.json({ ok: true });
    } catch (err) { next(err); }
  },
};

module.exports = leaveController;
```

- [ ] **Step 2: Replace `api/routes/leaverequestRoutes.js`**

```javascript
const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const requireTenant = require('../middleware/requireTenant');
const validate = require('../middleware/validate');
const { idParam, leaveCreateBody } = require('../validators/resourceValidators');
const controller = require('../controllers/leaverequestController');

router.use(requireAuth, requireTenant);

router.get('/mine', controller.mine);
router.get('/pending', requireRole('manager'), controller.pending);
router.post('/', validate({ body: leaveCreateBody }), controller.create);
router.patch('/:id', validate({ params: idParam, body: leaveCreateBody.partial() }), controller.update);
router.delete('/:id', validate({ params: idParam }), controller.cancel);

module.exports = router;
```

- [ ] **Step 3: Wire the route prefix change in `index.js`**

Replace `app.use('/api/leaverequests', leaverequestRoutes);` with:

```javascript
app.use('/api/leaves', leaverequestRoutes);
```

(Frontend `useLeaves.js` calls `/api/leaves/...`.)

- [ ] **Step 4: Smoke test**

```bash
# create
curl -s -b /tmp/sp-cookies-login.txt -X POST http://localhost:3000/api/leaves \
  -H 'Content-Type: application/json' \
  -d '{"type":"annual","startDate":"2026-06-10","endDate":"2026-06-14","reason":"Family event"}'
# expect: 201 with leave DTO (days: 5)

# mine
curl -s -b /tmp/sp-cookies-login.txt http://localhost:3000/api/leaves/mine
# expect: 200 { data: [...] }

# pending (owner = admin+)
curl -s -b /tmp/sp-cookies-login.txt http://localhost:3000/api/leaves/pending
# expect: 200 { data: [...] }
```

---

## Task 14: Leaves — approve / reject (with auto-attendance + email)

**Files:**
- Modify: `api/controllers/leaveapprovalController.js` (full rewrite)
- Modify: `api/routes/leaveapprovalRoutes.js` (full rewrite — move endpoints onto `/api/leaves/:id/{approve,reject}` and mount under the leaves router)
- Modify: `api/routes/leaverequestRoutes.js` (add `/:id/approve` and `/:id/reject` here)
- Modify: `api/index.js` (drop the `/api/leaveapprovals` mount — it's now under `/api/leaves`)

- [ ] **Step 1: Replace `api/controllers/leaveapprovalController.js`**

```javascript
const sequelize = require('../config/database');
const { LeaveRequest, LeaveApproval, Attendance, Employee } = require('../association');
const { toLeaveRequestDto } = require('../utils/serializer');
const AppError = require('../utils/AppError');

function* dateRange(start, end) {
  const d = new Date(start);
  const last = new Date(end);
  while (d <= last) {
    yield d.toISOString().slice(0, 10);
    d.setDate(d.getDate() + 1);
  }
}

const leaveApprovalController = {
  approve: async (req, res, next) => {
    try {
      const result = await sequelize.transaction(async (tx) => {
        const lr = await LeaveRequest.findOne({
          where: { leave_id: req.params.id, company_id: req.user.companyId },
          transaction: tx,
        });
        if (!lr) throw AppError.notFound('Leave request');
        if (lr.status !== 'pending') throw AppError.businessRule('LEAVE_ALREADY_DECIDED', 'Already decided.');
        if (!req.user.employeeId) throw AppError.badRequest('Approver has no linked employee.');

        await LeaveApproval.create({
          company_id: req.user.companyId,
          leave_request_id: lr.leave_id,
          approver_id: req.user.employeeId,
          decision: 'approved',
          reason: null,
          decided_at: new Date(),
        }, { transaction: tx });

        await lr.update({ status: 'approved' }, { transaction: tx });

        // Write attendance rows for every day in the leave range with status 'leave'.
        for (const day of dateRange(lr.start_date, lr.end_date)) {
          const existing = await Attendance.findOne({
            where: { company_id: req.user.companyId, employee_id: lr.employee_id, logged_date: day },
            transaction: tx,
          });
          if (existing) {
            await existing.update({ status: 'leave' }, { transaction: tx });
          } else {
            await Attendance.create({
              company_id: req.user.companyId,
              employee_id: lr.employee_id,
              logged_date: day,
              status: 'leave',
            }, { transaction: tx });
          }
        }
        return lr;
      });

      // Best-effort email
      try {
        const { mailer } = require('../utils/mailer');
        const requester = await Employee.findByPk(result.employee_id);
        if (requester?.email) {
          await mailer.send({
            to: requester.email,
            template: 'invite', // Plan 4 swaps for 'leave-decision'
            data: { companyName: 'Your workspace', inviterName: 'Manager', acceptUrl: 'Approved' },
          });
        }
      } catch { /* best effort */ }

      const fresh = await LeaveRequest.findByPk(result.leave_id);
      res.json(toLeaveRequestDto(fresh));
    } catch (err) {
      if (err instanceof AppError) return next(err);
      next(err);
    }
  },

  reject: async (req, res, next) => {
    try {
      const lr = await LeaveRequest.findOne({
        where: { leave_id: req.params.id, company_id: req.user.companyId },
      });
      if (!lr) return next(AppError.notFound('Leave request'));
      if (lr.status !== 'pending') return next(AppError.businessRule('LEAVE_ALREADY_DECIDED', 'Already decided.'));
      if (!req.user.employeeId) return next(AppError.badRequest('Approver has no linked employee.'));

      await LeaveApproval.create({
        company_id: req.user.companyId,
        leave_request_id: lr.leave_id,
        approver_id: req.user.employeeId,
        decision: 'rejected',
        reason: req.body?.reason || null,
        decided_at: new Date(),
      });
      await lr.update({ status: 'rejected' });

      try {
        const { mailer } = require('../utils/mailer');
        const requester = await Employee.findByPk(lr.employee_id);
        if (requester?.email) {
          await mailer.send({
            to: requester.email,
            template: 'invite',
            data: { companyName: 'Your workspace', inviterName: 'Manager', acceptUrl: 'Rejected: ' + (req.body?.reason || 'no reason given') },
          });
        }
      } catch { /* best effort */ }

      res.json(toLeaveRequestDto(lr));
    } catch (err) { next(err); }
  },
};

module.exports = leaveApprovalController;
```

- [ ] **Step 2: Update `api/routes/leaverequestRoutes.js` to add approve/reject (under the leaves router)**

Add at the bottom of `leaverequestRoutes.js`, ABOVE `module.exports`:

```javascript
const approvalController = require('../controllers/leaveapprovalController');
const { leaveRejectBody } = require('../validators/resourceValidators');

router.post('/:id/approve', requireRole('manager'), validate({ params: idParam }), approvalController.approve);
router.post('/:id/reject', requireRole('manager'), validate({ params: idParam, body: leaveRejectBody }), approvalController.reject);
```

- [ ] **Step 3: Remove the standalone leaveapprovals mount from `index.js`**

Find and delete the line `app.use('/api/leaveapprovals', leaveapprovalRoutes);` and its `require`. The endpoints are now under `/api/leaves`.

You can also delete `api/routes/leaveapprovalRoutes.js` — it's no longer used:

```bash
rm api/routes/leaveapprovalRoutes.js
```

- [ ] **Step 4: Smoke test**

```bash
# Approve the leave from Task 13
curl -s -b /tmp/sp-cookies-login.txt -X POST http://localhost:3000/api/leaves/1/approve
# expect: 200 with status: "approved"

# Verify the auto-attendance rows
curl -s -b /tmp/sp-cookies-login.txt 'http://localhost:3000/api/attendance/month?year=2026&month=6'
# expect: 200 with "2026-06-10": "leave", "2026-06-11": "leave", ..., "2026-06-14": "leave"
```

---

## Task 15: End-to-end smoke test

**Files:**
- (no file changes)

- [ ] **Step 1: Boot the server**

- [ ] **Step 2: Log in as owner if cookies are stale**

```bash
curl -s -c /tmp/sp-cookies-login.txt -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"desmond@squarefeet.com","password":"newhunter22","workspaceSlug":"square-feet"}'
```

- [ ] **Step 3: Walk through every resource list endpoint**

Each should return either `{ data, meta }` or a bare DTO without errors:

```bash
for path in \
  /api/me \
  /api/companies/me \
  /api/departments \
  /api/roles \
  /api/employees \
  /api/teams \
  /api/projects \
  /api/tasks \
  '/api/tasks/kanban?projectId=1' \
  /api/time/entries \
  /api/time/today-total \
  /api/time/weekly-hours \
  /api/attendance/today \
  '/api/attendance/month?year=2026&month=5' \
  /api/attendance/summary \
  /api/leaves/mine \
  /api/leaves/pending \
; do
  echo "=== $path ==="
  curl -s -o /tmp/resp -w "%{http_code}\n" -b /tmp/sp-cookies-login.txt "http://localhost:3000$path"
  head -c 200 /tmp/resp; echo
done
```

Expected: every line either prints `200` (or `201` for the few you trigger as POSTs) and a sensible JSON snippet. No 500s, no `Cannot GET`, no `Internal`.

- [ ] **Step 4: Verify tenancy still holds**

Log in as one of the second-company users from Plan 2 (`owner@a.com` / `hunter22a` / `company-a`) and hit `/api/employees`. Should NOT see Maya, Desmond, etc.:

```bash
curl -s -c /tmp/sp-A.txt -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@a.com","password":"hunter22a","workspaceSlug":"company-a"}'

curl -s -b /tmp/sp-A.txt http://localhost:3000/api/employees | head -c 300
# expect: only Company A's employees, NOT Square Feet's.
```

- [ ] **Step 5: Kill the server**

---

## Done

After Task 15 every resource the frontend's pages need is wired up against real, tenant-scoped data:

- `/api/companies/me`, `/api/departments`, `/api/roles`, `/api/employees` (+ `/:id/roles`, `/:id/tasks`, `/:id/attendance`, `/:id/leaves`)
- `/api/teams` (+ `/:id/members`), `/api/projects` (+ `/:id/teams`)
- `/api/tasks` (CRUD + `/kanban` + `/:id/move`)
- `/api/tasks/:taskId/subtasks` (CRUD)
- `/api/time/{entries,today-total,weekly-hours,start,/:id/pause,/:id/resume,/:id/stop}`
- `/api/attendance/{today,month,sign-in,sign-out,summary}`
- `/api/leaves/{mine,pending,/:id/approve,/:id/reject}` + create/update/cancel

**What does NOT work yet** (by design — Plan 4):

- No `/api/dashboard/{stats,activity,hours-this-week}` aggregates.
- No `audit_log` writes (the controllers don't emit audit events yet).
- No `/api/invites/*` flow.
- No `/api/audit` endpoint.
- The leave-event emails go to a hard-coded `manager@example.com` and use the generic `invite` template. Plan 4 wires real `leave-submitted` / `leave-decision` templates AND routes to actual managers.
- Manager-specific RBAC ("only this team's manager can approve") is intentionally simplified — admin+ sees all pending in v1.

**Frontend follow-ups for this plan:**
- Swap `src/api/*.js` mock files for real `axios` calls:
  - `stats.js` / `activity.js` — wait for Plan 4.
  - Everything else — point at `/api/<resource>` with `withCredentials: true`.
- For the Kanban move handler in `useTasks.js`, change `move()` to POST `/api/tasks/:id/move` with `{ toColumn, toIndex }`.
- For the timer card, on mount call `GET /api/time/entries?date=<today>` and find any unended entry — that's the "current running" timer.
- Replace `attendance.js` calls with `/api/attendance/{sign-in,sign-out,month}`.
- Replace `leaves.js` calls with `/api/leaves/{mine,pending,<id>/approve,<id>/reject}`.
