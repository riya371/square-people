const { Op, fn, col } = require('sequelize');
const { Task, Subtask, Employee, Project } = require('../association');
const { toTaskDto, paginated, parsePageQuery, STATUS_DTO_TO_DB } = require('../utils/serializer');
const AppError = require('../utils/AppError');
const { auditEvent } = require('../utils/auditEvents');

// Returns a Map of task_id -> subtask count for the given task ids.
async function subtaskCountsFor(taskIds) {
  const counts = new Map();
  if (!taskIds.length) return counts;
  const rows = await Subtask.findAll({
    attributes: ['task_id', [fn('COUNT', col('subtask_id')), 'count']],
    where: { task_id: { [Op.in]: taskIds } },
    group: ['task_id'],
    raw: true,
  });
  for (const r of rows) counts.set(Number(r.task_id), Number(r.count));
  return counts;
}

const ASSIGNEE_PROJECT_INCLUDE = [
  { model: Employee, as: 'assignee', attributes: ['employee_id', 'name'] },
  { model: Project, attributes: ['project_id', 'name'] },
];

// Reload a task with assignee + project + subtask count for create/update responses.
async function loadTaskDto(taskId) {
  const t = await Task.findByPk(taskId, { include: ASSIGNEE_PROJECT_INCLUDE });
  if (!t) return null;
  const counts = await subtaskCountsFor([t.task_id]);
  return toTaskDto(t, { subtasksCount: counts.get(t.task_id) || 0 });
}

async function nextCode(companyId) {
  // Simple counter: count existing + 1 (acceptable for v1; tighten with a sequence in Plan 4).
  const n = await Task.count({ where: { company_id: companyId } });
  return `#${100 + n + 1}`;
}

async function nextPosition(projectId, status) {
  const max = await Task.max('position', { where: { project_id: projectId, status } });
  return (Number.isFinite(max) ? max : -1) + 1;
}

const taskController = {
  list: async (req, res, next) => {
    try {
      const { page, perPage, offset } = parsePageQuery(req.query);
      const where = { company_id: req.user.companyId };
      if (req.query.projectId) where.project_id = Number(req.query.projectId);
      if (req.query.assigneeId) where.assigned_to = Number(req.query.assigneeId);
      if (req.query.status) where.status = STATUS_DTO_TO_DB[req.query.status] || req.query.status;
      if (req.query.priority) where.priority = req.query.priority;
      if (req.query.q) where.title = { [Op.iLike]: `%${req.query.q}%` };
      const { rows, count } = await Task.findAndCountAll({
        where,
        include: ASSIGNEE_PROJECT_INCLUDE,
        order: [['updatedAt', 'DESC']],
        limit: perPage, offset,
      });
      const counts = await subtaskCountsFor(rows.map((t) => t.task_id));
      const data = rows.map((t) => toTaskDto(t, { subtasksCount: counts.get(t.task_id) || 0 }));
      res.json(paginated(data, { page, perPage, total: count }));
    } catch (err) { next(err); }
  },

  kanban: async (req, res, next) => {
    try {
      const where = { company_id: req.user.companyId };
      if (req.query.projectId) where.project_id = Number(req.query.projectId);
      const rows = await Task.findAll({
        where,
        include: ASSIGNEE_PROJECT_INCLUDE,
        order: [['status', 'ASC'], ['position', 'ASC']],
      });
      const counts = await subtaskCountsFor(rows.map((t) => t.task_id));
      const columns = { pending: [], inProgress: [], completed: [] };
      for (const t of rows) {
        const key = t.status === 'in_progress' ? 'inProgress' : t.status;
        columns[key].push(toTaskDto(t, { subtasksCount: counts.get(t.task_id) || 0 }));
      }
      res.json(columns);
    } catch (err) { next(err); }
  },

  getById: async (req, res, next) => {
    try {
      const t = await req.scope(Task).findByPk(req.params.id, {
        include: [{ model: Employee, as: 'assignee' }, { model: Project }, { model: Subtask }],
      });
      if (!t) return next(AppError.notFound('Task'));
      res.json(toTaskDto(t, { subtasks: t.Subtasks?.map((s) => ({ id: s.subtask_id, title: s.title, status: s.status, position: s.position })) || [] }));
    } catch (err) { next(err); }
  },

  create: async (req, res, next) => {
    try {
      // Verify project belongs to tenant
      const project = await Project.findOne({ where: { project_id: req.body.projectId, company_id: req.user.companyId } });
      if (!project) return next(AppError.notFound('Project'));
      const status = STATUS_DTO_TO_DB[req.body.status || 'pending'] || 'pending';
      const dbBody = {
        title: req.body.title,
        description: req.body.description,
        project_id: req.body.projectId,
        assigned_to: req.body.assigneeId ?? null,
        priority: req.body.priority || 'medium',
        status,
        code: await nextCode(req.user.companyId),
        position: await nextPosition(req.body.projectId, status),
      };
      const t = await req.scope(Task).create(dbBody);
      await auditEvent(req, { entity: 'task', action: 'create', entityId: t.task_id });
      res.status(201).json(await loadTaskDto(t.task_id));
    } catch (err) { next(err); }
  },

  update: async (req, res, next) => {
    try {
      const t = await req.scope(Task).findByPk(req.params.id);
      if (!t) return next(AppError.notFound('Task'));
      const dbBody = {};
      if (req.body.title !== undefined) dbBody.title = req.body.title;
      if (req.body.description !== undefined) dbBody.description = req.body.description;
      if (req.body.assigneeId !== undefined) dbBody.assigned_to = req.body.assigneeId;
      if (req.body.priority !== undefined) dbBody.priority = req.body.priority;
      if (req.body.status !== undefined) dbBody.status = STATUS_DTO_TO_DB[req.body.status] || req.body.status;
      // projectId changes are unusual; allow it but recompute position
      if (req.body.projectId !== undefined && req.body.projectId !== t.project_id) {
        dbBody.project_id = req.body.projectId;
        dbBody.position = await nextPosition(req.body.projectId, dbBody.status || t.status);
      }
      await t.update(dbBody);
      await auditEvent(req, { entity: 'task', action: 'update', entityId: t.task_id });
      res.json(await loadTaskDto(t.task_id));
    } catch (err) { next(err); }
  },

  remove: async (req, res, next) => {
    try {
      const t = await req.scope(Task).findByPk(req.params.id);
      if (!t) return next(AppError.notFound('Task'));
      const deletedId = t.task_id;
      await t.destroy();
      await auditEvent(req, { entity: 'task', action: 'delete', entityId: deletedId });
      res.json({ ok: true });
    } catch (err) { next(err); }
  },

  move: async (req, res, next) => {
    const sequelize = require('../config/database');
    const { STATUS_DTO_TO_DB } = require('../utils/serializer');
    const { toColumn, toIndex } = req.body;
    const targetStatus = STATUS_DTO_TO_DB[toColumn];
    try {
      const result = await sequelize.transaction(async (tx) => {
        const task = await Task.findOne({
          where: { task_id: req.params.id, company_id: req.user.companyId },
          transaction: tx,
        });
        if (!task) throw AppError.notFound('Task');

        const fromStatus = task.status;
        const projectId = task.project_id;

        // 1. Open a gap in destination at toIndex.
        const destSiblings = await Task.findAll({
          where: { project_id: projectId, company_id: req.user.companyId, status: targetStatus, task_id: { [require('sequelize').Op.ne]: task.task_id } },
          order: [['position', 'ASC']],
          transaction: tx, lock: true,
        });
        // Compute new positions: 0..toIndex-1 keep, then task slot, then rest shifted by 1.
        const clampedIndex = Math.min(toIndex, destSiblings.length);

        // 2. Close gap in source (only matters if same column or task is leaving the column).
        if (fromStatus !== targetStatus) {
          const sourceSiblings = await Task.findAll({
            where: { project_id: projectId, company_id: req.user.companyId, status: fromStatus, task_id: { [require('sequelize').Op.ne]: task.task_id } },
            order: [['position', 'ASC']],
            transaction: tx, lock: true,
          });
          for (let i = 0; i < sourceSiblings.length; i++) {
            await sourceSiblings[i].update({ position: i }, { transaction: tx });
          }
        }

        // Renumber destSiblings, inserting task at clampedIndex
        for (let i = 0, write = 0; i < destSiblings.length + 1; i++) {
          if (i === clampedIndex) {
            await task.update({ status: targetStatus, position: clampedIndex }, { transaction: tx });
            continue;
          }
          const idx = write < clampedIndex ? write : write + 1;
          if (write < destSiblings.length) {
            await destSiblings[write].update({ position: idx }, { transaction: tx });
            write++;
          }
        }

        // Refresh
        await task.reload({ transaction: tx });
        return task;
      });

      await auditEvent(req, { entity: 'task', action: 'kanban_move', entityId: result.task_id });
      res.json({ ok: true, task: { id: result.task_id, status: toColumn, position: result.position } });
    } catch (err) {
      if (err instanceof AppError) return next(err);
      next(err);
    }
  },
};

module.exports = taskController;
