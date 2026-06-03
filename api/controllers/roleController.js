const { Role } = require('../association');
const { toRoleDto, paginated, parsePageQuery } = require('../utils/serializer');
const AppError = require('../utils/AppError');
const { auditEvent } = require('../utils/auditEvents');

const roleController = {
  list: async (req, res, next) => {
    try {
      const { page, perPage, offset } = parsePageQuery(req.query);
      const { rows, count } = await Role.findAndCountAll({
        where: { company_id: req.user.companyId },
        order: [['name', 'ASC']],
        limit: perPage, offset,
      });
      res.json(paginated(rows.map(toRoleDto), { page, perPage, total: count }));
    } catch (err) { next(err); }
  },
  getById: async (req, res, next) => {
    try {
      const r = await req.scope(Role).findByPk(req.params.id);
      if (!r) return next(AppError.notFound('Role'));
      res.json(toRoleDto(r));
    } catch (err) { next(err); }
  },
  create: async (req, res, next) => {
    try {
      const r = await req.scope(Role).create(req.body);
      await auditEvent(req, { entity: 'role', action: 'create', entityId: r.role_id });
      res.status(201).json(toRoleDto(r));
    } catch (err) {
      if (err?.name === 'SequelizeUniqueConstraintError') {
        return next(AppError.conflict('ROLE_NAME_TAKEN', 'A role with that name already exists.'));
      }
      next(err);
    }
  },
  update: async (req, res, next) => {
    try {
      const r = await req.scope(Role).findByPk(req.params.id);
      if (!r) return next(AppError.notFound('Role'));
      await r.update(req.body);
      await auditEvent(req, { entity: 'role', action: 'update', entityId: r.role_id });
      res.json(toRoleDto(r));
    } catch (err) { next(err); }
  },
  remove: async (req, res, next) => {
    try {
      const r = await req.scope(Role).findByPk(req.params.id);
      if (!r) return next(AppError.notFound('Role'));
      const deletedId = r.role_id;
      await r.destroy();
      await auditEvent(req, { entity: 'role', action: 'delete', entityId: deletedId });
      res.json({ ok: true });
    } catch (err) { next(err); }
  },
};

module.exports = roleController;
