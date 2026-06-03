const { Op } = require('sequelize');
const { AuditLog, User } = require('../association');
const { paginated, parsePageQuery } = require('../utils/serializer');

const auditController = {
  list: async (req, res, next) => {
    try {
      const { page, perPage, offset } = parsePageQuery(req.query);
      const where = { company_id: req.user.companyId };
      if (req.query.entity) where.entity = req.query.entity;
      if (req.query.action) where.action = req.query.action;
      if (req.query.actorId) where.actor_user_id = Number(req.query.actorId);
      if (req.query.from || req.query.to) {
        where.created_at = {};
        if (req.query.from) where.created_at[Op.gte] = new Date(req.query.from);
        if (req.query.to) where.created_at[Op.lte] = new Date(req.query.to);
      }
      const { rows, count } = await AuditLog.findAndCountAll({
        where,
        include: [{ model: User, as: 'actor', attributes: ['id', 'email'] }],
        order: [['created_at', 'DESC']],
        limit: perPage, offset,
      });
      const data = rows.map((r) => ({
        id: String(r.id),
        entity: r.entity,
        action: r.action,
        entityId: r.entity_id,
        actor: r.actor ? { id: r.actor.id, email: r.actor.email } : null,
        diff: r.diff,
        ip: r.ip,
        userAgent: r.ua,
        createdAt: r.created_at,
      }));
      res.json(paginated(data, { page, perPage, total: count }));
    } catch (err) { next(err); }
  },
};

module.exports = auditController;
