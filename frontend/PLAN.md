# SquarePeople — Frontend Plan

## 1. What we're building

**SquarePeople** is a Workforce / People-Ops platform that combines:

- **Org structure** (BambooHR-ish): Company → Department → Employee, Role (M:N), Team
- **Work management** (Asana-ish): Project ↔ Team (M:N) → Task → Subtask
- **Time & HR ops** (Toggl + leave): WorkTracking, Attendance, LeaveRequest → LeaveApproval

`User` / `Product` / `Category` are leftover scaffolding — not surfaced in the UI.

## 2. API observations to address

| # | Issue | Where | Fix |
|---|---|---|---|
| 1 | No CORS — Vite (:5173) can't talk to API (:3000) | `api/index.js` | `npm i cors` + `app.use(cors())` |
| 2 | No auth on any endpoint | global | Build around a mock `currentUser` store; design data layer to swap in JWT later |
| 3 | `/tasks` routes are double-prefixed (`/tasks/tasks/:id`) | `api/routes/taskRoutes.js` | Change inner paths from `/tasks` to `/` |
| 4 | No pagination / search / filter query params | all list endpoints | Client-side for v1; add server-side later |
| 5 | No "detail with relations" endpoints | global | Parallel-fetch in TanStack Query; or add view-model routes server-side |
| 6 | No endpoint to assign Roles to Employees (M:N) | `employeeController.js` | Add `POST /employees/:id/roles` |

## 3. Stack

```
Vite + React 18 + TypeScript
Tailwind CSS + shadcn/ui            ← components
TanStack Query                      ← server state
React Router v6                     ← routing
React Hook Form + Zod               ← forms + validation
Zustand                             ← active timer, sidebar state, mock-user
Axios                               ← HTTP (interceptors-ready for auth)
@dnd-kit/core                       ← Kanban drag-drop
Recharts                            ← dashboard charts
date-fns                            ← dates
lucide-react                        ← icons
```

Vite SPA over Next.js: internal admin tool, no SEO, tons of authenticated dashboards — tighter dev loop.

## 4. Folder structure (`/frontend`, sibling of `/api`)

```
frontend/
├── src/
│   ├── api/                   # axios client + per-resource query hooks
│   │   ├── client.ts
│   │   ├── companies.ts        departments.ts   employees.ts
│   │   ├── roles.ts            teams.ts         projects.ts
│   │   ├── tasks.ts            subtasks.ts      workTracking.ts
│   │   ├── attendance.ts       leaveRequests.ts leaveApprovals.ts
│   ├── components/
│   │   ├── ui/                # shadcn primitives
│   │   ├── layout/            # AppShell, Sidebar, Topbar, PageHeader
│   │   ├── data-table/        # generic table w/ sort, filter, pagination
│   │   ├── forms/             # FormField wrappers, EntitySelect
│   │   └── feedback/          # EmptyState, LoadingState, ErrorState
│   ├── features/              # feature-sliced
│   │   ├── dashboard/         companies/        departments/
│   │   ├── employees/         roles/            teams/
│   │   ├── projects/          tasks/            subtasks/
│   │   ├── work-tracking/     attendance/       leaves/
│   ├── routes/                # router config
│   ├── hooks/                 # useDebounce, useDisclosure
│   ├── lib/                   # formatters, date utils, zod schemas
│   ├── store/                 # zustand: timer, ui, currentUser (mock)
│   ├── types/                 # API DTOs (mirror Sequelize models)
│   ├── App.tsx
│   └── main.tsx
├── .env.local                 # VITE_API_BASE_URL=http://localhost:3000
├── index.html
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── vite.config.ts
```

## 5. Screens

| # | Module | Routes | Notes |
|---|---|---|---|
| 1 | Dashboard | `/` | Stat cards + recent activity + charts |
| 2 | Companies | `/companies`, `/companies/:id` | Future: company switcher in topbar |
| 3 | Departments | `/departments` | Filter by company |
| 4 | Roles | `/roles` | Plain CRUD |
| 5 | Teams | `/teams`, `/teams/:id` | Detail = leader + members + projects |
| 6 | Employees | `/employees`, `/employees/:id` | Detail tabs: Profile · Roles · Teams · Tasks · Attendance · Leaves |
| 7 | Projects | `/projects`, `/projects/:id` | Detail = teams, tasks, progress |
| 8 | Tasks | `/tasks` (list ⟷ Kanban), `/tasks/:id` | DnD between status columns; subtasks inline in detail |
| 9 | Work Tracking | `/time` + persistent timer widget | Start/stop a task or subtask; running state in Zustand |
| 10 | Attendance | `/attendance` | Punch in/out + monthly calendar grid |
| 11 | Leaves | `/leaves` | Submit · my requests · approval queue |
| 12 | Settings | `/settings` | Placeholder for future auth/profile |

## 6. Phased build

**Phase 0 — Bootstrap (½ day)**
- `npm create vite@latest frontend -- --template react-ts`
- Tailwind + shadcn/ui + path aliases
- Axios client, `.env.local`, TanStack Query provider, React Router
- App shell: collapsible Sidebar + Topbar + content area
- Add `cors` to API + fix `/tasks` route bug

**Phase 1 — Org foundations (2–3 days)**
- Generic `<DataTable>`, `<EntityFormDialog>`, `<ConfirmDialog>`, toast system
- Companies → Departments → Roles → Employees → Teams CRUD
- Role-assignment UI (needs backend endpoint #6 above)
- Mock current-user store

**Phase 2 — Work management (2–3 days)**
- Projects list + detail
- Tasks list + Kanban board (dnd-kit)
- Subtasks inline editor in TaskDetail
- Filters: project, assignee, status, priority

**Phase 3 — Time & attendance (2 days)**
- Persistent timer widget (Zustand) hitting `/worktracking`
- Attendance punch + month calendar
- "My time today / this week" summary

**Phase 4 — Leaves (1 day)**
- Submit form (Zod date-range, leave_type)
- My requests list + approval queue with approve/reject

**Phase 5 — Dashboard + polish (1–2 days)**
- Recharts cards
- Empty / loading / error states
- Responsive sidebar, dark mode
- README with run instructions

**Out of scope for v1**
- Auth (data layer designed to swap in)
- Server-side pagination / search
- Tests (Vitest + RTL)
- Notifications, file uploads, audit log

## 7. Day-1 order of operations

1. Add `cors` middleware + fix `/tasks` route bug in API.
2. Scaffold Vite project, install deps.
3. Tailwind + shadcn `init`, axios client, TanStack Query provider.
4. Build `AppShell` + Sidebar + placeholder Dashboard.
5. First real feature: **Employees list** — proves end-to-end wiring (axios → query hook → table → form). Every other CRUD module is the same pattern repeated.

## 8. Brand alignment — Square Feet

SquarePeople is a Square Feet LTD product, so the UI uses the parent brand.

**Source**: brand colors extracted from the logo at `https://www.squarefeetltd.com/CookieTech.svg`.

**Color tokens** (Tailwind config in `mockup.html`):

| Token | Hex | Use |
|---|---|---|
| `brand-500` | `#f9ac1b` | Primary CTA (golden yellow) |
| `brand-600` | `#e09a0e` | CTA hover |
| `brand-700` / `brand-800` | `#b07807` / `#7a4f08` | Brand text on light bg |
| `brand-900` | `#402312` | Deep brown anchor |
| `accent-500` | `#ec176c` | Magenta highlight, secondary CTA, leadership chips |
| `accent-700` | `#a90849` | Accent text on light bg |
| `cream-50` | `#fffbf5` | Page background (warm white) |
| `cream-100..300` | warm tans | Borders, dividers, table headers |
| `ink-500/600/900` | warm browns | Body / strong / heading text |

**Semantic colors** kept standard for clarity but read warmer on the cream background:
- `emerald` for success / present / approved / completed
- `amber` for warning / late / pending
- `rose` for danger / rejected / terminated / at-risk

**Typography**: Plus Jakarta Sans (sans), JetBrains Mono (timer display, IDs). Both via Google Fonts.

**Logo**: in production swap the cookie lucide-icon placeholder for the actual `CookieTech.svg` and product wordmark "SquarePeople" with subtitle "by Square Feet".

**For the real Vite app**: lift the `tailwind.config` block from `mockup.html` directly into `tailwind.config.ts` — the brand and cream/ink palettes are already keyed exactly how shadcn/ui expects.

## 9. Visual reference

Two mockup files in this folder, both Square Feet-branded:

- **`mockup.html`** — the in-app experience: sidebar + topbar layout with Dashboard, Employees, Teams, Departments, Projects, Tasks Kanban, Time tracking, Attendance, Leaves.
- **`auth-mockup.html`** — the pre-app / SaaS entry experience: split-screen brand-panel layout with Login, Sign-up (account → company), and Forgot-password flows. Demo nav in the bottom-right swaps between them.

Both files share the same Tailwind brand config block, so component styles will be 1:1 portable to the real Vite app.
