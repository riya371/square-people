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
