const sequelize = require('../config/database');
const { LeaveRequest, LeaveApproval, Attendance, Employee } = require('../association');
const { toLeaveRequestDto } = require('../utils/serializer');
const AppError = require('../utils/AppError');
const { auditEvent } = require('../utils/auditEvents');

function* dateRange(start, end) {
  const d = new Date(start);
  const last = new Date(end);
  while (d <= last) {
    yield d.toISOString().slice(0, 10);
    d.setDate(d.getDate() + 1);
  }
}

const leaveApprovalController = {
  approve: async (req, res, next) => {
    try {
      const result = await sequelize.transaction(async (tx) => {
        const lr = await LeaveRequest.findOne({
          where: { leave_id: req.params.id, company_id: req.user.companyId },
          transaction: tx,
        });
        if (!lr) throw AppError.notFound('Leave request');
        if (lr.status !== 'pending') throw AppError.businessRule('LEAVE_ALREADY_DECIDED', 'Already decided.');
        if (!req.user.employeeId) throw AppError.badRequest('Approver has no linked employee.');

        await LeaveApproval.create({
          company_id: req.user.companyId,
          leave_request_id: lr.leave_id,
          approver_id: req.user.employeeId,
          decision: 'approved',
          reason: null,
          decided_at: new Date(),
        }, { transaction: tx });

        await lr.update({ status: 'approved' }, { transaction: tx });

        // Write attendance rows for every day in the leave range with status 'leave'.
        for (const day of dateRange(lr.start_date, lr.end_date)) {
          const existing = await Attendance.findOne({
            where: { company_id: req.user.companyId, employee_id: lr.employee_id, logged_date: day },
            transaction: tx,
          });
          if (existing) {
            await existing.update({ status: 'leave' }, { transaction: tx });
          } else {
            await Attendance.create({
              company_id: req.user.companyId,
              employee_id: lr.employee_id,
              logged_date: day,
              status: 'leave',
            }, { transaction: tx });
          }
        }
        return lr;
      });

      try {
        const { mailer } = require('../utils/mailer');
        const requester = await Employee.findByPk(result.employee_id);
        if (requester?.email) {
          const days = result.days;
          await mailer.send({
            to: requester.email,
            template: 'leave-decision',
            data: {
              employeeName: requester.name,
              decision: 'approved',
              leaveType: result.leave_type,
              startDate: result.start_date,
              endDate: result.end_date,
              days,
              daysPlural: days === 1 ? '' : 's',
              reason: '(none)',
            },
          });
        }
      } catch (e) { /* best effort */ }

      const fresh = await LeaveRequest.findByPk(result.leave_id);
      await auditEvent(req, { entity: 'leaverequest', action: 'approve', entityId: result.leave_id });
      res.json(toLeaveRequestDto(fresh));
    } catch (err) {
      if (err instanceof AppError) return next(err);
      next(err);
    }
  },

  reject: async (req, res, next) => {
    try {
      const lr = await LeaveRequest.findOne({
        where: { leave_id: req.params.id, company_id: req.user.companyId },
      });
      if (!lr) return next(AppError.notFound('Leave request'));
      if (lr.status !== 'pending') return next(AppError.businessRule('LEAVE_ALREADY_DECIDED', 'Already decided.'));
      if (!req.user.employeeId) return next(AppError.badRequest('Approver has no linked employee.'));

      await LeaveApproval.create({
        company_id: req.user.companyId,
        leave_request_id: lr.leave_id,
        approver_id: req.user.employeeId,
        decision: 'rejected',
        reason: req.body?.reason || null,
        decided_at: new Date(),
      });
      await lr.update({ status: 'rejected' });

      try {
        const { mailer } = require('../utils/mailer');
        const requester = await Employee.findByPk(lr.employee_id);
        if (requester?.email) {
          const days = lr.days;
          await mailer.send({
            to: requester.email,
            template: 'leave-decision',
            data: {
              employeeName: requester.name,
              decision: 'rejected',
              leaveType: lr.leave_type,
              startDate: lr.start_date,
              endDate: lr.end_date,
              days,
              daysPlural: days === 1 ? '' : 's',
              reason: req.body?.reason || '(no reason given)',
            },
          });
        }
      } catch (e) { /* best effort */ }

      await auditEvent(req, { entity: 'leaverequest', action: 'reject', entityId: lr.leave_id });
      res.json(toLeaveRequestDto(lr));
    } catch (err) { next(err); }
  },
};

module.exports = leaveApprovalController;
