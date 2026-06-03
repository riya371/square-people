# API Plan 1 — Foundation, Schema & Cleanup (M1 + M2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the SquarePeople API to a clean, multi-tenant-ready foundation: install supporting dependencies, validate env, wire the production middleware pipeline, fix existing bugs, delete dead scaffolding, rewrite the User model as the new auth subject, and migrate every existing model to the multi-tenant schema described in the spec. After this plan, the API boots cleanly and the database has the right tables — but no new endpoints exist yet (auth comes in Plan 2).

**Architecture:** Keep the existing flat MVC structure (`controllers/`, `models/`, `routes/`, `services/`). Add `middleware/`, `utils/`, `validators/`, `emails/`, `config/env.js` as new top-level dirs/files. Schema evolves via the existing `sequelize.sync({ alter: true })` boot hook. Tenancy enforced at the schema level (composite uniques + `company_id` everywhere) so middleware in Plan 2 can rely on it.

**Tech Stack:** Express 5, Sequelize 6, PostgreSQL, Node.js. New deps in this plan: `cors`, `cookie-parser`, `helmet`, `zod`, `pino`, `pino-http`. (`jsonwebtoken`, `bcryptjs`, `resend` arrive in Plan 2.)

**Spec reference:** `api/docs/superpowers/specs/2026-05-21-api-completion-design.md` §§3–6, §16.

**Conventions:**
- All paths are absolute from the repo root.
- Smoke tests use `psql` + `curl`; no test framework.
- No git commit steps (repo is not yet a git repo).
- "Run from `api/`" means `cd api && <command>`.

---

## Task 1: Install runtime dependencies

**Files:**
- Modify: `api/package.json`

- [ ] **Step 1: Install runtime deps**

From `api/`:
```bash
npm install cors cookie-parser helmet zod pino pino-http
```

- [ ] **Step 2: Promote `dotenv` from devDependencies to dependencies**

From `api/`:
```bash
npm install dotenv
```

- [ ] **Step 3: Verify `package.json` lists all six new + dotenv under `dependencies`**

Run:
```bash
cat api/package.json
```

Expected `dependencies` block contains (alongside existing `express`, `pg`, `pg-hstore`, `sequelize`): `cors`, `cookie-parser`, `helmet`, `zod`, `pino`, `pino-http`, `dotenv`.

---

## Task 2: Add npm scripts for dev and start

**Files:**
- Modify: `api/package.json`

- [ ] **Step 1: Open `api/package.json`, add a `scripts` block**

Final `package.json` should look like:
```json
{
  "scripts": {
    "dev": "nodemon index.js",
    "start": "node index.js"
  },
  "dependencies": { ... },
  "devDependencies": { ... }
}
```

- [ ] **Step 2: Verify the scripts run**

From `api/`:
```bash
npm run dev
```

Expected: nodemon starts and prints something like `[nodemon] starting node index.js`. (The server may crash because env vars aren't set yet — that's fine, we'll fix in Task 4.) Ctrl-C to stop.

---

## Task 3: Create `.env.example` and `.gitignore`

**Files:**
- Create: `api/.env.example`
- Create: `api/.gitignore`

- [ ] **Step 1: Create `api/.env.example`**

```
# --- Server ---
PORT=3000
NODE_ENV=development

# --- Frontend origin (CORS allow) ---
FRONTEND_URL=http://localhost:5173

# --- Database (Postgres) ---
DB_NAME=squarepeople
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432

# --- Auth (Plan 2 will use these) ---
JWT_ACCESS_SECRET=change_me_to_a_long_random_string
JWT_REFRESH_SECRET=change_me_to_a_different_long_random_string
COOKIE_DOMAIN=localhost
COOKIE_SECURE=false

# --- Email (Plan 4 will use these) ---
MAIL_DRIVER=console
RESEND_API_KEY=
RESEND_FROM=SquarePeople <no-reply@squarepeople.squarefeetltd.com>
```

- [ ] **Step 2: Create `api/.gitignore`**

```
node_modules
.env
.env.local
dist
.DS_Store
*.log
```

- [ ] **Step 3: If the user has a real `.env`, leave it alone; otherwise copy the example**

If `api/.env` does NOT exist, run from `api/`:
```bash
cp .env.example .env
```

Then open `api/.env` and adjust `DB_*` values to match the local Postgres install.

---

## Task 4: Create `config/env.js` with Zod validation

**Files:**
- Create: `api/config/env.js`

- [ ] **Step 1: Create `api/config/env.js`**

```javascript
const { z } = require('zod');
require('dotenv').config();

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),

  DB_NAME: z.string().min(1, 'DB_NAME is required'),
  DB_USER: z.string().min(1, 'DB_USER is required'),
  DB_PASSWORD: z.string().min(0).default(''),
  DB_HOST: z.string().min(1).default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(5432),

  // Plan 2 will start using these. Keep optional now so this plan can boot.
  JWT_ACCESS_SECRET: z.string().min(16).optional(),
  JWT_REFRESH_SECRET: z.string().min(16).optional(),
  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: z
    .union([z.literal('true'), z.literal('false')])
    .default('false')
    .transform((v) => v === 'true'),

  // Plan 4 will start using these.
  MAIL_DRIVER: z.enum(['console', 'resend']).default('console'),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

module.exports = parsed.data;
```

- [ ] **Step 2: Smoke test env loading**

From `api/`:
```bash
node -e "console.log(require('./config/env'))"
```

Expected: a JSON-ish object printed with all DB_*, FRONTEND_URL, PORT, etc. If it errors, the message tells you which env var is wrong — fix `api/.env` accordingly.

---

## Task 5: Update `config/database.js` to use the validated env module

**Files:**
- Modify: `api/config/database.js`

- [ ] **Step 1: Replace `api/config/database.js` with**

```javascript
const { Sequelize } = require('sequelize');
const env = require('./env');

const sequelize = new Sequelize(env.DB_NAME, env.DB_USER, env.DB_PASSWORD, {
  host: env.DB_HOST,
  port: env.DB_PORT,
  dialect: 'postgres',
  logging: env.NODE_ENV === 'development' ? console.log : false,
});

module.exports = sequelize;
```

- [ ] **Step 2: Smoke test that DB connection still works**

From `api/`:
```bash
node -e "require('./config/database').authenticate().then(() => console.log('OK')).catch(e => { console.error(e.message); process.exit(1) })"
```

Expected: `OK`. If it errors, fix DB_* values in `api/.env`.

---

## Task 6: Fix `routes/taskRoutes.js` double-prefix bug

**Files:**
- Modify: `api/routes/taskRoutes.js`

- [ ] **Step 1: Replace `api/routes/taskRoutes.js` with**

```javascript
const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');

router.post('/', taskController.createTask);
router.get('/', taskController.getAllTasks);
router.get('/:id', taskController.getTaskById);
router.put('/:id', taskController.updateTask);
router.delete('/:id', taskController.deleteTask);

module.exports = router;
```

- [ ] **Step 2: Verify the file is correct**

Run:
```bash
grep -n "router\." api/routes/taskRoutes.js
```

Expected: every route path is `'/'` or `'/:id'` — **no** path should start with `'/tasks'`.

---

## Task 7: Delete Products scaffolding

**Files:**
- Delete: `api/controllers/productsController.js`
- Delete: `api/routes/productsRoutes.js`
- Delete: `api/models/productsModel.js`
- Modify: `api/index.js` (will be fully rewritten in Task 13; for now just verify the files are gone)
- Modify: `api/association.js` (will be fully rewritten in Task 28)

- [ ] **Step 1: Delete the three files**

From the repo root:
```bash
rm api/controllers/productsController.js api/routes/productsRoutes.js api/models/productsModel.js
```

- [ ] **Step 2: Verify deletion**

```bash
ls api/controllers/productsController.js api/routes/productsRoutes.js api/models/productsModel.js 2>&1 | grep -c "No such file"
```

Expected: `3`.

---

## Task 8: Delete Category scaffolding

**Files:**
- Delete: `api/controllers/categoryController.js`
- Delete: `api/routes/categoryRoutes.js`
- Delete: `api/models/categoryModel.js`

- [ ] **Step 1: Delete the three files**

```bash
rm api/controllers/categoryController.js api/routes/categoryRoutes.js api/models/categoryModel.js
```

- [ ] **Step 2: Verify deletion**

```bash
ls api/controllers/categoryController.js api/routes/categoryRoutes.js api/models/categoryModel.js 2>&1 | grep -c "No such file"
```

Expected: `3`.

---

## Task 9: Delete old User routes / controller / service

Reason: in Task 21 we rewrite `userModel.js` as the auth subject (password_hash, role, company_id, etc.). The existing CRUD User routes assume `{ name, email }` only and would error against the new schema. Auth-related User endpoints get rebuilt in Plan 2.

**Files:**
- Delete: `api/controllers/userController.js`
- Delete: `api/routes/userRoutes.js`
- Delete: `api/services/userService.js`

- [ ] **Step 1: Delete the three files**

```bash
rm api/controllers/userController.js api/routes/userRoutes.js api/services/userService.js
```

- [ ] **Step 2: Verify deletion**

```bash
ls api/controllers/userController.js api/routes/userRoutes.js api/services/userService.js 2>&1 | grep -c "No such file"
```

Expected: `3`.

- [ ] **Step 3: Remove the now-empty `services/` directory (optional)**

```bash
rmdir api/services 2>/dev/null || true
```

(Will silently fail if other files appear — harmless.)

---

## Task 10: Create `utils/AppError.js`

**Files:**
- Create: `api/utils/AppError.js`

- [ ] **Step 1: Create `api/utils/AppError.js`**

```javascript
class AppError extends Error {
  constructor(httpStatus, code, message, details = null) {
    super(message);
    this.name = 'AppError';
    this.httpStatus = httpStatus;
    this.code = code;
    this.details = details;
  }

  static badRequest(message, details = null) {
    return new AppError(400, 'INVALID_INPUT', message, details);
  }

  static validation(details) {
    return new AppError(400, 'VALIDATION_FAILED', 'Validation failed.', details);
  }

  static unauthenticated(message = 'Authentication required.') {
    return new AppError(401, 'UNAUTHENTICATED', message);
  }

  static forbidden(message = 'You do not have permission to do that.') {
    return new AppError(403, 'FORBIDDEN', message);
  }

  static notFound(entity = 'Resource') {
    return new AppError(404, 'NOT_FOUND', `${entity} not found.`);
  }

  static conflict(code, message, details = null) {
    return new AppError(409, code, message, details);
  }

  static businessRule(code, message, details = null) {
    return new AppError(422, code, message, details);
  }
}

module.exports = AppError;
```

- [ ] **Step 2: Verify it loads without error**

```bash
node -e "console.log(require('./api/utils/AppError').notFound('Employee').httpStatus)"
```

Expected: `404`.

---

## Task 11: Create `middleware/errorHandler.js`

**Files:**
- Create: `api/middleware/errorHandler.js`

- [ ] **Step 1: Create `api/middleware/errorHandler.js`**

```javascript
const AppError = require('../utils/AppError');

function errorHandler(err, req, res, _next) {
  // Sequelize validation/unique errors → 400 with details
  if (err && (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError')) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Validation failed.',
        details: (err.errors || []).map((e) => ({ path: e.path, message: e.message })),
      },
    });
  }

  // Our AppError
  if (err instanceof AppError) {
    return res.status(err.httpStatus).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  // Anything else → 500
  if (req.log) req.log.error({ err }, 'Unhandled error');
  else console.error('Unhandled error:', err);
  return res.status(500).json({
    error: { code: 'INTERNAL', message: 'Something went wrong.', details: null },
  });
}

module.exports = errorHandler;
```

---

## Task 12: Create `middleware/validate.js`

**Files:**
- Create: `api/middleware/validate.js`

- [ ] **Step 1: Create `api/middleware/validate.js`**

```javascript
const AppError = require('../utils/AppError');

// Usage: router.post('/', validate({ body: someZodSchema, query: ..., params: ... }), handler)
function validate(schemas) {
  return (req, _res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) req.query = schemas.query.parse(req.query);
      if (schemas.params) req.params = schemas.params.parse(req.params);
      next();
    } catch (err) {
      if (err && err.issues) {
        const details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
        return next(AppError.validation(details));
      }
      next(err);
    }
  };
}

module.exports = validate;
```

---

## Task 13: Rewrite `index.js` to wire the middleware pipeline

The boot file gets a full rewrite: load validated env, build the middleware pipeline (helmet → cors → cookieParser → express.json → pino-http), mount all surviving routes under `/api`, finish with 404 + errorHandler. New User/Invite/AuditLog/etc. models will be required by `association.js` in Task 28; this file only needs to `require('./association')`.

**Files:**
- Modify: `api/index.js`

- [ ] **Step 1: Replace `api/index.js` with**

```javascript
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const pinoHttp = require('pino-http');

const env = require('./config/env');
const sequelize = require('./config/database');

// Require every model file so Sequelize registers all models before sync().
require('./models/companyModel');
require('./models/departmentModel');
require('./models/employeeModel');
require('./models/roleModel');
require('./models/teamModel');
require('./models/teamMemberModel');
require('./models/projectModel');
require('./models/taskModel');
require('./models/subtaskModel');
require('./models/worktrackingModel');
require('./models/attendanceModel');
require('./models/leaverequestModel');
require('./models/leaveapprovalModel');
require('./models/userModel');
require('./models/refreshTokenModel');
require('./models/passwordResetTokenModel');
require('./models/inviteModel');
require('./models/auditLogModel');

// Wire associations after every model is registered.
require('./association');

// Routes
const companyRoutes = require('./routes/companyRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const roleRoutes = require('./routes/roleRoutes');
const teamRoutes = require('./routes/teamRoutes');
const projectRoutes = require('./routes/projectRoutes');
const taskRoutes = require('./routes/taskRoutes');
const subtaskRoute = require('./routes/subtaskRoute');
const worktrackingRoutes = require('./routes/worktrackingRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const leaverequestRoutes = require('./routes/leaverequestRoutes');
const leaveapprovalRoutes = require('./routes/leaveapprovalRoutes');

const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(pinoHttp({
  level: env.NODE_ENV === 'development' ? 'info' : 'warn',
  redact: ['req.headers.cookie', 'req.headers.authorization'],
}));

// Health check (handy for smoke testing)
app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// API routes (auth + me + dashboard arrive in later plans)
app.use('/api/companies', companyRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/subtasks', subtaskRoute);
app.use('/api/worktracking', worktrackingRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaverequests', leaverequestRoutes);
app.use('/api/leaveapprovals', leaveapprovalRoutes);

// 404
app.use((req, res, _next) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.originalUrl}`, details: null } });
});

// Centralised error handler (must be last)
app.use(errorHandler);

(async () => {
  try {
    await sequelize.authenticate();
    console.log('DB connection OK');
    await sequelize.sync({ alter: true });
    console.log('Models synced');
    app.listen(env.PORT, () => {
      console.log(`Server running on http://localhost:${env.PORT}`);
    });
  } catch (err) {
    console.error('Unable to start server:', err);
    process.exit(1);
  }
})();
```

- [ ] **Step 2: Do NOT boot yet** — Task 14 onward changes every model that `sync({alter:true})` will touch. Booting now would alter tables to an in-between shape. We boot in Task 29.

---

## Task 14: Update `models/companyModel.js` — add slug

**Files:**
- Modify: `api/models/companyModel.js`

- [ ] **Step 1: Replace `api/models/companyModel.js` with**

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Company = sequelize.define(
  'Company',
  {
    company_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        is: /^[a-z0-9-]+$/,
        len: [2, 64],
      },
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    address: { type: DataTypes.STRING, allowNull: true },
    website: { type: DataTypes.STRING, allowNull: true },
    phone: { type: DataTypes.STRING, allowNull: true },
    workingDays: { type: DataTypes.STRING, allowNull: true },
    workingHours: { type: DataTypes.STRING, allowNull: true },
    foundedDate: { type: DataTypes.DATE, allowNull: true },
    industry: { type: DataTypes.STRING, allowNull: true },
    companySize: { type: DataTypes.STRING, allowNull: true },
  },
  {
    tableName: 'companies',
    timestamps: true,
  },
);

module.exports = Company;
```

---

## Task 15: Update `models/employeeModel.js` — composite unique, new columns, lowercase status

**Files:**
- Modify: `api/models/employeeModel.js`

- [ ] **Step 1: Replace `api/models/employeeModel.js` with**

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Employee = sequelize.define(
  'Employee',
  {
    employee_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'companies', key: 'company_id' },
      onDelete: 'CASCADE',
    },
    department_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'departments', key: 'department_id' },
      onDelete: 'SET NULL',
    },
    manager_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'Employees', key: 'employee_id' },
      onDelete: 'SET NULL',
    },
    employee_code: {
      type: DataTypes.STRING,
      allowNull: true, // assigned on hire; nullable for now so existing rows survive sync
    },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false },
    phone: { type: DataTypes.STRING, allowNull: true },
    dob: { type: DataTypes.DATEONLY, allowNull: true },
    hire_date: { type: DataTypes.DATEONLY, allowNull: true },
    termination_date: { type: DataTypes.DATEONLY, allowNull: true },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'terminated'),
      defaultValue: 'active',
      allowNull: false,
    },
  },
  {
    tableName: 'Employees',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['company_id', 'email'], name: 'employees_company_email_uniq' },
      { unique: true, fields: ['company_id', 'employee_code'], name: 'employees_company_code_uniq', where: { employee_code: { [require('sequelize').Op.ne]: null } } },
    ],
  },
);

module.exports = Employee;
```

(The partial unique index on `employee_code` uses Postgres-only syntax. If the dialect ever changes, drop the `where:` clause — collisions on NULL are accepted by Postgres anyway.)

---

## Task 16: Update `models/roleModel.js` — composite unique, add color

**Files:**
- Modify: `api/models/roleModel.js`

- [ ] **Step 1: Replace `api/models/roleModel.js` with**

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Role = sequelize.define(
  'Role',
  {
    role_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'companies', key: 'company_id' },
      onDelete: 'CASCADE',
    },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.STRING, allowNull: true },
    color: { type: DataTypes.STRING, allowNull: true },
  },
  {
    tableName: 'roles',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['company_id', 'name'], name: 'roles_company_name_uniq' },
    ],
  },
);

module.exports = Role;
```

---

## Task 17: Update `models/departmentModel.js` — fix autoIncrement, clean up

**Files:**
- Modify: `api/models/departmentModel.js`

- [ ] **Step 1: Replace `api/models/departmentModel.js` with**

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Department = sequelize.define(
  'Department',
  {
    department_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'companies', key: 'company_id' },
      onDelete: 'CASCADE',
    },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.STRING, allowNull: true },
  },
  {
    tableName: 'departments',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['company_id', 'name'], name: 'departments_company_name_uniq' },
    ],
  },
);

module.exports = Department;
```

---

## Task 18: Update `models/teamModel.js` — keep company_id, ensure description

**Files:**
- Modify: `api/models/teamModel.js`

- [ ] **Step 1: Replace `api/models/teamModel.js` with**

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Team = sequelize.define(
  'Team',
  {
    team_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'companies', key: 'company_id' },
      onDelete: 'CASCADE',
    },
    lead_employee_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'Employees', key: 'employee_id' },
      onDelete: 'SET NULL',
    },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.STRING, allowNull: true },
  },
  {
    tableName: 'teams',
    timestamps: true,
  },
);

module.exports = Team;
```

---

## Task 19: Update `models/projectModel.js` — add company_id, status, due_date

Removes the dangling `team_id` column (M:N goes through `TeamProjects` junction in `association.js`).

**Files:**
- Modify: `api/models/projectModel.js`

- [ ] **Step 1: Replace `api/models/projectModel.js` with**

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Project = sequelize.define(
  'Project',
  {
    project_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'companies', key: 'company_id' },
      onDelete: 'CASCADE',
    },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM('on-track', 'at-risk', 'in-progress', 'completed'),
      defaultValue: 'in-progress',
      allowNull: false,
    },
    start_date: { type: DataTypes.DATEONLY, allowNull: true },
    end_date: { type: DataTypes.DATEONLY, allowNull: true },
    due_date: { type: DataTypes.DATEONLY, allowNull: true },
  },
  {
    tableName: 'Projects',
    timestamps: true,
  },
);

module.exports = Project;
```

---

## Task 20: Update `models/taskModel.js` — add company_id, position, code

**Files:**
- Modify: `api/models/taskModel.js`

- [ ] **Step 1: Replace `api/models/taskModel.js` with**

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Task = sequelize.define(
  'Task',
  {
    task_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'companies', key: 'company_id' },
      onDelete: 'CASCADE',
    },
    code: {
      type: DataTypes.STRING,
      allowNull: true, // auto-assigned by controller in Plan 3 (e.g. "#142")
    },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    project_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'Projects', key: 'project_id' },
      onDelete: 'CASCADE',
    },
    assigned_to: {
      type: DataTypes.INTEGER,
      allowNull: true, // unassigned tasks are valid (e.g. in a backlog)
      references: { model: 'Employees', key: 'employee_id' },
      onDelete: 'SET NULL',
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high'),
      defaultValue: 'medium',
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'in_progress', 'completed'),
      defaultValue: 'pending',
      allowNull: false,
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: 'tasks',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['company_id', 'code'], name: 'tasks_company_code_uniq', where: { code: { [require('sequelize').Op.ne]: null } } },
      { fields: ['project_id', 'status', 'position'], name: 'tasks_kanban_order_idx' },
    ],
  },
);

module.exports = Task;
```

---

## Task 21: Update `models/subtaskModel.js` — add company_id, position

**Files:**
- Modify: `api/models/subtaskModel.js`

- [ ] **Step 1: Replace `api/models/subtaskModel.js` with**

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Subtask = sequelize.define(
  'Subtask',
  {
    subtask_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'companies', key: 'company_id' },
      onDelete: 'CASCADE',
    },
    task_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'tasks', key: 'task_id' },
      onDelete: 'CASCADE',
    },
    assigned_to: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'Employees', key: 'employee_id' },
      onDelete: 'SET NULL',
    },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM('pending', 'in_progress', 'completed'),
      defaultValue: 'pending',
      allowNull: false,
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    deadline: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: 'subtasks',
    timestamps: true,
  },
);

module.exports = Subtask;
```

---

## Task 22: Update `models/worktrackingModel.js` — add company_id

**Files:**
- Modify: `api/models/worktrackingModel.js`

- [ ] **Step 1: Replace `api/models/worktrackingModel.js` with**

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WorkTracking = sequelize.define(
  'WorkTracking',
  {
    log_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'companies', key: 'company_id' },
      onDelete: 'CASCADE',
    },
    employee_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'Employees', key: 'employee_id' },
      onDelete: 'CASCADE',
    },
    task_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'tasks', key: 'task_id' },
      onDelete: 'SET NULL',
    },
    subtask_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'subtasks', key: 'subtask_id' },
      onDelete: 'SET NULL',
    },
    start_time: { type: DataTypes.DATE, allowNull: false },
    end_time: { type: DataTypes.DATE, allowNull: true },
    duration_minutes: { type: DataTypes.INTEGER, allowNull: true },
    logged_date: { type: DataTypes.DATEONLY, allowNull: false },
  },
  {
    tableName: 'workTracking',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  },
);

module.exports = WorkTracking;
```

---

## Task 23: Update `models/attendanceModel.js` — rename columns, add status + company_id, composite unique

**Files:**
- Modify: `api/models/attendanceModel.js`

Old column names (`date`, `signin_time`, `signout_time`) are renamed to `logged_date`, `signed_in_at`, `signed_out_at` to match the spec. `sync({alter:true})` will drop the old columns and add the new ones — any data in them is lost. (Acceptable; this DB has no real data yet.)

- [ ] **Step 1: Replace `api/models/attendanceModel.js` with**

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Attendance = sequelize.define(
  'Attendance',
  {
    attendance_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'companies', key: 'company_id' },
      onDelete: 'CASCADE',
    },
    employee_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'Employees', key: 'employee_id' },
      onDelete: 'CASCADE',
    },
    logged_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    signed_in_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    signed_out_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('present', 'late', 'leave', 'absent'),
      allowNull: false,
      defaultValue: 'present',
    },
  },
  {
    tableName: 'Attendance',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { unique: true, fields: ['employee_id', 'logged_date'], name: 'attendance_employee_date_uniq' },
    ],
  },
);

module.exports = Attendance;
```

---

## Task 24: Update `models/leaverequestModel.js` — add company_id, reason, days, lowercase status

**Files:**
- Modify: `api/models/leaverequestModel.js`

- [ ] **Step 1: Replace `api/models/leaverequestModel.js` with**

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LeaveRequest = sequelize.define(
  'LeaveRequest',
  {
    leave_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'companies', key: 'company_id' },
      onDelete: 'CASCADE',
    },
    employee_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'Employees', key: 'employee_id' },
      onDelete: 'CASCADE',
    },
    leave_type: {
      type: DataTypes.ENUM('annual', 'sick', 'maternity', 'unpaid', 'other'),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      allowNull: false,
      defaultValue: 'pending',
    },
    start_date: { type: DataTypes.DATEONLY, allowNull: false },
    end_date: { type: DataTypes.DATEONLY, allowNull: false },
    days: { type: DataTypes.INTEGER, allowNull: false },
    reason: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: 'LeaveRequest',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

module.exports = LeaveRequest;
```

---

## Task 25: Update `models/leaveapprovalModel.js` — add company_id, lowercase status

**Files:**
- Modify: `api/models/leaveapprovalModel.js`

- [ ] **Step 1: Replace `api/models/leaveapprovalModel.js` with**

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LeaveApproval = sequelize.define(
  'LeaveApproval',
  {
    leave_approval_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'companies', key: 'company_id' },
      onDelete: 'CASCADE',
    },
    leave_request_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'LeaveRequest', key: 'leave_id' },
      onDelete: 'CASCADE',
    },
    approver_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'Employees', key: 'employee_id' },
      onDelete: 'CASCADE',
    },
    decision: {
      type: DataTypes.ENUM('approved', 'rejected'),
      allowNull: false,
    },
    reason: { type: DataTypes.TEXT, allowNull: true },
    decided_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    tableName: 'leaveapprovals',
    timestamps: true,
  },
);

module.exports = LeaveApproval;
```

---

## Task 26: Rewrite `models/userModel.js` as the auth subject

**Files:**
- Modify: `api/models/userModel.js`

- [ ] **Step 1: Replace `api/models/userModel.js` with**

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'companies', key: 'company_id' },
      onDelete: 'CASCADE',
    },
    employee_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'Employees', key: 'employee_id' },
      onDelete: 'SET NULL',
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isEmail: true },
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    pin_hash: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    role: {
      type: DataTypes.ENUM('owner', 'admin', 'manager', 'member'),
      allowNull: false,
      defaultValue: 'member',
    },
    last_login_at: { type: DataTypes.DATE, allowNull: true },
    last_login_ip: { type: DataTypes.STRING, allowNull: true },
  },
  {
    tableName: 'users',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['company_id', 'email'], name: 'users_company_email_uniq' },
    ],
  },
);

module.exports = User;
```

---

## Task 27: Create the 5 new model files

**Files:**
- Create: `api/models/refreshTokenModel.js`
- Create: `api/models/passwordResetTokenModel.js`
- Create: `api/models/inviteModel.js`
- Create: `api/models/auditLogModel.js`
- Create: `api/models/teamMemberModel.js`

- [ ] **Step 1: Create `api/models/refreshTokenModel.js`**

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RefreshToken = sequelize.define(
  'RefreshToken',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    token_hash: { type: DataTypes.STRING, allowNull: false, unique: true },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    revoked_at: { type: DataTypes.DATE, allowNull: true },
    ip: { type: DataTypes.STRING, allowNull: true },
    ua: { type: DataTypes.STRING, allowNull: true },
  },
  {
    tableName: 'refresh_tokens',
    timestamps: true,
    indexes: [{ fields: ['user_id'], name: 'refresh_tokens_user_idx' }],
  },
);

module.exports = RefreshToken;
```

- [ ] **Step 2: Create `api/models/passwordResetTokenModel.js`**

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PasswordResetToken = sequelize.define(
  'PasswordResetToken',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    token_hash: { type: DataTypes.STRING, allowNull: false, unique: true },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    used_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: 'password_reset_tokens',
    timestamps: true,
  },
);

module.exports = PasswordResetToken;
```

- [ ] **Step 3: Create `api/models/inviteModel.js`**

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Invite = sequelize.define(
  'Invite',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'companies', key: 'company_id' },
      onDelete: 'CASCADE',
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isEmail: true },
    },
    role: {
      type: DataTypes.ENUM('owner', 'admin', 'manager', 'member'),
      allowNull: false,
      defaultValue: 'member',
    },
    employee_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'Employees', key: 'employee_id' },
      onDelete: 'SET NULL',
    },
    token_hash: { type: DataTypes.STRING, allowNull: false, unique: true },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    accepted_at: { type: DataTypes.DATE, allowNull: true },
    created_by_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    },
  },
  {
    tableName: 'invites',
    timestamps: true,
    indexes: [{ fields: ['company_id', 'email'], name: 'invites_company_email_idx' }],
  },
);

module.exports = Invite;
```

- [ ] **Step 4: Create `api/models/auditLogModel.js`**

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AuditLog = sequelize.define(
  'AuditLog',
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'companies', key: 'company_id' },
      onDelete: 'CASCADE',
    },
    actor_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    },
    entity: { type: DataTypes.STRING, allowNull: false },
    entity_id: { type: DataTypes.STRING, allowNull: true },
    action: { type: DataTypes.STRING, allowNull: false },
    diff: { type: DataTypes.JSONB, allowNull: true },
    ip: { type: DataTypes.STRING, allowNull: true },
    ua: { type: DataTypes.STRING, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    tableName: 'audit_log',
    timestamps: false,
    indexes: [{ fields: ['company_id', 'created_at'], name: 'audit_log_company_created_idx' }],
  },
);

module.exports = AuditLog;
```

- [ ] **Step 5: Create `api/models/teamMemberModel.js`**

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TeamMember = sequelize.define(
  'TeamMember',
  {
    team_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      references: { model: 'teams', key: 'team_id' },
      onDelete: 'CASCADE',
    },
    employee_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      references: { model: 'Employees', key: 'employee_id' },
      onDelete: 'CASCADE',
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'companies', key: 'company_id' },
      onDelete: 'CASCADE',
    },
    joined_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    tableName: 'team_members',
    timestamps: true,
  },
);

module.exports = TeamMember;
```

---

## Task 28: Rewrite `association.js` for the full new schema

**Files:**
- Modify: `api/association.js`

- [ ] **Step 1: Replace `api/association.js` with**

```javascript
const Company = require('./models/companyModel');
const Department = require('./models/departmentModel');
const Employee = require('./models/employeeModel');
const Role = require('./models/roleModel');
const Team = require('./models/teamModel');
const TeamMember = require('./models/teamMemberModel');
const Project = require('./models/projectModel');
const Task = require('./models/taskModel');
const Subtask = require('./models/subtaskModel');
const WorkTracking = require('./models/worktrackingModel');
const Attendance = require('./models/attendanceModel');
const LeaveRequest = require('./models/leaverequestModel');
const LeaveApproval = require('./models/leaveapprovalModel');
const User = require('./models/userModel');
const RefreshToken = require('./models/refreshTokenModel');
const PasswordResetToken = require('./models/passwordResetTokenModel');
const Invite = require('./models/inviteModel');
const AuditLog = require('./models/auditLogModel');

// --- Company ↔ everything (1:M) ---
Company.hasMany(Department, { foreignKey: 'company_id' });
Department.belongsTo(Company, { foreignKey: 'company_id' });

Company.hasMany(Employee, { foreignKey: 'company_id' });
Employee.belongsTo(Company, { foreignKey: 'company_id' });

Company.hasMany(Role, { foreignKey: 'company_id' });
Role.belongsTo(Company, { foreignKey: 'company_id' });

Company.hasMany(Team, { foreignKey: 'company_id' });
Team.belongsTo(Company, { foreignKey: 'company_id' });

Company.hasMany(Project, { foreignKey: 'company_id' });
Project.belongsTo(Company, { foreignKey: 'company_id' });

Company.hasMany(Task, { foreignKey: 'company_id' });
Task.belongsTo(Company, { foreignKey: 'company_id' });

Company.hasMany(Subtask, { foreignKey: 'company_id' });
Subtask.belongsTo(Company, { foreignKey: 'company_id' });

Company.hasMany(WorkTracking, { foreignKey: 'company_id' });
WorkTracking.belongsTo(Company, { foreignKey: 'company_id' });

Company.hasMany(Attendance, { foreignKey: 'company_id' });
Attendance.belongsTo(Company, { foreignKey: 'company_id' });

Company.hasMany(LeaveRequest, { foreignKey: 'company_id' });
LeaveRequest.belongsTo(Company, { foreignKey: 'company_id' });

Company.hasMany(LeaveApproval, { foreignKey: 'company_id' });
LeaveApproval.belongsTo(Company, { foreignKey: 'company_id' });

Company.hasMany(User, { foreignKey: 'company_id' });
User.belongsTo(Company, { foreignKey: 'company_id' });

Company.hasMany(Invite, { foreignKey: 'company_id' });
Invite.belongsTo(Company, { foreignKey: 'company_id' });

Company.hasMany(AuditLog, { foreignKey: 'company_id' });
AuditLog.belongsTo(Company, { foreignKey: 'company_id' });

// --- Department ↔ Employee ---
Department.hasMany(Employee, { foreignKey: 'department_id' });
Employee.belongsTo(Department, { foreignKey: 'department_id' });

// --- Employee ↔ Employee (manager self-ref) ---
Employee.belongsTo(Employee, { foreignKey: 'manager_id', as: 'manager' });
Employee.hasMany(Employee, { foreignKey: 'manager_id', as: 'reports' });

// --- Employee ↔ Role (M:N) ---
Employee.belongsToMany(Role, {
  through: 'Employee_Roles',
  foreignKey: 'employee_id',
  otherKey: 'role_id',
  as: 'roles',
});
Role.belongsToMany(Employee, {
  through: 'Employee_Roles',
  foreignKey: 'role_id',
  otherKey: 'employee_id',
  as: 'employees',
});

// --- Team leader (Employee 1:M Team) ---
Employee.hasMany(Team, { foreignKey: 'lead_employee_id', as: 'leadTeams' });
Team.belongsTo(Employee, { foreignKey: 'lead_employee_id', as: 'leader' });

// --- Team ↔ Employee (M:N through TeamMember) ---
Team.belongsToMany(Employee, {
  through: TeamMember,
  foreignKey: 'team_id',
  otherKey: 'employee_id',
  as: 'members',
});
Employee.belongsToMany(Team, {
  through: TeamMember,
  foreignKey: 'employee_id',
  otherKey: 'team_id',
  as: 'teams',
});

// --- Team ↔ Project (M:N through TeamProjects) ---
Team.belongsToMany(Project, {
  through: 'TeamProjects',
  foreignKey: 'team_id',
  otherKey: 'project_id',
  as: 'projects',
});
Project.belongsToMany(Team, {
  through: 'TeamProjects',
  foreignKey: 'project_id',
  otherKey: 'team_id',
  as: 'teams',
});

// --- Project ↔ Task ---
Project.hasMany(Task, { foreignKey: 'project_id', onDelete: 'CASCADE' });
Task.belongsTo(Project, { foreignKey: 'project_id' });

// --- Employee ↔ Task ---
Employee.hasMany(Task, { foreignKey: 'assigned_to', onDelete: 'SET NULL', as: 'assignedTasks' });
Task.belongsTo(Employee, { foreignKey: 'assigned_to', as: 'assignee' });

// --- Task ↔ Subtask ---
Task.hasMany(Subtask, { foreignKey: 'task_id', onDelete: 'CASCADE' });
Subtask.belongsTo(Task, { foreignKey: 'task_id' });

// --- Employee ↔ Subtask ---
Employee.hasMany(Subtask, { foreignKey: 'assigned_to', onDelete: 'SET NULL', as: 'assignedSubtasks' });
Subtask.belongsTo(Employee, { foreignKey: 'assigned_to', as: 'assignee' });

// --- WorkTracking ↔ Employee/Task/Subtask ---
Employee.hasMany(WorkTracking, { foreignKey: 'employee_id', onDelete: 'CASCADE' });
WorkTracking.belongsTo(Employee, { foreignKey: 'employee_id' });

Task.hasMany(WorkTracking, { foreignKey: 'task_id', onDelete: 'SET NULL' });
WorkTracking.belongsTo(Task, { foreignKey: 'task_id' });

Subtask.hasMany(WorkTracking, { foreignKey: 'subtask_id', onDelete: 'SET NULL' });
WorkTracking.belongsTo(Subtask, { foreignKey: 'subtask_id' });

// --- Attendance ↔ Employee ---
Employee.hasMany(Attendance, { foreignKey: 'employee_id', onDelete: 'CASCADE' });
Attendance.belongsTo(Employee, { foreignKey: 'employee_id' });

// --- LeaveRequest ↔ Employee ---
Employee.hasMany(LeaveRequest, { foreignKey: 'employee_id', onDelete: 'CASCADE' });
LeaveRequest.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });

// --- LeaveApproval ↔ LeaveRequest / Employee ---
LeaveRequest.hasMany(LeaveApproval, { foreignKey: 'leave_request_id', onDelete: 'CASCADE' });
LeaveApproval.belongsTo(LeaveRequest, { foreignKey: 'leave_request_id' });

Employee.hasMany(LeaveApproval, { foreignKey: 'approver_id', onDelete: 'CASCADE', as: 'leaveDecisions' });
LeaveApproval.belongsTo(Employee, { foreignKey: 'approver_id', as: 'approver' });

// --- User ↔ Employee (1:1 conceptually; FK lives on User) ---
User.belongsTo(Employee, { foreignKey: 'employee_id' });
Employee.hasOne(User, { foreignKey: 'employee_id' });

// --- User ↔ RefreshToken / PasswordResetToken ---
User.hasMany(RefreshToken, { foreignKey: 'user_id', onDelete: 'CASCADE' });
RefreshToken.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(PasswordResetToken, { foreignKey: 'user_id', onDelete: 'CASCADE' });
PasswordResetToken.belongsTo(User, { foreignKey: 'user_id' });

// --- Invite ↔ User (creator) / Employee (pre-linked) ---
User.hasMany(Invite, { foreignKey: 'created_by_user_id', as: 'createdInvites' });
Invite.belongsTo(User, { foreignKey: 'created_by_user_id', as: 'creator' });

Employee.hasMany(Invite, { foreignKey: 'employee_id', as: 'invites' });
Invite.belongsTo(Employee, { foreignKey: 'employee_id' });

// --- AuditLog ↔ User (actor) ---
User.hasMany(AuditLog, { foreignKey: 'actor_user_id' });
AuditLog.belongsTo(User, { foreignKey: 'actor_user_id', as: 'actor' });

module.exports = {
  Company,
  Department,
  Employee,
  Role,
  Team,
  TeamMember,
  Project,
  Task,
  Subtask,
  WorkTracking,
  Attendance,
  LeaveRequest,
  LeaveApproval,
  User,
  RefreshToken,
  PasswordResetToken,
  Invite,
  AuditLog,
};
```

---

## Task 29: Boot the server and smoke test the foundation

This is the moment of truth: every model change above takes effect via `sync({ alter: true })`. If existing tables have data that conflicts with the new schema (e.g. duplicate `Employee.email` across what will be two companies, attendance rows referencing the renamed columns), the sync may fail. The safest move is to drop the schema and let sync recreate it.

**Files:**
- (no file changes — boot + verify)

- [ ] **Step 1: Drop & recreate the database (DESTRUCTIVE — only run on the dev DB)**

If you have any data you care about, back it up first. Otherwise, from a shell where `psql` is available:
```bash
psql -h "$DB_HOST" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS squarepeople;"
psql -h "$DB_HOST" -U "$DB_USER" -d postgres -c "CREATE DATABASE squarepeople;"
```

(Substitute `squarepeople` for whatever `DB_NAME` you used in `api/.env`.)

- [ ] **Step 2: Boot the API**

From `api/`:
```bash
npm run dev
```

Expected output (order may vary):
```
DB connection OK
Models synced
Server running on http://localhost:3000
```

If you see any `SequelizeDatabaseError` about enums or foreign keys, jump to Step 5 below for the recovery recipe.

- [ ] **Step 3: Health-check the server**

In a second terminal:
```bash
curl -s http://localhost:3000/health
```

Expected (formatted):
```json
{"ok":true,"ts":"2026-05-21T...Z"}
```

- [ ] **Step 4: Verify the expected tables exist**

From a `psql` connected to the squarepeople DB:
```sql
\dt
```

Expected list (case-insensitive — Postgres lowercases unquoted identifiers):
```
Attendance
Employee_Roles
Employees
LeaveRequest
Projects
TeamProjects
audit_log
companies
departments
invites
leaveapprovals
password_reset_tokens
refresh_tokens
roles
subtasks
tasks
team_members
teams
users
workTracking
```

(20 tables: 14 entity tables + 6 join/log tables.)

- [ ] **Step 5: Verify the new columns are there on the existing tables**

```sql
\d "Employees"
```

Expected: rows include `company_id`, `manager_id`, `employee_code`, `hire_date`, `termination_date`, `status` (ENUM with `'active'|'inactive'|'terminated'`).

```sql
\d "users"
```

Expected: `id`, `company_id`, `employee_id`, `email`, `password_hash`, `pin_hash`, `role`, `last_login_at`, `last_login_ip`.

```sql
\d "audit_log"
```

Expected: `id` (bigint), `company_id`, `actor_user_id`, `entity`, `entity_id`, `action`, `diff` (jsonb), `ip`, `ua`, `created_at`.

- [ ] **Step 6: Hit an existing CRUD route to confirm wiring**

Existing controllers (e.g. `employeeController`) haven't been rewritten for tenancy yet — Plan 3 does that — but the route should at least respond, even if it returns an empty list. Try:
```bash
curl -s http://localhost:3000/api/employees
```

Expected: `[]` (empty array — no employees yet). If you get `Cannot GET /api/employees`, the route wiring in `index.js` is wrong.

- [ ] **Step 7: Confirm the 404 envelope**

```bash
curl -s http://localhost:3000/api/definitely-not-real
```

Expected:
```json
{"error":{"code":"NOT_FOUND","message":"No route for GET /api/definitely-not-real","details":null}}
```

- [ ] **Step 8: Confirm CORS allows the frontend origin with credentials**

```bash
curl -s -I -X OPTIONS http://localhost:3000/api/employees \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET"
```

Expected headers (among others):
```
access-control-allow-origin: http://localhost:5173
access-control-allow-credentials: true
```

- [ ] **Step 9: Stop the server**

In the `npm run dev` terminal: Ctrl-C.

### Recovery (if sync fails at Step 2)

Most common cause: an existing column has data that violates a new constraint (e.g. existing `Employees.email` is globally unique but two rows have the same email across companies). Fix:

1. Drop the database fully (Step 1 above) — this discards all data.
2. Re-run `npm run dev`.
3. If it still fails, read the error: it names the table + constraint. Open the relevant model file and confirm it matches the code in Tasks 14–27.

---

## Done

After Task 29, the API:

- Boots cleanly with `npm run dev`.
- Has the multi-tenant schema in place (every tenant-scoped table has `company_id`, composite uniques on `(company_id, email)` etc).
- Has new tables: `users` (auth subject), `refresh_tokens`, `password_reset_tokens`, `invites`, `audit_log`, `team_members`.
- Has the production middleware pipeline (helmet, CORS-with-credentials, cookie parsing, JSON body, structured logging, centralized error handling).
- Has the `taskRoutes` double-prefix bug fixed.
- Has Product/Category/old-User scaffolding removed.
- Returns the spec's error envelope for 404s.

**What does NOT work yet** (by design — those are Plan 2+):

- No auth endpoints — `/api/auth/signup`, `/api/auth/login`, `/api/me` don't exist yet.
- Existing CRUD routes work but don't enforce tenancy and don't write to `audit_log`.
- Old `Employee.createEmployee` controller will fail on POST because it doesn't set `company_id` — Plan 3 rewrites all controllers to use `req.scope(Model)`.
- No emails, no invites, no dashboard read-models.

**Next plan:** Plan 2 — auth (signup, login, employee PIN login, refresh, logout), `/me`, JWT cookies, `requireAuth` + `requireRole` + `requireTenant` middleware, RBAC.
