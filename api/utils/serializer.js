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
    task: e.Task ? {
      id: e.Task.task_id,
      title: e.Task.title,
      code: e.Task.code,
      project: e.Task.Project ? { id: e.Task.Project.project_id, name: e.Task.Project.name } : undefined,
    } : undefined,
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
