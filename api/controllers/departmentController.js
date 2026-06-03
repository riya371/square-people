const { Department, Employee } = require('../association');
const { toDepartmentDto, paginated, parsePageQuery } = require('../utils/serializer');
const AppError = require('../utils/AppError');
const { auditEvent } = require('../utils/auditEvents');

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
      await auditEvent(req, { entity: 'department', action: 'create', entityId: d.department_id });
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
      await auditEvent(req, { entity: 'department', action: 'update', entityId: d.department_id });
      res.json(await withHeadcount(d));
    } catch (err) { next(err); }
  },

  remove: async (req, res, next) => {
    try {
      const d = await req.scope(Department).findByPk(req.params.id);
      if (!d) return next(AppError.notFound('Department'));
      const deletedId = d.department_id;
      await d.destroy();
      await auditEvent(req, { entity: 'department', action: 'delete', entityId: deletedId });
      res.json({ ok: true });
    } catch (err) { next(err); }
  },
};

module.exports = departmentController;
