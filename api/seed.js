/**
 * Database seeder — Bangladeshi demo data.
 *
 * Wipes all tables (sync force) and inserts two demo companies with employees,
 * departments, roles, teams, projects, tasks/subtasks, attendance, time logs,
 * leave requests/approvals, and an activity (audit) feed.
 *
 * Run:  npm run seed     (DROPS and recreates every table — dev only!)
 *
 * Demo logins (all password "Test1234", PIN "1234"):
 *   Square Feet LTD (square-feet)
 *     owner   tanvir@squarefeet.xyz    EMP-0001
 *     admin   nusrat@squarefeet.xyz    EMP-0002
 *     manager rakib@squarefeet.xyz     EMP-0003
 *     member  sadia@squarefeet.xyz     EMP-0004
 *   Jamuna Retail Ltd (jamuna-retail)
 *     owner   shahidul@jamunaretail.com  EMP-0001
 */
const bcrypt = require('bcryptjs');
const sequelize = require('./config/database');
const env = require('./config/env');

// Register every model + associations (same order as index.js).
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

const {
  Company, Department, Employee, Role, Team, Project, Task, Subtask,
  WorkTracking, Attendance, LeaveRequest, LeaveApproval, User, AuditLog,
} = require('./association');

// ---- helpers ---------------------------------------------------------------
const ROUNDS = env.BCRYPT_SALT_ROUNDS;
const PW = bcrypt.hashSync('Test1234', ROUNDS);
const PIN = bcrypt.hashSync('1234', ROUNDS);

const now = new Date();
const ymd = (d) => d.toISOString().slice(0, 10);
const addDays = (base, n) => { const d = new Date(base); d.setDate(d.getDate() + n); return d; };
const at = (base, h, m) => { const d = new Date(base); d.setHours(h, m, 0, 0); return d; };
const code = (n) => 'EMP-' + String(n).padStart(4, '0');

// Most recent N weekdays (Sun–Thu in Bangladesh; skip Fri=5, Sat=6).
function recentWorkdays(count) {
  const out = [];
  let d = new Date(now);
  while (out.length < count) {
    const dow = d.getDay();
    if (dow !== 5 && dow !== 6) out.push(new Date(d));
    d = addDays(d, -1);
  }
  return out; // newest first
}

async function makeEmployee(company, dept, n, data) {
  return Employee.create({
    company_id: company.company_id,
    department_id: dept ? dept.department_id : null,
    employee_code: code(n),
    name: data.name,
    email: data.email,
    phone: data.phone || null,
    hire_date: data.hireDate,
    status: data.status || 'active',
  });
}

async function makeUser(company, emp, role) {
  return User.create({
    company_id: company.company_id,
    employee_id: emp.employee_id,
    email: emp.email,
    password_hash: PW,
    pin_hash: PIN,
    role,
  });
}

async function audit(company, user, entity, action, entityId, when) {
  return AuditLog.create({
    company_id: company.company_id,
    actor_user_id: user ? user.id : null,
    entity, action,
    entity_id: entityId == null ? null : String(entityId),
    created_at: when,
  });
}

// ---------------------------------------------------------------------------
async function seedSquareFeet() {
  const company = await Company.create({
    slug: 'square-feet',
    name: 'Square Feet LTD',
    email: 'hello@squarefeet.xyz',
    phone: '+880 9610-998877',
    address: 'Level 7, Rangs Babylonia, Bir Uttam Mir Shawkat Rd, Dhaka 1212',
    website: 'https://squarefeet.xyz',
    industry: 'Information Technology',
    companySize: '11-50',
    workingDays: 'Sun,Mon,Tue,Wed,Thu',
    workingHours: '10:00-18:00',
    foundedDate: new Date('2019-03-01'),
  });

  // Departments
  const [engg, design, sales, hr, finance] = await Promise.all([
    Department.create({ company_id: company.company_id, name: 'Engineering', description: 'Builds and ships the product' }),
    Department.create({ company_id: company.company_id, name: 'Product & Design', description: 'Product strategy and UX' }),
    Department.create({ company_id: company.company_id, name: 'Sales & Marketing', description: 'Growth and customers' }),
    Department.create({ company_id: company.company_id, name: 'Human Resources', description: 'People and culture' }),
    Department.create({ company_id: company.company_id, name: 'Finance & Admin', description: 'Accounts and operations' }),
  ]);

  // Roles
  const [rSenior, rEngineer, rPM, rDesigner, rHR, rAccount] = await Promise.all([
    Role.create({ company_id: company.company_id, name: 'Senior Engineer', color: '#2563eb', description: 'Leads technical delivery' }),
    Role.create({ company_id: company.company_id, name: 'Software Engineer', color: '#0ea5e9', description: 'Builds features' }),
    Role.create({ company_id: company.company_id, name: 'Product Manager', color: '#f9ac1b', description: 'Owns the roadmap' }),
    Role.create({ company_id: company.company_id, name: 'UI/UX Designer', color: '#ec4899', description: 'Designs the experience' }),
    Role.create({ company_id: company.company_id, name: 'HR Manager', color: '#10b981', description: 'People operations' }),
    Role.create({ company_id: company.company_id, name: 'Accountant', color: '#a855f7', description: 'Finance and payroll' }),
  ]);

  // Employees
  const tanvir   = await makeEmployee(company, engg,    1, { name: 'Tanvir Ahmed',     email: 'tanvir@squarefeet.xyz',   phone: '+880 1711-101010', hireDate: '2019-03-01' });
  const nusrat   = await makeEmployee(company, hr,      2, { name: 'Nusrat Jahan',     email: 'nusrat@squarefeet.xyz',   phone: '+880 1712-202020', hireDate: '2019-06-15' });
  const rakib    = await makeEmployee(company, engg,    3, { name: 'Rakib Hasan',      email: 'rakib@squarefeet.xyz',    phone: '+880 1713-303030', hireDate: '2020-01-10' });
  const sadia    = await makeEmployee(company, engg,    4, { name: 'Sadia Islam',      email: 'sadia@squarefeet.xyz',    phone: '+880 1714-404040', hireDate: '2021-08-01' });
  const mahmud   = await makeEmployee(company, engg,    5, { name: 'Mahmudul Karim',   email: 'mahmudul@squarefeet.xyz', phone: '+880 1815-505050', hireDate: '2022-02-20' });
  const farhana  = await makeEmployee(company, design,  6, { name: 'Farhana Akter',    email: 'farhana@squarefeet.xyz',  phone: '+880 1816-606060', hireDate: '2021-11-05' });
  const arif     = await makeEmployee(company, design,  7, { name: 'Arif Hossain',     email: 'arif@squarefeet.xyz',     phone: '+880 1917-707070', hireDate: '2020-09-12' });
  const tahmina  = await makeEmployee(company, sales,   8, { name: 'Tahmina Begum',    email: 'tahmina@squarefeet.xyz',  phone: '+880 1918-808080', hireDate: '2022-05-18' });
  const sabbir   = await makeEmployee(company, engg,    9, { name: 'Sabbir Rahman',    email: 'sabbir@squarefeet.xyz',   phone: '+880 1619-909090', hireDate: '2023-03-01' });
  const mehedi   = await makeEmployee(company, finance, 10, { name: 'Mehedi Hasan',    email: 'mehedi@squarefeet.xyz',   phone: '+880 1611-111213', hireDate: '2021-04-22' });
  const ishrat   = await makeEmployee(company, sales,  11, { name: 'Ishrat Jahan',     email: 'ishrat@squarefeet.xyz',   phone: '+880 1511-141516', hireDate: addDays(now, -12) }); // new this month
  const kamrul   = await makeEmployee(company, engg,   12, { name: 'Kamrul Islam',     email: 'kamrul@squarefeet.xyz',   phone: '+880 1311-171819', hireDate: '2020-07-01', status: 'terminated' });

  // Manager reporting lines
  await Promise.all([
    sadia.update({ manager_id: rakib.employee_id }),
    mahmud.update({ manager_id: rakib.employee_id }),
    sabbir.update({ manager_id: rakib.employee_id }),
    farhana.update({ manager_id: arif.employee_id }),
    ishrat.update({ manager_id: tahmina.employee_id }),
  ]);

  // Role assignments
  await Promise.all([
    tanvir.addRoles([rSenior]),
    nusrat.addRoles([rHR]),
    rakib.addRoles([rSenior]),
    sadia.addRoles([rEngineer]),
    mahmud.addRoles([rEngineer]),
    farhana.addRoles([rDesigner]),
    arif.addRoles([rPM]),
    tahmina.addRoles([rPM]),
    sabbir.addRoles([rEngineer]),
    mehedi.addRoles([rAccount]),
    ishrat.addRoles([rPM]),
  ]);

  // Logins (owner / admin / manager / member)
  const uTanvir = await makeUser(company, tanvir, 'owner');
  const uNusrat = await makeUser(company, nusrat, 'admin');
  const uRakib  = await makeUser(company, rakib, 'manager');
  const uSadia  = await makeUser(company, sadia, 'member');

  // Teams
  const through = { through: { company_id: company.company_id } };
  const teamEng = await Team.create({ company_id: company.company_id, name: 'Engineering Team', description: 'Core platform engineering', lead_employee_id: rakib.employee_id });
  await teamEng.addMembers([rakib, sadia, mahmud, sabbir], through);
  const teamDesign = await Team.create({ company_id: company.company_id, name: 'Product & Design', description: 'Product and design squad', lead_employee_id: arif.employee_id });
  await teamDesign.addMembers([arif, farhana], through);
  const teamSales = await Team.create({ company_id: company.company_id, name: 'Sales & Marketing', description: 'Revenue and growth', lead_employee_id: tahmina.employee_id });
  await teamSales.addMembers([tahmina, ishrat], through);

  // Projects
  const pBkash = await Project.create({ company_id: company.company_id, name: 'bKash Payment Integration', description: 'Add bKash as a checkout option', status: 'in-progress', start_date: '2026-04-01', due_date: ymd(addDays(now, 21)) });
  const pPathao = await Project.create({ company_id: company.company_id, name: 'Pathao Courier Dashboard', description: 'Courier tracking and order management', status: 'on-track', start_date: '2026-05-01', due_date: ymd(addDays(now, 40)) });
  const pEcom = await Project.create({ company_id: company.company_id, name: 'E-commerce Mobile App', description: 'Flagship shopping app for Android/iOS', status: 'at-risk', start_date: '2026-03-15', due_date: ymd(addDays(now, 10)) });
  const pHr = await Project.create({ company_id: company.company_id, name: 'HR Portal Revamp', description: 'Internal HR self-service portal', status: 'completed', start_date: '2026-01-05', end_date: '2026-04-20', due_date: '2026-04-20' });
  await pBkash.addTeams([teamEng]);
  await pPathao.addTeams([teamEng, teamDesign]);
  await pEcom.addTeams([teamEng]);
  await pHr.addTeams([teamDesign]);

  // Tasks  (status: pending | in_progress | completed; position is per project+column)
  const T = (n, project, data) => Task.create({
    company_id: company.company_id, code: '#10' + n, project_id: project.project_id,
    title: data.title, description: data.desc || null, assigned_to: data.to ? data.to.employee_id : null,
    priority: data.pri || 'medium', status: data.status, position: data.pos,
  });
  const t1 = await T(1, pBkash, { title: 'Integrate bKash checkout API', to: sadia,  pri: 'high',   status: 'in_progress', pos: 0 });
  await T(2, pBkash, { title: 'Handle payment webhook retries', to: sabbir, pri: 'medium', status: 'pending', pos: 0 });
  await T(3, pBkash, { title: 'Write integration tests', to: mahmud, pri: 'low', status: 'pending', pos: 1 });
  const t4 = await T(4, pBkash, { title: 'Sandbox credentials setup', to: rakib, pri: 'medium', status: 'completed', pos: 0 });
  const t5 = await T(5, pPathao, { title: 'Design courier tracking UI', to: farhana, pri: 'high', status: 'in_progress', pos: 0 });
  await T(6, pPathao, { title: 'Build order list table', to: sadia, pri: 'medium', status: 'pending', pos: 0 });
  await T(7, pPathao, { title: 'Live location map widget', to: sabbir, pri: 'high', status: 'completed', pos: 0 });
  await T(8, pEcom, { title: 'Fix checkout crash on Android', to: mahmud, pri: 'high', status: 'in_progress', pos: 0 });
  await T(9, pEcom, { title: 'Optimize product image loading', to: sadia, pri: 'medium', status: 'pending', pos: 0 });
  await T(10, pHr, { title: 'Migrate employee records', to: rakib, pri: 'medium', status: 'completed', pos: 0 });

  // Subtasks
  const S = (task, n, data) => Subtask.create({
    company_id: company.company_id, task_id: task.task_id, assigned_to: data.to ? data.to.employee_id : null,
    title: data.title, status: data.status, position: n,
  });
  await S(t1, 0, { title: 'Set up bKash merchant account', to: rakib, status: 'completed' });
  await S(t1, 1, { title: 'Implement create-payment call', to: sadia, status: 'in_progress' });
  await S(t1, 2, { title: 'Add refund endpoint', to: sadia, status: 'pending' });
  await S(t5, 0, { title: 'Wireframe tracking screen', to: farhana, status: 'completed' });
  await S(t5, 1, { title: 'Hi-fidelity mockups', to: farhana, status: 'in_progress' });

  // Attendance — today + recent workdays
  const today = ymd(now);
  const present = [
    { e: tanvir, h: 10, m: 2, status: 'present' },
    { e: rakib, h: 9, m: 55, status: 'present' },
    { e: sadia, h: 10, m: 18, status: 'late' },
    { e: mahmud, h: 9, m: 48, status: 'present' },
    { e: sabbir, h: 10, m: 5, status: 'present' },
    { e: farhana, h: 10, m: 35, status: 'late' },
  ];
  for (const p of present) {
    await Attendance.create({
      company_id: company.company_id, employee_id: p.e.employee_id, logged_date: today,
      signed_in_at: at(now, p.h, p.m), status: p.status,
    });
  }
  // History for a few staff over the last ~9 workdays
  const history = [tanvir, rakib, sadia, mahmud];
  const days = recentWorkdays(10).slice(1); // exclude today (already added)
  for (const day of days) {
    for (const e of history) {
      const late = (day.getDate() + e.employee_id) % 7 === 0;
      await Attendance.create({
        company_id: company.company_id, employee_id: e.employee_id, logged_date: ymd(day),
        signed_in_at: at(day, late ? 10 : 9, late ? 25 : 52),
        signed_out_at: at(day, 18, 10),
        status: late ? 'late' : 'present',
      });
    }
  }

  // Time logs — this week, for the owner (dashboard chart is per logged-in user) + others
  const W = (emp, task, day, sh, sm, eh, em) => WorkTracking.create({
    company_id: company.company_id, employee_id: emp.employee_id, task_id: task.task_id,
    start_time: at(day, sh, sm), end_time: eh == null ? null : at(day, eh, em),
    duration_minutes: eh == null ? null : (eh * 60 + em) - (sh * 60 + sm),
    logged_date: ymd(day),
  });
  const wk = recentWorkdays(5); // newest first incl today
  await W(tanvir, t1, wk[3], 10, 30, 12, 45);
  await W(tanvir, t1, wk[2], 11, 0, 13, 30);
  await W(tanvir, t5, wk[1], 14, 0, 17, 15);
  await W(tanvir, t1, wk[0], 10, 15, 12, 0);
  await W(tanvir, t5, wk[0], 14, 0, null, null);   // running timer today
  await W(rakib, t4, wk[1], 9, 30, 12, 0);
  await W(sadia, t1, wk[0], 10, 0, 12, 30);

  // Leaves
  const lvSadia = await LeaveRequest.create({ company_id: company.company_id, employee_id: sadia.employee_id, leave_type: 'annual', status: 'pending', start_date: ymd(addDays(now, 10)), end_date: ymd(addDays(now, 14)), days: 5, reason: 'Family trip to Cox’s Bazar' });
  const lvSabbir = await LeaveRequest.create({ company_id: company.company_id, employee_id: sabbir.employee_id, leave_type: 'unpaid', status: 'pending', start_date: ymd(addDays(now, 20)), end_date: ymd(addDays(now, 21)), days: 2, reason: 'Personal work' });
  const lvMahmud = await LeaveRequest.create({ company_id: company.company_id, employee_id: mahmud.employee_id, leave_type: 'sick', status: 'approved', start_date: ymd(addDays(now, -6)), end_date: ymd(addDays(now, -5)), days: 2, reason: 'Fever and rest' });
  await LeaveApproval.create({ company_id: company.company_id, leave_request_id: lvMahmud.leave_id, approver_id: rakib.employee_id, decision: 'approved', decided_at: addDays(now, -7) });
  const lvFarhana = await LeaveRequest.create({ company_id: company.company_id, employee_id: farhana.employee_id, leave_type: 'annual', status: 'rejected', start_date: ymd(addDays(now, -3)), end_date: ymd(addDays(now, -1)), days: 3, reason: 'Eid vacation extension' });
  await LeaveApproval.create({ company_id: company.company_id, leave_request_id: lvFarhana.leave_id, approver_id: nusrat.employee_id, decision: 'rejected', reason: 'Coverage needed during release week', decided_at: addDays(now, -4) });

  // Activity feed (audit log) — most recent first
  await audit(company, uTanvir, 'user', 'login_pin', uTanvir.id, addDays(now, 0));
  await audit(company, uSadia, 'task', 'create', '#101', new Date(now.getTime() - 2 * 3600e3));
  await audit(company, uRakib, 'task', 'kanban_move', t4.task_id, new Date(now.getTime() - 3 * 3600e3));
  await audit(company, uSadia, 'leaverequest', 'create', lvSadia.leave_id, new Date(now.getTime() - 5 * 3600e3));
  await audit(company, uRakib, 'leaverequest', 'approve', lvMahmud.leave_id, addDays(now, -1));
  await audit(company, uRakib, 'team', 'set_members', teamEng.team_id, addDays(now, -1));
  await audit(company, uTanvir, 'project', 'create', pBkash.project_id, addDays(now, -2));
  await audit(company, uTanvir, 'team', 'create', teamEng.team_id, addDays(now, -2));
  await audit(company, uNusrat, 'leaverequest', 'reject', lvFarhana.leave_id, addDays(now, -4));

  return company;
}

async function seedJamunaRetail() {
  const company = await Company.create({
    slug: 'jamuna-retail',
    name: 'Jamuna Retail Ltd',
    email: 'hello@jamunaretail.com',
    phone: '+880 9612-445566',
    address: 'Jamuna Future Park, Ka-244 Kuril, Dhaka 1229',
    website: 'https://jamunaretail.com.bd',
    industry: 'Retail',
    companySize: '1-10',
    workingDays: 'Sat,Sun,Mon,Tue,Wed,Thu',
    workingHours: '09:00-21:00',
    foundedDate: new Date('2021-09-10'),
  });

  const ops = await Department.create({ company_id: company.company_id, name: 'Retail Operations', description: 'Store and floor operations' });
  const rManager = await Role.create({ company_id: company.company_id, name: 'Store Manager', color: '#2563eb' });
  const rAssoc = await Role.create({ company_id: company.company_id, name: 'Sales Associate', color: '#10b981' });

  const shahidul = await makeEmployee(company, ops, 1, { name: 'Shahidul Islam', email: 'shahidul@jamunaretail.com', phone: '+880 1711-223344', hireDate: '2021-09-10' });
  const rumana   = await makeEmployee(company, ops, 2, { name: 'Rumana Begum',   email: 'rumana@jamunaretail.com',   phone: '+880 1812-334455', hireDate: '2022-01-15' });
  const jahangir = await makeEmployee(company, ops, 3, { name: 'Jahangir Alam',  email: 'jahangir@jamunaretail.com', phone: '+880 1913-445566', hireDate: '2022-06-01' });
  const nasrin   = await makeEmployee(company, ops, 4, { name: 'Nasrin Sultana', email: 'nasrin@jamunaretail.com',   phone: '+880 1614-556677', hireDate: '2023-02-20' });

  await shahidul.addRoles([rManager]);
  await Promise.all([rumana.addRoles([rAssoc]), jahangir.addRoles([rAssoc]), nasrin.addRoles([rAssoc])]);
  await Promise.all([rumana.update({ manager_id: shahidul.employee_id }), jahangir.update({ manager_id: shahidul.employee_id }), nasrin.update({ manager_id: shahidul.employee_id })]);

  await makeUser(company, shahidul, 'owner');

  const team = await Team.create({ company_id: company.company_id, name: 'Store Ops', description: 'Jamuna Future Park outlet', lead_employee_id: shahidul.employee_id });
  await team.addMembers([shahidul, rumana, jahangir, nasrin], { through: { company_id: company.company_id } });

  const project = await Project.create({ company_id: company.company_id, name: 'POS System Rollout', description: 'Roll out new point-of-sale across registers', status: 'in-progress', start_date: '2026-05-01', due_date: ymd(addDays(now, 30)) });
  await project.addTeams([team]);

  await Task.create({ company_id: company.company_id, code: '#101', project_id: project.project_id, title: 'Install POS terminals', assigned_to: jahangir.employee_id, priority: 'high', status: 'in_progress', position: 0 });
  await Task.create({ company_id: company.company_id, code: '#102', project_id: project.project_id, title: 'Train floor staff', assigned_to: rumana.employee_id, priority: 'medium', status: 'pending', position: 0 });
  await Task.create({ company_id: company.company_id, code: '#103', project_id: project.project_id, title: 'Audit cash drawer flow', assigned_to: nasrin.employee_id, priority: 'low', status: 'completed', position: 0 });

  const today = ymd(now);
  await Attendance.create({ company_id: company.company_id, employee_id: shahidul.employee_id, logged_date: today, signed_in_at: at(now, 9, 5), status: 'present' });
  await Attendance.create({ company_id: company.company_id, employee_id: rumana.employee_id, logged_date: today, signed_in_at: at(now, 9, 12), status: 'present' });

  await LeaveRequest.create({ company_id: company.company_id, employee_id: nasrin.employee_id, leave_type: 'annual', status: 'pending', start_date: ymd(addDays(now, 7)), end_date: ymd(addDays(now, 9)), days: 3, reason: 'Village visit' });

  return company;
}

// ---------------------------------------------------------------------------
(async () => {
  try {
    await sequelize.authenticate();
    console.log('DB connected. Dropping & recreating all tables…');
    await sequelize.sync({ force: true });

    const c1 = await seedSquareFeet();
    const c2 = await seedJamunaRetail();

    const [companies, employees, users, tasks, leaves] = await Promise.all([
      Company.count(), Employee.count(), User.count(), Task.count(), LeaveRequest.count(),
    ]);
    console.log('\n✅ Seed complete');
    console.log(`   companies=${companies} employees=${employees} users=${users} tasks=${tasks} leaves=${leaves}`);
    console.log('\n   Primary login → ' + c1.slug + '  tanvir@squarefeet.xyz / Test1234  (PIN EMP-0001 / 1234)');
    // (Square Feet LTD is the data-rich tenant; Jamuna Retail is the lighter second tenant)
    console.log('   Second tenant → ' + c2.slug + '  shahidul@jamunaretail.com / Test1234');
    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
})();
