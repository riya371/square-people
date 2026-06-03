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

// Invites
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
  inviteCreateBody, inviteAcceptBody,
};
