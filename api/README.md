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
