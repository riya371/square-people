const { Op } = require('sequelize');
const { LeaveRequest, Employee, Role } = require('../association');
const { toLeaveRequestDto } = require('../utils/serializer');
const AppError = require('../utils/AppError');
const { auditEvent } = require('../utils/auditEvents');

function diffDays(start, end) {
  const a = new Date(start);
  const b = new Date(end);
  return Math.round((b - a) / 86400000) + 1;
}

const leaveController = {
  mine: async (req, res, next) => {
    try {
      if (!req.user.employeeId) return next(AppError.badRequest('User has no linked employee.'));
      const rows = await LeaveRequest.findAll({
        where: { company_id: req.user.companyId, employee_id: req.user.employeeId },
        order: [['created_at', 'DESC']],
      });
      res.json({ data: rows.map(toLeaveRequestDto) });
    } catch (err) { next(err); }
  },

  pending: async (req, res, next) => {
    try {
      // Admin+: see all pending. Manager: see only their team members' pending (deferred until team-membership lookup is needed).
      // For v1: admin+ sees all; manager-only filtering is a Plan 4 concern.
      const rows = await LeaveRequest.findAll({
        where: { company_id: req.user.companyId, status: 'pending' },
        include: [{ model: Employee, as: 'employee', include: [{ model: Role, as: 'roles', through: { attributes: [] } }] }],
        order: [['created_at', 'DESC']],
      });
      res.json({ data: rows.map(toLeaveRequestDto) });
    } catch (err) { next(err); }
  },

  create: async (req, res, next) => {
    try {
      if (!req.user.employeeId) return next(AppError.badRequest('User has no linked employee.'));
      const { type, startDate, endDate, reason } = req.body;
      if (new Date(endDate) < new Date(startDate)) {
        return next(AppError.badRequest('End date must be on or after start date.'));
      }
      const lr = await LeaveRequest.create({
        company_id: req.user.companyId,
        employee_id: req.user.employeeId,
        leave_type: type,
        start_date: startDate,
        end_date: endDate,
        days: diffDays(startDate, endDate),
        reason: reason || null,
        status: 'pending',
      });

      // Notify the user's manager (if any) + all admins/owners as a fallback.
      try {
        const { mailer } = require('../utils/mailer');
        const env = require('../config/env');
        const employee = await Employee.findByPk(req.user.employeeId);
        const recipients = new Set();
        if (employee?.manager_id) {
          const manager = await Employee.findByPk(employee.manager_id);
          if (manager?.email) recipients.add(manager.email);
        }
        if (recipients.size === 0) {
          const { User } = require('../association');
          const admins = await User.findAll({ where: { company_id: req.user.companyId, role: ['owner', 'admin'] }, attributes: ['email'] });
          for (const u of admins) recipients.add(u.email);
        }
        const days = lr.days;
        for (const to of recipients) {
          await mailer.send({
            to,
            template: 'leave-submitted',
            data: {
              employeeName: employee?.name || 'A team member',
              leaveType: lr.leave_type,
              startDate: lr.start_date,
              endDate: lr.end_date,
              days,
              daysPlural: days === 1 ? '' : 's',
              reason: lr.reason || '(no reason given)',
              reviewUrl: `${env.FRONTEND_URL}/app/leaves`,
            },
          });
        }
      } catch (e) { /* best effort */ }

      await auditEvent(req, { entity: 'leaverequest', action: 'create', entityId: lr.leave_id });
      res.status(201).json(toLeaveRequestDto(lr));
    } catch (err) { next(err); }
  },

  update: async (req, res, next) => {
    try {
      const lr = await LeaveRequest.findOne({
        where: { leave_id: req.params.id, company_id: req.user.companyId, employee_id: req.user.employeeId },
      });
      if (!lr) return next(AppError.notFound('Leave request'));
      if (lr.status !== 'pending') return next(AppError.businessRule('LEAVE_NOT_EDITABLE', 'Only pending requests can be edited.'));
      const dbBody = {};
      if (req.body.type !== undefined) dbBody.leave_type = req.body.type;
      if (req.body.startDate !== undefined) dbBody.start_date = req.body.startDate;
      if (req.body.endDate !== undefined) dbBody.end_date = req.body.endDate;
      if (req.body.reason !== undefined) dbBody.reason = req.body.reason;
      if (dbBody.start_date || dbBody.end_date) {
        const s = dbBody.start_date || lr.start_date;
        const e = dbBody.end_date || lr.end_date;
        if (new Date(e) < new Date(s)) return next(AppError.badRequest('End date must be on or after start date.'));
        dbBody.days = diffDays(s, e);
      }
      await lr.update(dbBody);
      await auditEvent(req, { entity: 'leaverequest', action: 'update', entityId: lr.leave_id });
      res.json(toLeaveRequestDto(lr));
    } catch (err) { next(err); }
  },

  cancel: async (req, res, next) => {
    try {
      const lr = await LeaveRequest.findOne({
        where: { leave_id: req.params.id, company_id: req.user.companyId, employee_id: req.user.employeeId },
      });
      if (!lr) return next(AppError.notFound('Leave request'));
      if (lr.status !== 'pending') return next(AppError.businessRule('LEAVE_NOT_CANCELABLE', 'Only pending requests can be cancelled.'));
      const deletedId = lr.leave_id;
      await lr.destroy();
      await auditEvent(req, { entity: 'leaverequest', action: 'delete', entityId: deletedId });
      res.json({ ok: true });
    } catch (err) { next(err); }
  },
};

module.exports = leaveController;
