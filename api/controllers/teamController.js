const { Team, Employee, Project, TeamMember } = require('../association');
const { toTeamDto, toEmployeeDto, paginated, parsePageQuery } = require('../utils/serializer');
const AppError = require('../utils/AppError');
const { auditEvent } = require('../utils/auditEvents');

async function withCounts(team) {
  const memberCount = await TeamMember.count({ where: { team_id: team.team_id } });
  const projects = await team.getProjects({ attributes: ['project_id', 'name', 'status'] });
  const activeProjectCount = projects.filter((p) => p.status !== 'completed').length;
  // Preview avatars: up to 5 members for the list view.
  const memberRows = await team.getMembers({ attributes: ['employee_id', 'name'], limit: 5, joinTableAttributes: [] });
  const members = memberRows.map((m) => ({ id: m.employee_id, name: m.name }));
  return toTeamDto(team, { memberCount, activeProjectCount, members });
}

const teamController = {
  list: async (req, res, next) => {
    try {
      const { page, perPage, offset } = parsePageQuery(req.query);
      const { rows, count } = await Team.findAndCountAll({
        where: { company_id: req.user.companyId },
        include: [{ model: Employee, as: 'leader', attributes: ['employee_id', 'name'] }],
        order: [['name', 'ASC']],
        limit: perPage, offset,
      });
      const data = await Promise.all(rows.map(withCounts));
      res.json(paginated(data, { page, perPage, total: count }));
    } catch (err) { next(err); }
  },

  getById: async (req, res, next) => {
    try {
      const t = await req.scope(Team).findByPk(req.params.id, {
        include: [
          { model: Employee, as: 'leader', attributes: ['employee_id', 'name'] },
          { model: Employee, as: 'members', through: { attributes: [] } },
          { model: Project, as: 'projects', through: { attributes: [] }, attributes: ['project_id', 'name', 'status'] },
        ],
      });
      if (!t) return next(AppError.notFound('Team'));
      res.json(toTeamDto(t, {
        members: t.members?.map((m) => ({ id: m.employee_id, name: m.name })) || [],
        projects: t.projects?.map((p) => ({ id: p.project_id, name: p.name, status: p.status })) || [],
      }));
    } catch (err) { next(err); }
  },

  create: async (req, res, next) => {
    try {
      const dbBody = {
        name: req.body.name,
        description: req.body.description,
        lead_employee_id: req.body.leadEmployeeId,
      };
      const t = await req.scope(Team).create(dbBody);
      const full = await req.scope(Team).findByPk(t.team_id, {
        include: [{ model: Employee, as: 'leader', attributes: ['employee_id', 'name'] }],
      });
      await auditEvent(req, { entity: 'team', action: 'create', entityId: t.team_id });
      res.status(201).json(toTeamDto(full, { memberCount: 0, activeProjectCount: 0, members: [] }));
    } catch (err) { next(err); }
  },

  update: async (req, res, next) => {
    try {
      const t = await req.scope(Team).findByPk(req.params.id);
      if (!t) return next(AppError.notFound('Team'));
      const dbBody = {};
      if (req.body.name !== undefined) dbBody.name = req.body.name;
      if (req.body.description !== undefined) dbBody.description = req.body.description;
      if (req.body.leadEmployeeId !== undefined) dbBody.lead_employee_id = req.body.leadEmployeeId;
      await t.update(dbBody);
      await auditEvent(req, { entity: 'team', action: 'update', entityId: t.team_id });
      res.json(await withCounts(t));
    } catch (err) { next(err); }
  },

  remove: async (req, res, next) => {
    try {
      const t = await req.scope(Team).findByPk(req.params.id);
      if (!t) return next(AppError.notFound('Team'));
      const deletedId = t.team_id;
      await t.destroy();
      await auditEvent(req, { entity: 'team', action: 'delete', entityId: deletedId });
      res.json({ ok: true });
    } catch (err) { next(err); }
  },

  setMembers: async (req, res, next) => {
    try {
      const t = await req.scope(Team).findByPk(req.params.id);
      if (!t) return next(AppError.notFound('Team'));
      const emps = await Employee.findAll({ where: { company_id: req.user.companyId, employee_id: req.body.employeeIds } });
      if (emps.length !== req.body.employeeIds.length) {
        return next(AppError.badRequest('One or more employee ids are invalid.'));
      }
      // Replace the join rows. Use the through model so company_id is set.
      await TeamMember.destroy({ where: { team_id: t.team_id } });
      await TeamMember.bulkCreate(emps.map((e) => ({
        team_id: t.team_id, employee_id: e.employee_id, company_id: req.user.companyId,
      })));
      await auditEvent(req, { entity: 'team', action: 'set_members', entityId: t.team_id });
      res.json(await withCounts(t));
    } catch (err) { next(err); }
  },

  removeMember: async (req, res, next) => {
    try {
      const t = await req.scope(Team).findByPk(req.params.id);
      if (!t) return next(AppError.notFound('Team'));
      await TeamMember.destroy({ where: { team_id: t.team_id, employee_id: req.params.employeeId } });
      await auditEvent(req, { entity: 'team', action: 'remove_member', entityId: t.team_id });
      res.json({ ok: true });
    } catch (err) { next(err); }
  },
};

module.exports = teamController;
