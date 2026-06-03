const { Op } = require('sequelize');
const { Attendance, Employee } = require('../association');
const { toAttendanceDto } = require('../utils/serializer');
const AppError = require('../utils/AppError');
const { auditEvent } = require('../utils/auditEvents');

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

const attendanceController = {
  today: async (req, res, next) => {
    try {
      if (!req.user.employeeId) return next(AppError.badRequest('User has no linked employee.'));
      const row = await Attendance.findOne({
        where: { employee_id: req.user.employeeId, company_id: req.user.companyId, logged_date: todayDate() },
      });
      res.json(row ? toAttendanceDto(row) : { loggedDate: todayDate(), signedInAt: null, signedOutAt: null, status: null });
    } catch (err) { next(err); }
  },

  month: async (req, res, next) => {
    try {
      if (!req.user.employeeId) return next(AppError.badRequest('User has no linked employee.'));
      const { year, month } = req.query;
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = new Date(Number(year), Number(month), 1);
      const end = endDate.toISOString().slice(0, 10);
      const rows = await Attendance.findAll({
        where: {
          employee_id: req.user.employeeId, company_id: req.user.companyId,
          logged_date: { [Op.gte]: start, [Op.lt]: end },
        },
      });
      const result = {};
      for (const r of rows) result[r.logged_date] = r.status;
      res.json(result);
    } catch (err) { next(err); }
  },

  signIn: async (req, res, next) => {
    try {
      if (!req.user.employeeId) return next(AppError.badRequest('User has no linked employee.'));
      const today = todayDate();
      let row = await Attendance.findOne({
        where: { employee_id: req.user.employeeId, company_id: req.user.companyId, logged_date: today },
      });
      const now = new Date();
      // Simple "late" heuristic: after 09:30 local.
      const isLate = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 30);
      const status = isLate ? 'late' : 'present';
      if (row) {
        if (row.signed_in_at) return res.json(toAttendanceDto(row)); // idempotent
        await row.update({ signed_in_at: now, status });
      } else {
        row = await Attendance.create({
          company_id: req.user.companyId,
          employee_id: req.user.employeeId,
          logged_date: today,
          signed_in_at: now,
          status,
        });
      }
      await auditEvent(req, { entity: 'attendance', action: 'sign_in', entityId: row.attendance_id });
      res.json(toAttendanceDto(row));
    } catch (err) { next(err); }
  },

  signOut: async (req, res, next) => {
    try {
      if (!req.user.employeeId) return next(AppError.badRequest('User has no linked employee.'));
      const row = await Attendance.findOne({
        where: { employee_id: req.user.employeeId, company_id: req.user.companyId, logged_date: todayDate() },
      });
      if (!row) return next(AppError.badRequest('No sign-in for today.'));
      await row.update({ signed_out_at: new Date() });
      await auditEvent(req, { entity: 'attendance', action: 'sign_out', entityId: row.attendance_id });
      res.json(toAttendanceDto(row));
    } catch (err) { next(err); }
  },

  summary: async (req, res, next) => {
    try {
      const date = req.query.date || todayDate();
      const total = await Employee.count({ where: { company_id: req.user.companyId, status: 'active' } });
      const present = await Attendance.count({
        where: {
          company_id: req.user.companyId, logged_date: date,
          status: { [Op.in]: ['present', 'late'] },
          signed_in_at: { [Op.ne]: null },
        },
      });
      const percent = total > 0 ? Math.round((present / total) * 100) : 0;
      res.json({ date, totalEmployees: total, presentToday: present, percent });
    } catch (err) { next(err); }
  },
};

module.exports = attendanceController;
