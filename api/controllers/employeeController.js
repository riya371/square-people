const { Op } = require('sequelize');
const { Employee, Department, Role, Team, Task, Attendance, LeaveRequest } = require('../association');
const { toEmployeeDto, paginated, parsePageQuery, toTaskDto, toAttendanceDto, toLeaveRequestDto } = require('../utils/serializer');
const AppError = require('../utils/AppError');
const { auditEvent } = require('../utils/auditEvents');

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
      const { nextEmployeeCode } = require('../utils/employeeCode');
      const dbBody = {
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
        employee_code: req.body.employeeCode || await nextEmployeeCode(req.user.companyId),
        department_id: req.body.departmentId,
        manager_id: req.body.managerId,
        hire_date: req.body.hireDate,
        status: req.body.status || 'active',
      };
      const created = await req.scope(Employee).create(dbBody);
      const e = await loadWithRelations(created, req.user.companyId);
      await auditEvent(req, { entity: 'employee', action: 'create', entityId: e.employee_id });
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
      await auditEvent(req, { entity: 'employee', action: 'update', entityId: e.employee_id });
      res.json(toEmployeeDto(full));
    } catch (err) { next(err); }
  },

  remove: async (req, res, next) => {
    try {
      const e = await req.scope(Employee).findByPk(req.params.id);
      if (!e) return next(AppError.notFound('Employee'));
      await e.update({ status: 'terminated', termination_date: new Date().toISOString().slice(0, 10) });
      await auditEvent(req, { entity: 'employee', action: 'delete', entityId: e.employee_id });
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
      await auditEvent(req, { entity: 'employee', action: 'assign_roles', entityId: e.employee_id });
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
      await auditEvent(req, { entity: 'employee', action: 'remove_role', entityId: e.employee_id });
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
