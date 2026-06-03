const { Project, Team, Task } = require('../association');
const { toProjectDto, paginated, parsePageQuery } = require('../utils/serializer');
const AppError = require('../utils/AppError');
const { auditEvent } = require('../utils/auditEvents');

async function withTasksMeta(project) {
  const tasksTotal = await Task.count({ where: { project_id: project.project_id } });
  const tasksDone = await Task.count({ where: { project_id: project.project_id, status: 'completed' } });
  const progress = tasksTotal > 0 ? tasksDone / tasksTotal : 0;
  return toProjectDto(project, { tasksTotal, tasksDone, progress });
}

const projectController = {
  list: async (req, res, next) => {
    try {
      const { page, perPage, offset } = parsePageQuery(req.query);
      const { rows, count } = await Project.findAndCountAll({
        where: { company_id: req.user.companyId },
        include: [{ model: Team, as: 'teams', through: { attributes: [] }, attributes: ['team_id', 'name'] }],
        order: [['name', 'ASC']],
        limit: perPage, offset, distinct: true,
      });
      const data = await Promise.all(rows.map(withTasksMeta));
      res.json(paginated(data, { page, perPage, total: count }));
    } catch (err) { next(err); }
  },

  getById: async (req, res, next) => {
    try {
      const p = await req.scope(Project).findByPk(req.params.id, {
        include: [{ model: Team, as: 'teams', through: { attributes: [] } }, { model: Task }],
      });
      if (!p) return next(AppError.notFound('Project'));
      res.json(await withTasksMeta(p));
    } catch (err) { next(err); }
  },

  create: async (req, res, next) => {
    try {
      const dbBody = {
        name: req.body.name,
        description: req.body.description,
        status: req.body.status || 'in-progress',
        start_date: req.body.startDate,
        end_date: req.body.endDate,
        due_date: req.body.dueDate,
      };
      const p = await req.scope(Project).create(dbBody);
      await auditEvent(req, { entity: 'project', action: 'create', entityId: p.project_id });
      res.status(201).json(toProjectDto(p, { tasksTotal: 0, tasksDone: 0, progress: 0, teams: [] }));
    } catch (err) { next(err); }
  },

  update: async (req, res, next) => {
    try {
      const p = await req.scope(Project).findByPk(req.params.id);
      if (!p) return next(AppError.notFound('Project'));
      const dbBody = {};
      if (req.body.name !== undefined) dbBody.name = req.body.name;
      if (req.body.description !== undefined) dbBody.description = req.body.description;
      if (req.body.status !== undefined) dbBody.status = req.body.status;
      if (req.body.startDate !== undefined) dbBody.start_date = req.body.startDate;
      if (req.body.endDate !== undefined) dbBody.end_date = req.body.endDate;
      if (req.body.dueDate !== undefined) dbBody.due_date = req.body.dueDate;
      await p.update(dbBody);
      await auditEvent(req, { entity: 'project', action: 'update', entityId: p.project_id });
      res.json(await withTasksMeta(p));
    } catch (err) { next(err); }
  },

  remove: async (req, res, next) => {
    try {
      const p = await req.scope(Project).findByPk(req.params.id);
      if (!p) return next(AppError.notFound('Project'));
      const deletedId = p.project_id;
      await p.destroy();
      await auditEvent(req, { entity: 'project', action: 'delete', entityId: deletedId });
      res.json({ ok: true });
    } catch (err) { next(err); }
  },

  setTeams: async (req, res, next) => {
    try {
      const p = await req.scope(Project).findByPk(req.params.id);
      if (!p) return next(AppError.notFound('Project'));
      const teams = await Team.findAll({ where: { company_id: req.user.companyId, team_id: req.body.teamIds } });
      if (teams.length !== req.body.teamIds.length) {
        return next(AppError.badRequest('One or more team ids are invalid.'));
      }
      await p.setTeams(teams);
      await auditEvent(req, { entity: 'project', action: 'set_teams', entityId: p.project_id });
      res.json(await withTasksMeta(p));
    } catch (err) { next(err); }
  },

  removeTeam: async (req, res, next) => {
    try {
      const p = await req.scope(Project).findByPk(req.params.id);
      if (!p) return next(AppError.notFound('Project'));
      const team = await Team.findOne({ where: { company_id: req.user.companyId, team_id: req.params.teamId } });
      if (!team) return next(AppError.notFound('Team'));
      await p.removeTeam(team);
      await auditEvent(req, { entity: 'project', action: 'remove_team', entityId: p.project_id });
      res.json({ ok: true });
    } catch (err) { next(err); }
  },
};

module.exports = projectController;
