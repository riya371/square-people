const { Op } = require('sequelize');
const { AuditLog, User, Employee } = require('../association');

// Filter to events that make sense in the activity feed.
const SURFACE = new Set([
  'task:create', 'task:kanban_move', 'task:update',
  'leaverequest:create', 'leaverequest:approve', 'leaverequest:reject',
  'project:create',
  'team:set_members', 'team:create',
  'worktracking:timer_start',
  'user:signup', 'user:login_pin',
]);

function mapRow(row) {
  const actorName = row.actor?.Employee?.name || row.actor?.email || 'Someone';
  const ent = row.entity;
  const act = row.action;
  let kind = `${ent}-${act}`.replace('_', '-');
  let text = '';
  switch (`${ent}:${act}`) {
    case 'task:create':         text = `created task ${row.entity_id ? '#' + row.entity_id : ''}`.trim(); kind = 'task-create'; break;
    case 'task:kanban_move':    text = `moved a task`; kind = 'task-move'; break;
    case 'task:update':         text = `updated a task`; kind = 'task-update'; break;
    case 'leaverequest:create': text = `requested leave`; kind = 'leave-request'; break;
    case 'leaverequest:approve':text = `approved a leave request`; kind = 'leave-approve'; break;
    case 'leaverequest:reject': text = `rejected a leave request`; kind = 'leave-reject'; break;
    case 'project:create':      text = `created a new project`; kind = 'project-create'; break;
    case 'team:create':         text = `created a new team`; kind = 'team-create'; break;
    case 'team:set_members':    text = `updated team members`; kind = 'team-members'; break;
    case 'worktracking:timer_start': text = `started a timer`; kind = 'timer-start'; break;
    case 'user:signup':         text = `signed up`; kind = 'user-signup'; break;
    case 'user:login_pin':      text = `clocked in via PIN`; kind = 'user-login'; break;
  }
  return {
    id: String(row.id),
    kind,
    actor: row.actor ? { name: actorName } : null,
    text,
    timestamp: row.created_at,
  };
}

const activityController = {
  list: async (req, res, next) => {
    try {
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '10', 10)));
      const rows = await AuditLog.findAll({
        where: { company_id: req.user.companyId },
        include: [{ model: User, as: 'actor', include: [{ model: Employee, attributes: ['name'] }], attributes: ['id', 'email'] }],
        order: [['created_at', 'DESC']],
        limit: limit * 3, // over-fetch then filter to SURFACE
      });
      const surfaced = rows.filter((r) => SURFACE.has(`${r.entity}:${r.action}`)).slice(0, limit);
      res.json({ data: surfaced.map(mapRow) });
    } catch (err) { next(err); }
  },
};

module.exports = activityController;
