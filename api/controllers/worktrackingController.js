const { Op } = require('sequelize');
const { WorkTracking, Task, Project } = require('../association');

const TASK_INCLUDE = [{ model: Task, attributes: ['task_id', 'title', 'code'], include: [{ model: Project, attributes: ['project_id', 'name'] }] }];

async function reloadWithTask(entry) {
  return WorkTracking.findByPk(entry.log_id, { include: TASK_INCLUDE });
}
const { toTimeEntryDto } = require('../utils/serializer');
const AppError = require('../utils/AppError');
const { auditEvent } = require('../utils/auditEvents');

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

const worktrackingController = {
  start: async (req, res, next) => {
    try {
      if (!req.user.employeeId) return next(AppError.badRequest('User has no linked employee.'));
      // Auto-stop any running entry for this employee.
      const running = await WorkTracking.findAll({ where: { employee_id: req.user.employeeId, end_time: null } });
      const now = new Date();
      for (const r of running) {
        const duration = Math.round((now - new Date(r.start_time)) / 60000);
        await r.update({ end_time: now, duration_minutes: duration });
      }
      // Confirm task belongs to tenant
      const task = await Task.findOne({ where: { task_id: req.body.taskId, company_id: req.user.companyId } });
      if (!task) return next(AppError.notFound('Task'));
      const entry = await WorkTracking.create({
        company_id: req.user.companyId,
        employee_id: req.user.employeeId,
        task_id: req.body.taskId,
        subtask_id: req.body.subtaskId || null,
        start_time: new Date(),
        end_time: null,
        logged_date: todayDate(),
      });
      await auditEvent(req, { entity: 'worktracking', action: 'timer_start', entityId: entry.log_id });
      res.status(201).json(toTimeEntryDto(await reloadWithTask(entry)));
    } catch (err) { next(err); }
  },

  pause: async (req, res, next) => {
    try {
      const entry = await WorkTracking.findOne({
        where: { log_id: req.params.id, employee_id: req.user.employeeId, company_id: req.user.companyId },
      });
      if (!entry) return next(AppError.notFound('Time entry'));
      if (entry.end_time) return next(AppError.badRequest('Entry already stopped.'));
      const end = new Date();
      const duration = Math.round((end - new Date(entry.start_time)) / 60000);
      await entry.update({ end_time: end, duration_minutes: duration });
      await auditEvent(req, { entity: 'worktracking', action: 'timer_stop', entityId: entry.log_id });
      res.json(toTimeEntryDto(await reloadWithTask(entry)));
    } catch (err) { next(err); }
  },

  resume: async (req, res, next) => {
    try {
      const old = await WorkTracking.findOne({
        where: { log_id: req.params.id, employee_id: req.user.employeeId, company_id: req.user.companyId },
      });
      if (!old) return next(AppError.notFound('Time entry'));
      const entry = await WorkTracking.create({
        company_id: req.user.companyId,
        employee_id: req.user.employeeId,
        task_id: old.task_id,
        subtask_id: old.subtask_id,
        start_time: new Date(),
        end_time: null,
        logged_date: todayDate(),
      });
      await auditEvent(req, { entity: 'worktracking', action: 'timer_start', entityId: entry.log_id });
      res.status(201).json(toTimeEntryDto(await reloadWithTask(entry)));
    } catch (err) { next(err); }
  },

  stop: async (req, res, next) => {
    // alias for pause; explicit endpoint for the frontend's stop button
    return worktrackingController.pause(req, res, next);
  },

  entries: async (req, res, next) => {
    try {
      const date = req.query.date || todayDate();
      const rows = await WorkTracking.findAll({
        where: { employee_id: req.user.employeeId, company_id: req.user.companyId, logged_date: date },
        include: TASK_INCLUDE,
        order: [['start_time', 'ASC']],
      });
      res.json({ data: rows.map(toTimeEntryDto) });
    } catch (err) { next(err); }
  },

  todayTotal: async (req, res, next) => {
    try {
      const rows = await WorkTracking.findAll({
        where: { employee_id: req.user.employeeId, company_id: req.user.companyId, logged_date: todayDate() },
      });
      const totalSec = rows.reduce((acc, r) => {
        const end = r.end_time ? new Date(r.end_time) : new Date();
        return acc + Math.round((end - new Date(r.start_time)) / 1000);
      }, 0);
      res.json({ totalSec });
    } catch (err) { next(err); }
  },

  weeklyHours: async (req, res, next) => {
    try {
      const weekOf = req.query.weekOf || todayDate();
      // Build Mon..Sun starting from weekOf if it's a Monday, else snap back.
      const d = new Date(weekOf);
      const dayOfWeek = (d.getDay() + 6) % 7; // 0 = Mon
      const monday = new Date(d);
      monday.setDate(d.getDate() - dayOfWeek);
      const days = [];
      for (let i = 0; i < 7; i++) {
        const day = new Date(monday);
        day.setDate(monday.getDate() + i);
        days.push(day.toISOString().slice(0, 10));
      }
      const rows = await WorkTracking.findAll({
        where: {
          employee_id: req.user.employeeId, company_id: req.user.companyId,
          logged_date: { [Op.in]: days },
        },
      });
      const byDay = {};
      for (const day of days) byDay[day] = 0;
      for (const r of rows) {
        const end = r.end_time ? new Date(r.end_time) : new Date();
        byDay[r.logged_date] += Math.round((end - new Date(r.start_time)) / 1000);
      }
      const max = Math.max(1, ...Object.values(byDay));
      const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const data = days.map((day, i) => ({
        day: labels[i],
        date: day,
        sec: byDay[day],
        percent: Math.round((byDay[day] / max) * 100),
      }));
      res.json({ data });
    } catch (err) { next(err); }
  },
};

module.exports = worktrackingController;
