const { Subtask, Task } = require('../association');
const { toSubtaskDto, STATUS_DTO_TO_DB } = require('../utils/serializer');
const AppError = require('../utils/AppError');
const { auditEvent } = require('../utils/auditEvents');

async function assertTaskInTenant(taskId, companyId) {
  const t = await Task.findOne({ where: { task_id: taskId, company_id: companyId } });
  if (!t) throw AppError.notFound('Task');
  return t;
}
async function nextPosition(taskId) {
  const max = await Subtask.max('position', { where: { task_id: taskId } });
  return (Number.isFinite(max) ? max : -1) + 1;
}

const subtaskController = {
  listForTask: async (req, res, next) => {
    try {
      await assertTaskInTenant(req.params.taskId, req.user.companyId);
      const rows = await Subtask.findAll({
        where: { task_id: req.params.taskId, company_id: req.user.companyId },
        order: [['position', 'ASC']],
      });
      res.json({ data: rows.map(toSubtaskDto) });
    } catch (err) { next(err); }
  },
  create: async (req, res, next) => {
    try {
      await assertTaskInTenant(req.params.taskId, req.user.companyId);
      const dbBody = {
        task_id: Number(req.params.taskId),
        company_id: req.user.companyId,
        title: req.body.title,
        description: req.body.description,
        assigned_to: req.body.assigneeId ?? null,
        status: STATUS_DTO_TO_DB[req.body.status || 'pending'] || 'pending',
        deadline: req.body.deadline,
        position: await nextPosition(req.params.taskId),
      };
      const s = await Subtask.create(dbBody);
      await auditEvent(req, { entity: 'subtask', action: 'create', entityId: s.subtask_id });
      res.status(201).json(toSubtaskDto(s));
    } catch (err) { next(err); }
  },
  update: async (req, res, next) => {
    try {
      await assertTaskInTenant(req.params.taskId, req.user.companyId);
      const s = await Subtask.findOne({
        where: { subtask_id: req.params.id, task_id: req.params.taskId, company_id: req.user.companyId },
      });
      if (!s) return next(AppError.notFound('Subtask'));
      const dbBody = {};
      if (req.body.title !== undefined) dbBody.title = req.body.title;
      if (req.body.description !== undefined) dbBody.description = req.body.description;
      if (req.body.assigneeId !== undefined) dbBody.assigned_to = req.body.assigneeId;
      if (req.body.status !== undefined) dbBody.status = STATUS_DTO_TO_DB[req.body.status] || req.body.status;
      if (req.body.deadline !== undefined) dbBody.deadline = req.body.deadline;
      await s.update(dbBody);
      await auditEvent(req, { entity: 'subtask', action: 'update', entityId: s.subtask_id });
      res.json(toSubtaskDto(s));
    } catch (err) { next(err); }
  },
  remove: async (req, res, next) => {
    try {
      const s = await Subtask.findOne({
        where: { subtask_id: req.params.id, task_id: req.params.taskId, company_id: req.user.companyId },
      });
      if (!s) return next(AppError.notFound('Subtask'));
      const deletedId = s.subtask_id;
      await s.destroy();
      await auditEvent(req, { entity: 'subtask', action: 'delete', entityId: deletedId });
      res.json({ ok: true });
    } catch (err) { next(err); }
  },
};

module.exports = subtaskController;
