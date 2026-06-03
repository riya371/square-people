# API Plan 2 — Auth, Tenancy, RBAC & /me (M3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the auth + tenancy layer on top of Plan 1's foundation. After this plan, owner signup, owner login (with workspace resolution), employee PIN login, JWT refresh, logout, password reset (with console-stub email), and the `/me` endpoint all work end-to-end. The frontend can stop using its mock `useSession` and call the real API.

**Architecture:**
- Sessions: short-lived access JWT in `sp_access` cookie (15 min), long-lived refresh JWT in `sp_refresh` cookie (30 days), refresh tokens persisted hashed in `refresh_tokens` for server-side revoke.
- Tenancy: `requireTenant` middleware exposes `req.scope(Model)` which auto-injects `where: { company_id: req.user.companyId }` into Sequelize queries.
- RBAC: hierarchical roles (`owner` > `admin` > `manager` > `member`) checked via `requireRole(min)`.
- Email: pluggable `EmailService` interface. Console driver in this plan (logs the email payload + magic link). Resend driver swaps in during Plan 4.

**Tech Stack:** Express 5, Sequelize 6, PostgreSQL. New deps in this plan: `jsonwebtoken`, `bcryptjs`. Reused from Plan 1: `cookie-parser`, `helmet`, `cors`, `zod`, `pino-http`, `dotenv`.

**Spec reference:** `api/docs/superpowers/specs/2026-05-21-api-completion-design.md` §§7–11, §15.

**Conventions:** Same as Plan 1 — absolute paths, smoke tests via `curl` + `psql`, no git commits, no automated test framework. "Run from `api/`" means `cd api && <command>`.

**Smoke-test cookie jar:** several tasks pipe `curl -b cookies.txt -c cookies.txt` to persist cookies across requests. The jar lives at `/tmp/sp-cookies.txt` for the duration of testing.

---

## Task 1: Install auth dependencies

**Files:**
- Modify: `api/package.json`

- [ ] **Step 1: Install bcryptjs + jsonwebtoken**

From `api/`:
```bash
npm install bcryptjs jsonwebtoken
```

- [ ] **Step 2: Verify both appear in `dependencies`**

```bash
grep -E '"(bcryptjs|jsonwebtoken)"' api/package.json
```

Expected: two matching lines, both under `"dependencies"`.

---

## Task 2: Wire env vars for JWT + cookies (make required)

In Plan 1, `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` were optional. Now they're required. Also need a `BCRYPT_SALT_ROUNDS` for tunable hash cost.

**Files:**
- Modify: `api/config/env.js`
- Modify: `api/.env.example`
- Modify: `api/.env` (the user's local copy)

- [ ] **Step 1: Update `api/config/env.js`**

In the Zod schema, change the JWT secret lines from `.optional()` to `.min(16, 'must be at least 16 chars')`, and add `BCRYPT_SALT_ROUNDS`:

```javascript
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 chars'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 chars'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),
```

- [ ] **Step 2: Update `api/.env.example`**

Find the `# --- Auth ---` block and update it to:

```
# --- Auth ---
JWT_ACCESS_SECRET=change_me_to_a_long_random_string_at_least_16_chars
JWT_REFRESH_SECRET=change_me_to_a_different_long_random_string_16chars
COOKIE_DOMAIN=localhost
COOKIE_SECURE=false
BCRYPT_SALT_ROUNDS=10
```

- [ ] **Step 3: Update `api/.env` if it doesn't already have valid secrets**

If your local `api/.env` has empty or placeholder JWT secrets, generate real ones:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run twice; paste the two values into `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` in `api/.env`.

- [ ] **Step 4: Smoke test env loads**

```bash
cd api && node -e "console.log(Object.keys(require('./config/env')))"
```

Expected: list of env keys including `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `BCRYPT_SALT_ROUNDS`. If it errors, secrets are too short — fix in `.env`.

---

## Task 3: Create `utils/password.js`

**Files:**
- Create: `api/utils/password.js`

- [ ] **Step 1: Create `api/utils/password.js`**

```javascript
const bcrypt = require('bcryptjs');
const env = require('../config/env');

async function hashPassword(plain) {
  return bcrypt.hash(plain, env.BCRYPT_SALT_ROUNDS);
}

async function verifyPassword(plain, hash) {
  if (!plain || !hash) return false;
  return bcrypt.compare(plain, hash);
}

module.exports = { hashPassword, verifyPassword };
```

- [ ] **Step 2: Smoke test**

From `api/`:
```bash
node -e "(async () => { const { hashPassword, verifyPassword } = require('./utils/password'); const h = await hashPassword('hunter2'); console.log('hash len:', h.length, 'verify ok:', await verifyPassword('hunter2', h), 'verify bad:', await verifyPassword('hunter3', h)); })()"
```

Expected: `hash len: 60 verify ok: true verify bad: false`.

---

## Task 4: Create `utils/pin.js`

**Files:**
- Create: `api/utils/pin.js`

- [ ] **Step 1: Create `api/utils/pin.js`**

```javascript
const bcrypt = require('bcryptjs');
const env = require('../config/env');

const PIN_REGEX = /^\d{4}$/;

function isValidPin(pin) {
  return typeof pin === 'string' && PIN_REGEX.test(pin);
}

async function hashPin(pin) {
  if (!isValidPin(pin)) throw new Error('PIN must be exactly 4 digits.');
  return bcrypt.hash(pin, env.BCRYPT_SALT_ROUNDS);
}

async function verifyPin(pin, hash) {
  if (!isValidPin(pin) || !hash) return false;
  return bcrypt.compare(pin, hash);
}

module.exports = { isValidPin, hashPin, verifyPin };
```

- [ ] **Step 2: Smoke test**

From `api/`:
```bash
node -e "(async () => { const p = require('./utils/pin'); const h = await p.hashPin('1234'); console.log('valid:', p.isValidPin('1234'), 'invalid str:', p.isValidPin('12345'), 'verify:', await p.verifyPin('1234', h), 'wrong:', await p.verifyPin('0000', h)); })()"
```

Expected: `valid: true invalid str: false verify: true wrong: false`.

---

## Task 5: Create `utils/jwt.js`

Handles access + refresh token signing, verification, and SHA-256 hashing for refresh-token DB storage.

**Files:**
- Create: `api/utils/jwt.js`

- [ ] **Step 1: Create `api/utils/jwt.js`**

```javascript
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { randomUUID } = require('crypto');
const env = require('../config/env');

const ACCESS_TTL_SEC = 15 * 60; // 15 minutes
const REFRESH_TTL_SEC = 30 * 24 * 60 * 60; // 30 days

function signAccessToken({ userId, role, companyId, employeeId }) {
  return jwt.sign(
    {
      sub: userId,
      role,
      companyId,
      employeeId: employeeId ?? null,
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TTL_SEC, jwtid: randomUUID() },
  );
}

function signRefreshToken({ userId, role, companyId, employeeId }) {
  const jti = randomUUID();
  const token = jwt.sign(
    {
      sub: userId,
      role,
      companyId,
      employeeId: employeeId ?? null,
      type: 'refresh',
    },
    env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TTL_SEC, jwtid: jti },
  );
  return { token, jti };
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  ACCESS_TTL_SEC,
  REFRESH_TTL_SEC,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
};
```

- [ ] **Step 2: Smoke test**

From `api/`:
```bash
node -e "const j = require('./utils/jwt'); const t = j.signAccessToken({userId:1, role:'owner', companyId:1, employeeId:1}); console.log('token len:', t.length); const d = j.verifyAccessToken(t); console.log('decoded:', d); const r = j.signRefreshToken({userId:1, role:'owner', companyId:1, employeeId:1}); console.log('refresh jti:', r.jti, 'hash:', j.hashToken(r.token).slice(0,12)+'...');"
```

Expected: a non-zero token length, decoded payload showing `{ sub: 1, role: 'owner', companyId: 1, employeeId: 1, iat, exp, jti }`, refresh `jti` (uuid), 12-char hex hash prefix.

---

## Task 6: Create `utils/cookies.js`

Centralised helpers to set/clear the two session cookies with the right flags.

**Files:**
- Create: `api/utils/cookies.js`

- [ ] **Step 1: Create `api/utils/cookies.js`**

```javascript
const env = require('../config/env');
const { ACCESS_TTL_SEC, REFRESH_TTL_SEC } = require('./jwt');

const baseFlags = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'lax',
  domain: env.COOKIE_DOMAIN,
};

function setAccessCookie(res, token) {
  res.cookie('sp_access', token, {
    ...baseFlags,
    path: '/',
    maxAge: ACCESS_TTL_SEC * 1000,
  });
}

function setRefreshCookie(res, token) {
  res.cookie('sp_refresh', token, {
    ...baseFlags,
    path: '/api/auth',
    maxAge: REFRESH_TTL_SEC * 1000,
  });
}

function clearAuthCookies(res) {
  res.clearCookie('sp_access', { ...baseFlags, path: '/' });
  res.clearCookie('sp_refresh', { ...baseFlags, path: '/api/auth' });
}

module.exports = { setAccessCookie, setRefreshCookie, clearAuthCookies };
```

---

## Task 7: Create `utils/mailer.js` (console stub)

Pluggable email interface. Console driver for now (logs the rendered email + any links); Resend driver swaps in during Plan 4.

**Files:**
- Create: `api/utils/mailer.js`

- [ ] **Step 1: Create `api/utils/mailer.js`**

```javascript
const env = require('../config/env');

// Minimal mustache substitution: replaces {{key}} with data[key].
function render(template, data) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => (data[k] ?? ''));
}

const TEMPLATES = {
  'password-reset': {
    subject: 'Reset your SquarePeople password',
    text: `Hi {{name}},

Reset your password using the link below. The link expires in 30 minutes.

{{resetUrl}}

If you didn't request this, ignore this email.

— SquarePeople by Square Feet`,
  },
  invite: {
    subject: 'You\'re invited to join {{companyName}} on SquarePeople',
    text: `Hi,

{{inviterName}} invited you to join {{companyName}} on SquarePeople.

Accept the invite (expires in 7 days):

{{acceptUrl}}

— SquarePeople by Square Feet`,
  },
};

class ConsoleMailer {
  async send({ to, template, data }) {
    const t = TEMPLATES[template];
    if (!t) throw new Error(`Unknown email template: ${template}`);
    const subject = render(t.subject, data);
    const text = render(t.text, data);
    // eslint-disable-next-line no-console
    console.log('\n=== [ConsoleMailer] ===');
    console.log(`To:      ${to}`);
    console.log(`From:    ${env.RESEND_FROM ?? 'SquarePeople <no-reply@example.test>'}`);
    console.log(`Subject: ${subject}`);
    console.log('---');
    console.log(text);
    console.log('=== end ===\n');
    return { delivered: 'console', to, subject };
  }
}

// Plan 4 will export a ResendMailer with the same interface.
function makeMailer() {
  if (env.MAIL_DRIVER === 'resend') {
    // Resend driver not implemented yet (Plan 4). Fall back to console.
    return new ConsoleMailer();
  }
  return new ConsoleMailer();
}

module.exports = { mailer: makeMailer() };
```

- [ ] **Step 2: Smoke test**

From `api/`:
```bash
node -e "(async () => { const { mailer } = require('./utils/mailer'); await mailer.send({ to: 'test@example.com', template: 'password-reset', data: { name: 'Test User', resetUrl: 'http://localhost:5173/reset-password?token=abc' } }); })()"
```

Expected: the console prints the formatted email block with To/From/Subject/body and the reset URL.

---

## Task 8: Create `middleware/requireAuth.js`

**Files:**
- Create: `api/middleware/requireAuth.js`

- [ ] **Step 1: Create `api/middleware/requireAuth.js`**

```javascript
const { verifyAccessToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');

function requireAuth(req, _res, next) {
  const token = req.cookies?.sp_access;
  if (!token) return next(AppError.unauthenticated('No access token.'));
  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      role: payload.role,
      companyId: payload.companyId,
      employeeId: payload.employeeId,
    };
    next();
  } catch (_err) {
    return next(AppError.unauthenticated('Invalid or expired access token.'));
  }
}

module.exports = requireAuth;
```

---

## Task 9: Create `middleware/requireRole.js`

**Files:**
- Create: `api/middleware/requireRole.js`

- [ ] **Step 1: Create `api/middleware/requireRole.js`**

```javascript
const AppError = require('../utils/AppError');

const HIERARCHY = ['member', 'manager', 'admin', 'owner'];

function requireRole(minRole) {
  const minRank = HIERARCHY.indexOf(minRole);
  if (minRank === -1) throw new Error(`Unknown role: ${minRole}`);

  return (req, _res, next) => {
    if (!req.user?.role) return next(AppError.unauthenticated());
    const userRank = HIERARCHY.indexOf(req.user.role);
    if (userRank < minRank) {
      return next(AppError.forbidden(`Requires ${minRole} or higher.`));
    }
    next();
  };
}

module.exports = requireRole;
```

---

## Task 10: Create `middleware/requireTenant.js`

Exposes `req.scope(Model)` — a thin wrapper that auto-injects `{ where: { company_id } }` into the four most-used Sequelize calls.

**Files:**
- Create: `api/middleware/requireTenant.js`

- [ ] **Step 1: Create `api/middleware/requireTenant.js`**

```javascript
const AppError = require('../utils/AppError');

function makeScope(companyId) {
  function withTenant(opts = {}) {
    const where = { ...(opts.where || {}), company_id: companyId };
    return { ...opts, where };
  }

  return function scope(Model) {
    return {
      findAll: (opts) => Model.findAll(withTenant(opts)),
      findOne: (opts) => Model.findOne(withTenant(opts)),
      findByPk: (id, opts = {}) =>
        Model.findOne({ ...opts, where: { ...(opts.where || {}), [Model.primaryKeyAttribute]: id, company_id: companyId } }),
      count: (opts) => Model.count(withTenant(opts)),
      create: (values, opts = {}) => Model.create({ ...values, company_id: companyId }, opts),
      update: (values, opts) => Model.update(values, withTenant(opts)),
      destroy: (opts) => Model.destroy(withTenant(opts)),
    };
  };
}

function requireTenant(req, _res, next) {
  if (!req.user?.companyId) {
    return next(AppError.unauthenticated('No tenant context.'));
  }
  req.scope = makeScope(req.user.companyId);
  next();
}

module.exports = requireTenant;
```

---

## Task 11: Create `validators/authValidators.js`

**Files:**
- Create: `api/validators/authValidators.js`

- [ ] **Step 1: Create `api/validators/authValidators.js`**

```javascript
const { z } = require('zod');

const SLUG_REGEX = /^[a-z0-9-]+$/;

const signupSchema = z.object({
  fullName: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  companyName: z.string().min(1).max(120),
  workspaceSlug: z.string().min(2).max(64).regex(SLUG_REGEX, 'Slug must be lowercase letters, digits, or hyphens.'),
  companySize: z.string().max(40).optional(),
  industry: z.string().max(60).optional(),
  workdays: z.array(z.string().min(1)).max(7).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  workspaceSlug: z.string().regex(SLUG_REGEX).optional(),
});

const employeeLoginSchema = z.object({
  companySlug: z.string().regex(SLUG_REGEX),
  employeeCode: z.string().min(1).max(40),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits.'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(8),
});

module.exports = {
  signupSchema,
  loginSchema,
  employeeLoginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
```

---

## Task 12: `/auth/signup` — controller + route + wire + smoke

The biggest auth task. Creates `Company` + founding `Employee` + `User` atomically in a single transaction, then logs the user in.

**Files:**
- Create: `api/controllers/authController.js`
- Create: `api/routes/authRoutes.js`
- Modify: `api/index.js` (add `app.use('/api/auth', authRoutes)`)

- [ ] **Step 1: Create `api/controllers/authController.js`**

```javascript
const sequelize = require('../config/database');
const { Company, Employee, User, RefreshToken } = require('../association');
const { hashPassword } = require('../utils/password');
const { signAccessToken, signRefreshToken, hashToken, REFRESH_TTL_SEC } = require('../utils/jwt');
const { setAccessCookie, setRefreshCookie } = require('../utils/cookies');
const AppError = require('../utils/AppError');

function toUserDto(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    employeeId: user.employee_id,
    companyId: user.company_id,
    lastLoginAt: user.last_login_at,
  };
}

function toCompanyDto(company) {
  return {
    id: company.company_id,
    slug: company.slug,
    name: company.name,
    industry: company.industry,
    companySize: company.companySize,
    workingDays: company.workingDays,
    workingHours: company.workingHours,
  };
}

async function issueSession(res, user, req) {
  const access = signAccessToken({
    userId: user.id,
    role: user.role,
    companyId: user.company_id,
    employeeId: user.employee_id,
  });
  const { token: refresh, jti } = signRefreshToken({
    userId: user.id,
    role: user.role,
    companyId: user.company_id,
    employeeId: user.employee_id,
  });
  await RefreshToken.create({
    user_id: user.id,
    token_hash: hashToken(refresh),
    expires_at: new Date(Date.now() + REFRESH_TTL_SEC * 1000),
    ip: req.ip,
    ua: req.headers['user-agent'] || null,
  });
  setAccessCookie(res, access);
  setRefreshCookie(res, refresh);
}

const authController = {
  signup: async (req, res, next) => {
    const { fullName, email, password, companyName, workspaceSlug, companySize, industry, workdays } = req.body;
    try {
      const result = await sequelize.transaction(async (t) => {
        // Slug must be globally unique
        const slugTaken = await Company.findOne({ where: { slug: workspaceSlug }, transaction: t });
        if (slugTaken) throw AppError.conflict('WORKSPACE_SLUG_TAKEN', 'That workspace URL is taken.');

        const company = await Company.create(
          {
            name: companyName,
            email,
            slug: workspaceSlug,
            industry: industry || null,
            companySize: companySize || null,
            workingDays: workdays ? workdays.join(',') : null,
          },
          { transaction: t },
        );

        const employee = await Employee.create(
          {
            company_id: company.company_id,
            name: fullName,
            email,
            status: 'active',
            hire_date: new Date().toISOString().slice(0, 10),
          },
          { transaction: t },
        );

        const user = await User.create(
          {
            company_id: company.company_id,
            employee_id: employee.employee_id,
            email,
            password_hash: await hashPassword(password),
            role: 'owner',
          },
          { transaction: t },
        );

        return { company, employee, user };
      });

      await issueSession(res, result.user, req);
      res.status(201).json({
        user: toUserDto(result.user),
        company: toCompanyDto(result.company),
      });
    } catch (err) {
      if (err instanceof AppError) return next(err);
      if (err?.name === 'SequelizeUniqueConstraintError') {
        return next(AppError.conflict('EMAIL_TAKEN', 'An account with that email already exists in this workspace.'));
      }
      next(err);
    }
  },
};

module.exports = authController;
```

- [ ] **Step 2: Create `api/routes/authRoutes.js`**

```javascript
const express = require('express');
const router = express.Router();
const validate = require('../middleware/validate');
const { signupSchema } = require('../validators/authValidators');
const authController = require('../controllers/authController');

router.post('/signup', validate({ body: signupSchema }), authController.signup);

module.exports = router;
```

- [ ] **Step 3: Wire into `api/index.js`**

Find the existing block of `app.use('/api/...', ...)` calls. ABOVE the first `app.use('/api/companies', ...)` line, add:

```javascript
const authRoutes = require('./routes/authRoutes');
// ...
app.use('/api/auth', authRoutes);
```

(The `require` goes with the other route requires near the top; the `app.use` goes with the other `app.use` lines.)

- [ ] **Step 4: Boot the server (background) and smoke test**

From `api/`:
```bash
npm run dev &      # or use the Bash run_in_background option
```

Wait for `Server running on http://localhost:3000`. Then:

```bash
curl -s -c /tmp/sp-cookies.txt -X POST http://localhost:3000/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"fullName":"Desmond Kuet","email":"desmond@squarefeet.com","password":"hunter22","companyName":"Square Feet LTD","workspaceSlug":"square-feet","companySize":"11-50","industry":"Technology","workdays":["Mon","Tue","Wed","Thu","Fri"]}'
```

Expected response (HTTP 201):
```json
{"user":{"id":1,"email":"desmond@squarefeet.com","role":"owner","employeeId":1,"companyId":1,...},"company":{"id":1,"slug":"square-feet","name":"Square Feet LTD",...}}
```

And `/tmp/sp-cookies.txt` should now contain `sp_access` and `sp_refresh` cookies.

- [ ] **Step 5: Verify the bad-input path**

```bash
curl -s -X POST http://localhost:3000/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"not-an-email","password":"x"}'
```

Expected: HTTP 400 with `{"error":{"code":"VALIDATION_FAILED","message":"Validation failed.","details":[...]}}`.

- [ ] **Step 6: Verify the slug-taken path**

Re-run Step 4's curl (same payload). Expected: HTTP 409 with `{"error":{"code":"WORKSPACE_SLUG_TAKEN",...}}`.

- [ ] **Step 7: Kill the server**

Stop the backgrounded `npm run dev`.

---

## Task 13: `/auth/login` — owner email/password login with workspace resolution

**Files:**
- Modify: `api/controllers/authController.js`
- Modify: `api/routes/authRoutes.js`

- [ ] **Step 1: Add `login` to `api/controllers/authController.js`**

Add this method to the `authController` object (alongside `signup`):

```javascript
  login: async (req, res, next) => {
    const { email, password, workspaceSlug } = req.body;
    try {
      let user;

      if (workspaceSlug) {
        const company = await Company.findOne({ where: { slug: workspaceSlug } });
        if (!company) return next(AppError.unauthenticated('Workspace not found.'));
        user = await User.findOne({ where: { company_id: company.company_id, email } });
      } else {
        const matches = await User.findAll({ where: { email } });
        if (matches.length === 0) return next(AppError.unauthenticated('Invalid email or password.'));
        if (matches.length > 1) {
          const companies = await Company.findAll({
            where: { company_id: matches.map((m) => m.company_id) },
            attributes: ['company_id', 'slug', 'name'],
          });
          return next(
            AppError.conflict('MULTIPLE_WORKSPACES', 'This email is in multiple workspaces. Specify workspaceSlug.', {
              companies: companies.map((c) => ({ slug: c.slug, name: c.name })),
            }),
          );
        }
        user = matches[0];
      }

      const { verifyPassword } = require('../utils/password');
      if (!user || !(await verifyPassword(password, user.password_hash))) {
        return next(AppError.unauthenticated('Invalid email or password.'));
      }

      await user.update({ last_login_at: new Date(), last_login_ip: req.ip });
      await issueSession(res, user, req);

      const company = await Company.findByPk(user.company_id);
      res.json({ user: toUserDto(user), company: toCompanyDto(company) });
    } catch (err) {
      next(err);
    }
  },
```

- [ ] **Step 2: Add the route**

In `api/routes/authRoutes.js`, import `loginSchema` and add the route:

```javascript
const { signupSchema, loginSchema } = require('../validators/authValidators');
// ...
router.post('/login', validate({ body: loginSchema }), authController.login);
```

- [ ] **Step 3: Smoke test the happy path**

Boot the server. Then:
```bash
curl -s -c /tmp/sp-cookies-login.txt -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"desmond@squarefeet.com","password":"hunter22","workspaceSlug":"square-feet"}'
```

Expected: HTTP 200, returns `{ user, company }`, sets cookies. `last_login_at` updated.

- [ ] **Step 4: Smoke test wrong password**

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"desmond@squarefeet.com","password":"wrong","workspaceSlug":"square-feet"}'
```

Expected: HTTP 401 with `{"error":{"code":"UNAUTHENTICATED","message":"Invalid email or password.",...}}`.

- [ ] **Step 5: Smoke test workspace omitted, single match**

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"desmond@squarefeet.com","password":"hunter22"}'
```

Expected: HTTP 200 (only one user with that email so resolution succeeds).

- [ ] **Step 6: Kill the server**

---

## Task 14: `/auth/employee-login` — PIN-based kiosk login

**Files:**
- Modify: `api/controllers/authController.js`
- Modify: `api/routes/authRoutes.js`

- [ ] **Step 1: Add `employeeLogin` to `authController`**

```javascript
  employeeLogin: async (req, res, next) => {
    const { companySlug, employeeCode, pin } = req.body;
    try {
      const company = await Company.findOne({ where: { slug: companySlug } });
      if (!company) return next(AppError.unauthenticated('Invalid credentials.'));

      const employee = await Employee.findOne({
        where: { company_id: company.company_id, employee_code: employeeCode },
      });
      if (!employee) return next(AppError.unauthenticated('Invalid credentials.'));

      const user = await User.findOne({ where: { employee_id: employee.employee_id } });
      if (!user) return next(AppError.unauthenticated('Invalid credentials.'));

      const { verifyPin } = require('../utils/pin');
      if (!(await verifyPin(pin, user.pin_hash))) {
        return next(AppError.unauthenticated('Invalid credentials.'));
      }

      await user.update({ last_login_at: new Date(), last_login_ip: req.ip });
      await issueSession(res, user, req);
      res.json({ user: toUserDto(user), company: toCompanyDto(company) });
    } catch (err) {
      next(err);
    }
  },
```

- [ ] **Step 2: Add the route**

In `routes/authRoutes.js`, import `employeeLoginSchema` and add:

```javascript
const { signupSchema, loginSchema, employeeLoginSchema } = require('../validators/authValidators');
// ...
router.post('/employee-login', validate({ body: employeeLoginSchema }), authController.employeeLogin);
```

- [ ] **Step 3: Set up a test employee with a PIN**

Use `psql` to assign an employee_code + PIN to the founder Employee created in Task 12:

```bash
# From a node REPL or one-off script
cd api
node -e "(async () => {
  const { User, Employee } = require('./association');
  const { hashPin } = require('./utils/pin');
  const e = await Employee.findOne({ where: { email: 'desmond@squarefeet.com' } });
  await e.update({ employee_code: 'EMP-0001' });
  const u = await User.findOne({ where: { employee_id: e.employee_id } });
  await u.update({ pin_hash: await hashPin('1234') });
  console.log('Employee', e.employee_id, 'code', e.employee_code, 'PIN set.');
  process.exit(0);
})();"
```

Expected: `Employee 1 code EMP-0001 PIN set.`

- [ ] **Step 4: Smoke test employee login**

Boot the server. Then:
```bash
curl -s -c /tmp/sp-cookies-emp.txt -X POST http://localhost:3000/api/auth/employee-login \
  -H 'Content-Type: application/json' \
  -d '{"companySlug":"square-feet","employeeCode":"EMP-0001","pin":"1234"}'
```

Expected: HTTP 200 with `{user, company}`, cookies set.

- [ ] **Step 5: Wrong PIN**

```bash
curl -s -X POST http://localhost:3000/api/auth/employee-login \
  -H 'Content-Type: application/json' \
  -d '{"companySlug":"square-feet","employeeCode":"EMP-0001","pin":"0000"}'
```

Expected: HTTP 401 with `INVALID_CREDENTIALS` / `UNAUTHENTICATED`.

- [ ] **Step 6: Kill the server**

---

## Task 15: `/auth/refresh` — rotate tokens

**Files:**
- Modify: `api/controllers/authController.js`
- Modify: `api/routes/authRoutes.js`

- [ ] **Step 1: Add `refresh` to `authController`**

```javascript
  refresh: async (req, res, next) => {
    const token = req.cookies?.sp_refresh;
    if (!token) return next(AppError.unauthenticated('No refresh token.'));
    try {
      const { verifyRefreshToken } = require('../utils/jwt');
      const payload = verifyRefreshToken(token);
      const tokenHash = hashToken(token);
      const row = await RefreshToken.findOne({ where: { user_id: payload.sub, token_hash: tokenHash } });
      if (!row || row.revoked_at || row.expires_at < new Date()) {
        return next(AppError.unauthenticated('Refresh token expired or revoked.'));
      }
      const user = await User.findByPk(payload.sub);
      if (!user) return next(AppError.unauthenticated('User no longer exists.'));

      // Rotate: revoke old, issue new
      await row.update({ revoked_at: new Date() });
      await issueSession(res, user, req);
      res.json({ ok: true });
    } catch (_err) {
      return next(AppError.unauthenticated('Invalid refresh token.'));
    }
  },
```

- [ ] **Step 2: Add the route**

```javascript
router.post('/refresh', authController.refresh);
```

- [ ] **Step 3: Smoke test the rotation**

Boot. Use the cookie jar from Task 13 (login):
```bash
curl -s -b /tmp/sp-cookies-login.txt -c /tmp/sp-cookies-login.txt -X POST http://localhost:3000/api/auth/refresh
```

Expected: HTTP 200, `{"ok":true}`. The jar's `sp_access` and `sp_refresh` cookies should both have new values.

- [ ] **Step 4: Reuse the OLD refresh token (should fail)**

If you saved the old refresh token, send it again — it should return 401 because the old `refresh_tokens` row is now `revoked_at`-stamped.

- [ ] **Step 5: Kill the server**

---

## Task 16: `/auth/logout` + `/auth/logout-all`

**Files:**
- Modify: `api/controllers/authController.js`
- Modify: `api/routes/authRoutes.js`
- Modify: `api/index.js` (we need `requireAuth` available for these routes)

- [ ] **Step 1: Add to `authController`**

```javascript
  logout: async (req, res, next) => {
    try {
      const token = req.cookies?.sp_refresh;
      if (token) {
        await RefreshToken.update({ revoked_at: new Date() }, { where: { user_id: req.user.id, token_hash: hashToken(token) } });
      }
      const { clearAuthCookies } = require('../utils/cookies');
      clearAuthCookies(res);
      res.json({ ok: true });
    } catch (err) { next(err); }
  },

  logoutAll: async (req, res, next) => {
    try {
      await RefreshToken.update(
        { revoked_at: new Date() },
        { where: { user_id: req.user.id, revoked_at: null } },
      );
      const { clearAuthCookies } = require('../utils/cookies');
      clearAuthCookies(res);
      res.json({ ok: true });
    } catch (err) { next(err); }
  },
```

- [ ] **Step 2: Add the routes (both behind requireAuth)**

Update `api/routes/authRoutes.js`:

```javascript
const express = require('express');
const router = express.Router();
const validate = require('../middleware/validate');
const requireAuth = require('../middleware/requireAuth');
const {
  signupSchema,
  loginSchema,
  employeeLoginSchema,
} = require('../validators/authValidators');
const authController = require('../controllers/authController');

router.post('/signup', validate({ body: signupSchema }), authController.signup);
router.post('/login', validate({ body: loginSchema }), authController.login);
router.post('/employee-login', validate({ body: employeeLoginSchema }), authController.employeeLogin);
router.post('/refresh', authController.refresh);
router.post('/logout', requireAuth, authController.logout);
router.post('/logout-all', requireAuth, authController.logoutAll);

module.exports = router;
```

- [ ] **Step 3: Smoke test logout**

Boot. With the cookie jar from Task 13:
```bash
curl -s -b /tmp/sp-cookies-login.txt -c /tmp/sp-cookies-login.txt -X POST http://localhost:3000/api/auth/logout
```

Expected: HTTP 200 `{"ok":true}`. The jar's `sp_access` and `sp_refresh` should now be empty.

- [ ] **Step 4: Confirm refresh now fails**

```bash
curl -s -b /tmp/sp-cookies-login.txt -X POST http://localhost:3000/api/auth/refresh
```

Expected: HTTP 401 (the refresh token was revoked on logout).

- [ ] **Step 5: Kill the server**

---

## Task 17: `/auth/forgot-password` + `/auth/reset-password`

**Files:**
- Modify: `api/controllers/authController.js`
- Modify: `api/routes/authRoutes.js`

- [ ] **Step 1: Add to `authController`**

```javascript
  forgotPassword: async (req, res, next) => {
    const { email } = req.body;
    try {
      const users = await User.findAll({ where: { email } });
      // Always respond 200 regardless to avoid email enumeration.
      for (const user of users) {
        const { PasswordResetToken } = require('../association');
        const crypto = require('crypto');
        const raw = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashToken(raw);
        await PasswordResetToken.create({
          user_id: user.id,
          token_hash: tokenHash,
          expires_at: new Date(Date.now() + 30 * 60 * 1000),
        });
        const { mailer } = require('../utils/mailer');
        const env = require('../config/env');
        const employee = user.employee_id ? await Employee.findByPk(user.employee_id) : null;
        await mailer.send({
          to: user.email,
          template: 'password-reset',
          data: {
            name: employee?.name || 'there',
            resetUrl: `${env.FRONTEND_URL}/reset-password?token=${raw}`,
          },
        });
      }
      res.json({ ok: true });
    } catch (err) { next(err); }
  },

  resetPassword: async (req, res, next) => {
    const { token, newPassword } = req.body;
    try {
      const { PasswordResetToken } = require('../association');
      const tokenHash = hashToken(token);
      const row = await PasswordResetToken.findOne({ where: { token_hash: tokenHash } });
      if (!row || row.used_at || row.expires_at < new Date()) {
        return next(AppError.badRequest('Reset link is invalid or expired.'));
      }
      const user = await User.findByPk(row.user_id);
      if (!user) return next(AppError.notFound('User'));
      await user.update({ password_hash: await hashPassword(newPassword) });
      await row.update({ used_at: new Date() });
      // Revoke all existing refresh tokens for safety.
      await RefreshToken.update({ revoked_at: new Date() }, { where: { user_id: user.id, revoked_at: null } });
      res.json({ ok: true });
    } catch (err) { next(err); }
  },
```

The top of `authController.js` will also need:

```javascript
const { hashPassword } = require('../utils/password');
```

(Already there from Task 12; verify it's present.)

- [ ] **Step 2: Add the routes**

In `routes/authRoutes.js`:

```javascript
const {
  signupSchema, loginSchema, employeeLoginSchema,
  forgotPasswordSchema, resetPasswordSchema,
} = require('../validators/authValidators');
// ...
router.post('/forgot-password', validate({ body: forgotPasswordSchema }), authController.forgotPassword);
router.post('/reset-password', validate({ body: resetPasswordSchema }), authController.resetPassword);
```

- [ ] **Step 3: Smoke test forgot-password**

Boot. Then:
```bash
curl -s -X POST http://localhost:3000/api/auth/forgot-password \
  -H 'Content-Type: application/json' \
  -d '{"email":"desmond@squarefeet.com"}'
```

Expected response: HTTP 200 `{"ok":true}`. In the server log you'll see the ConsoleMailer block containing the `resetUrl` with a `?token=<64-hex>`. Copy the token value.

- [ ] **Step 4: Smoke test reset-password**

Using the token from Step 3:
```bash
curl -s -X POST http://localhost:3000/api/auth/reset-password \
  -H 'Content-Type: application/json' \
  -d '{"token":"<paste-the-hex-token>","newPassword":"newhunter22"}'
```

Expected: HTTP 200 `{"ok":true}`. Try logging in with the old password (Task 13 Step 4) — should still fail with 401. Try the new password — should succeed.

- [ ] **Step 5: Confirm token can't be reused**

Re-run Step 4 with the same token. Expected: HTTP 400 with `{"error":{"code":"INVALID_INPUT","message":"Reset link is invalid or expired.",...}}`.

- [ ] **Step 6: Smoke test unknown email (no enumeration leak)**

```bash
curl -s -X POST http://localhost:3000/api/auth/forgot-password \
  -H 'Content-Type: application/json' \
  -d '{"email":"nobody@nowhere.com"}'
```

Expected: HTTP 200 `{"ok":true}` (same response as a real email — no leak). Server log shows NO email block.

- [ ] **Step 7: Kill the server**

---

## Task 18: `/me` endpoints

**Files:**
- Create: `api/controllers/meController.js`
- Create: `api/routes/meRoutes.js`
- Modify: `api/index.js` (mount `/api/me`)

- [ ] **Step 1: Create `api/controllers/meController.js`**

```javascript
const { z } = require('zod');
const { User, Employee, Company } = require('../association');
const { hashPassword, verifyPassword } = require('../utils/password');
const { hashPin, isValidPin } = require('../utils/pin');
const AppError = require('../utils/AppError');

const updateMeSchema = z.object({
  // Limited safe fields only — name and phone live on Employee.
  name: z.string().min(1).max(120).optional(),
  phone: z.string().max(40).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const setPinSchema = z.object({
  currentPassword: z.string().min(1),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits.'),
});

const PERMISSIONS_BY_ROLE = {
  owner:   ['*'],
  admin:   ['employees:write', 'roles:write', 'teams:write', 'projects:write', 'tasks:write', 'leaves:approve', 'audit:read'],
  manager: ['teams:write', 'projects:write', 'tasks:write', 'leaves:approve'],
  member:  ['tasks:update_own', 'time:write', 'attendance:write', 'leaves:create'],
};

const meController = {
  getMe: async (req, res, next) => {
    try {
      const user = await User.findByPk(req.user.id);
      if (!user) return next(AppError.unauthenticated());
      const company = await Company.findByPk(user.company_id);
      const employee = user.employee_id ? await Employee.findByPk(user.employee_id) : null;
      res.json({
        user: {
          id: user.id, email: user.email, role: user.role,
          employeeId: user.employee_id, companyId: user.company_id,
          lastLoginAt: user.last_login_at,
        },
        company: company && {
          id: company.company_id, slug: company.slug, name: company.name,
          industry: company.industry, companySize: company.companySize,
          workingDays: company.workingDays, workingHours: company.workingHours,
        },
        employee: employee && {
          id: employee.employee_id, name: employee.name, email: employee.email,
          phone: employee.phone, departmentId: employee.department_id,
          employeeCode: employee.employee_code, status: employee.status,
          hireDate: employee.hire_date,
        },
        permissions: PERMISSIONS_BY_ROLE[user.role] || [],
      });
    } catch (err) { next(err); }
  },

  patchMe: async (req, res, next) => {
    try {
      const parsed = updateMeSchema.parse(req.body);
      if (!req.user.employeeId) return next(AppError.badRequest('No linked employee record.'));
      const employee = await Employee.findByPk(req.user.employeeId);
      if (!employee) return next(AppError.notFound('Employee'));
      await employee.update(parsed);
      res.json({ ok: true });
    } catch (err) {
      if (err?.issues) return next(AppError.validation(err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))));
      next(err);
    }
  },

  changePassword: async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
      const user = await User.findByPk(req.user.id);
      if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
        return next(AppError.unauthenticated('Current password is incorrect.'));
      }
      await user.update({ password_hash: await hashPassword(newPassword) });
      res.json({ ok: true });
    } catch (err) {
      if (err?.issues) return next(AppError.validation(err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))));
      next(err);
    }
  },

  setPin: async (req, res, next) => {
    try {
      const { currentPassword, pin } = setPinSchema.parse(req.body);
      const user = await User.findByPk(req.user.id);
      if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
        return next(AppError.unauthenticated('Current password is incorrect.'));
      }
      if (!isValidPin(pin)) return next(AppError.badRequest('PIN must be exactly 4 digits.'));
      await user.update({ pin_hash: await hashPin(pin) });
      res.json({ ok: true });
    } catch (err) {
      if (err?.issues) return next(AppError.validation(err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))));
      next(err);
    }
  },
};

module.exports = meController;
```

- [ ] **Step 2: Create `api/routes/meRoutes.js`**

```javascript
const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const requireTenant = require('../middleware/requireTenant');
const meController = require('../controllers/meController');

router.use(requireAuth, requireTenant);

router.get('/', meController.getMe);
router.patch('/', meController.patchMe);
router.post('/change-password', meController.changePassword);
router.post('/set-pin', meController.setPin);

module.exports = router;
```

- [ ] **Step 3: Wire into `api/index.js`**

```javascript
const meRoutes = require('./routes/meRoutes');
// ...
app.use('/api/me', meRoutes);
```

- [ ] **Step 4: Smoke test `/me`**

Boot the server. Log in first (Task 13's Step 3 cookie jar). Then:

```bash
curl -s -b /tmp/sp-cookies-login.txt http://localhost:3000/api/me
```

Expected: HTTP 200, JSON with `user`, `company`, `employee`, `permissions` (`["*"]` for owner).

- [ ] **Step 5: Confirm 401 without cookie**

```bash
curl -s http://localhost:3000/api/me
```

Expected: HTTP 401 with `{"error":{"code":"UNAUTHENTICATED","message":"No access token.",...}}`.

- [ ] **Step 6: Smoke test `PATCH /me`**

```bash
curl -s -b /tmp/sp-cookies-login.txt -X PATCH http://localhost:3000/api/me \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+91 99999 99999"}'
```

Expected: HTTP 200 `{"ok":true}`. Re-run `GET /me` and confirm `employee.phone` is now `+91 99999 99999`.

- [ ] **Step 7: Kill the server**

---

## Task 19: Companies — `GET /companies/me`, `PATCH /companies/me`, `GET /companies/me/workspace-check`

The frontend signup wizard calls `/companies/me/workspace-check?slug=...` to validate the workspace URL in real time. Other companies endpoints become useful in Plan 3, but the `me`-shape ones are needed now.

**Files:**
- Modify: `api/controllers/companyController.js` (full rewrite)
- Modify: `api/routes/companyRoutes.js`

- [ ] **Step 1: Read the existing `api/controllers/companyController.js` to understand what was there**

(Use the Read tool. Most of the existing controller is single-tenant CRUD that won't survive Plan 3 anyway — we're replacing it now with tenant-scoped endpoints.)

- [ ] **Step 2: Replace `api/controllers/companyController.js` with**

```javascript
const { z } = require('zod');
const { Company, Employee } = require('../association');
const AppError = require('../utils/AppError');

const updateCompanySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  industry: z.string().max(60).optional(),
  companySize: z.string().max(40).optional(),
  workingDays: z.string().max(40).optional(),
  workingHours: z.string().max(40).optional(),
  address: z.string().max(200).optional(),
  website: z.string().url().max(200).optional(),
  phone: z.string().max(40).optional(),
});

function toCompanyDto(company, headcount) {
  return {
    id: company.company_id,
    slug: company.slug,
    name: company.name,
    industry: company.industry,
    companySize: company.companySize,
    workingDays: company.workingDays,
    workingHours: company.workingHours,
    address: company.address,
    website: company.website,
    phone: company.phone,
    headcount: headcount ?? null,
  };
}

const companyController = {
  getMe: async (req, res, next) => {
    try {
      const company = await Company.findByPk(req.user.companyId);
      if (!company) return next(AppError.notFound('Company'));
      const headcount = await Employee.count({ where: { company_id: req.user.companyId, status: 'active' } });
      res.json(toCompanyDto(company, headcount));
    } catch (err) { next(err); }
  },

  updateMe: async (req, res, next) => {
    try {
      const parsed = updateCompanySchema.parse(req.body);
      const company = await Company.findByPk(req.user.companyId);
      if (!company) return next(AppError.notFound('Company'));
      await company.update(parsed);
      res.json(toCompanyDto(company, null));
    } catch (err) {
      if (err?.issues) return next(AppError.validation(err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))));
      next(err);
    }
  },

  workspaceCheck: async (req, res, next) => {
    try {
      const slug = String(req.query.slug || '').toLowerCase().trim();
      if (!/^[a-z0-9-]{2,64}$/.test(slug)) {
        return res.json({ available: false, reason: 'invalid_format' });
      }
      const existing = await Company.findOne({ where: { slug }, attributes: ['company_id'] });
      res.json({ available: !existing });
    } catch (err) { next(err); }
  },
};

module.exports = companyController;
```

- [ ] **Step 3: Replace `api/routes/companyRoutes.js` with**

```javascript
const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const requireTenant = require('../middleware/requireTenant');
const companyController = require('../controllers/companyController');

// Public endpoint (no auth) — used by signup wizard
router.get('/me/workspace-check', companyController.workspaceCheck);

// Authenticated tenant-scoped endpoints
router.get('/me', requireAuth, requireTenant, companyController.getMe);
router.patch('/me', requireAuth, requireTenant, requireRole('admin'), companyController.updateMe);

module.exports = router;
```

- [ ] **Step 4: Smoke test workspace-check (public)**

Boot. Then:
```bash
curl -s 'http://localhost:3000/api/companies/me/workspace-check?slug=square-feet'
curl -s 'http://localhost:3000/api/companies/me/workspace-check?slug=brand-new-slug-xyz'
```

Expected: first call `{"available":false}`, second call `{"available":true}`.

- [ ] **Step 5: Smoke test `GET /companies/me` (authenticated)**

```bash
curl -s -b /tmp/sp-cookies-login.txt http://localhost:3000/api/companies/me
```

Expected: HTTP 200, company DTO with `headcount: 1`.

- [ ] **Step 6: Smoke test `PATCH /companies/me`**

```bash
curl -s -b /tmp/sp-cookies-login.txt -X PATCH http://localhost:3000/api/companies/me \
  -H 'Content-Type: application/json' \
  -d '{"website":"https://www.squarefeetltd.com"}'
```

Expected: HTTP 200, updated DTO with `website` set.

- [ ] **Step 7: Confirm 403 if a non-admin user tries to PATCH**

(Can't easily test this yet — only the owner exists. Will validate in Plan 3 when we have more user roles.)

- [ ] **Step 8: Kill the server**

---

## Task 20: End-to-end smoke test — full user journey

This is the validation that everything in Plan 2 hangs together. We'll create a second company, prove tenancy isolation, and verify the JWT pipeline works for both owner and employee flows.

**Files:**
- (no file changes)

- [ ] **Step 1: Reset state for a clean test (optional but recommended)**

Drop and recreate the DB:
```bash
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "DROP DATABASE IF EXISTS squarepeople;"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "CREATE DATABASE squarepeople;"
```
(Substitute your actual DB_NAME from `api/.env`.)

- [ ] **Step 2: Boot the server**

```bash
cd api && npm run dev
```

Wait for "Server running on http://localhost:3000".

- [ ] **Step 3: Sign up Company A**

```bash
curl -s -c /tmp/sp-A.txt -X POST http://localhost:3000/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"fullName":"Owner A","email":"owner@a.com","password":"hunter22a","companyName":"Company A","workspaceSlug":"company-a","companySize":"11-50","industry":"Technology","workdays":["Mon","Tue","Wed","Thu","Fri"]}'
```
Expected: HTTP 201, returns owner+company DTOs.

- [ ] **Step 4: Sign up Company B**

```bash
curl -s -c /tmp/sp-B.txt -X POST http://localhost:3000/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"fullName":"Owner B","email":"owner@b.com","password":"hunter22b","companyName":"Company B","workspaceSlug":"company-b","companySize":"1-10","industry":"Marketing & Agency","workdays":["Mon","Tue","Wed","Thu","Fri"]}'
```
Expected: HTTP 201.

- [ ] **Step 5: Confirm both can read their own /me**

```bash
curl -s -b /tmp/sp-A.txt http://localhost:3000/api/me | head -c 300
curl -s -b /tmp/sp-B.txt http://localhost:3000/api/me | head -c 300
```

Expected: each returns its own company / user, never the other's.

- [ ] **Step 6: Same email in two companies → MULTIPLE_WORKSPACES**

Sign up a third person with email that exists in both Company A and Company B. First add the email to A:
```bash
# Use Sequelize directly to create another User row in Company A with email 'shared@example.com'.
cd api
node -e "(async () => {
  const { User, Employee } = require('./association');
  const { hashPassword } = require('./utils/password');
  const e = await Employee.create({ company_id: 1, name: 'Shared Person', email: 'shared@example.com', status: 'active' });
  await User.create({ company_id: 1, employee_id: e.employee_id, email: 'shared@example.com', password_hash: await hashPassword('pw'), role: 'member' });
  const e2 = await Employee.create({ company_id: 2, name: 'Shared Person', email: 'shared@example.com', status: 'active' });
  await User.create({ company_id: 2, employee_id: e2.employee_id, email: 'shared@example.com', password_hash: await hashPassword('pw'), role: 'member' });
  console.log('Created shared users in both companies.');
  process.exit(0);
})();"
```

Then try to log in without workspaceSlug:
```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"shared@example.com","password":"pw"}'
```

Expected: HTTP 409 with `{"error":{"code":"MULTIPLE_WORKSPACES","message":"...","details":{"companies":[{"slug":"company-a","name":"Company A"},{"slug":"company-b","name":"Company B"}]}}}`.

- [ ] **Step 7: Log in with workspaceSlug → succeeds**

```bash
curl -s -c /tmp/sp-shared-A.txt -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"shared@example.com","password":"pw","workspaceSlug":"company-a"}'
```

Expected: HTTP 200, returns user with `role: 'member'` and `companyId: 1`.

- [ ] **Step 8: Confirm full pipeline: refresh → /me → logout**

```bash
curl -s -b /tmp/sp-shared-A.txt -c /tmp/sp-shared-A.txt -X POST http://localhost:3000/api/auth/refresh
curl -s -b /tmp/sp-shared-A.txt http://localhost:3000/api/me | head -c 200
curl -s -b /tmp/sp-shared-A.txt -c /tmp/sp-shared-A.txt -X POST http://localhost:3000/api/auth/logout
curl -s -b /tmp/sp-shared-A.txt http://localhost:3000/api/me  # should 401 now
```

Expected: refresh `{"ok":true}`, /me returns Company A data, logout `{"ok":true}`, final /me returns 401.

- [ ] **Step 9: Kill the server**

---

## Done

After Task 20, the API:

- Has working owner signup that atomically creates `Company` + `Employee` + `User`.
- Has working email+password login with multi-workspace email resolution (and a 409 envelope listing eligible workspaces).
- Has working employee PIN login (companySlug + employeeCode + 4-digit PIN).
- Issues `sp_access` + `sp_refresh` httpOnly cookies on login; refresh rotates and revokes; logout revokes and clears.
- Has password reset via a ConsoleMailer (the reset link is printed to the server log). Plan 4 swaps the mailer for Resend with no API surface change.
- Exposes `GET /api/me`, `PATCH /api/me`, `POST /api/me/change-password`, `POST /api/me/set-pin`.
- Exposes `GET /api/companies/me`, `PATCH /api/companies/me`, and the **public** `GET /api/companies/me/workspace-check?slug=` for the signup wizard.
- Has the auth + tenancy + RBAC middleware (`requireAuth`, `requireRole`, `requireTenant`) ready for Plan 3 to use on every resource endpoint.
- Enforces multi-tenant isolation at the schema level (composite uniques work; same email can exist in two companies).

**What does NOT work yet** (by design — Plan 3):

- Existing CRUD controllers for Employees, Departments, Roles, Teams, Projects, Tasks, Subtasks, WorkTracking, Attendance, LeaveRequest, LeaveApproval are still single-tenant. They'll be rewritten in Plan 3 to use `req.scope(Model)`.
- Resource-level RBAC (e.g. "only project's manager can edit") is not enforced yet — Plan 3.
- No audit log writes yet (Plan 4).
- No invite system yet (Plan 4).
- The mailer is the ConsoleMailer; real Resend integration in Plan 4.

**Frontend follow-ups for this plan** (separate work):
- Replace `useSession.js` localStorage logic: on app boot, call `GET /api/me` with `withCredentials: true`. On 401, redirect to `/login`.
- Add a `useAuth` composable wrapping `POST /api/auth/login`, `POST /api/auth/employee-login`, `POST /api/auth/logout`.
- On signup wizard, add a debounced call to `GET /api/companies/me/workspace-check?slug=`.
- Add `/reset-password` view (consumes the reset link).
- Handle the 409 `MULTIPLE_WORKSPACES` response on login with a company-picker UI.
- Set `axios.defaults.withCredentials = true` globally.
