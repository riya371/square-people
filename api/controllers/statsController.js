const { Op } = require('sequelize');
const { Employee, Task, Attendance, LeaveRequest } = require('../association');

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

const statsController = {
  stats: async (req, res, next) => {
    try {
      const companyId = req.user.companyId;
      const [activeEmployees, newThisMonth, inProgressTasks, totalEmployees, presentToday, pendingLeaves, pendingAwaitingMe] = await Promise.all([
        Employee.count({ where: { company_id: companyId, status: 'active' } }),
        Employee.count({ where: { company_id: companyId, status: 'active', hire_date: { [Op.gte]: startOfMonth() } } }),
        Task.count({ where: { company_id: companyId, status: 'in_progress' } }),
        Employee.count({ where: { company_id: companyId, status: 'active' } }),
        Attendance.count({
          where: {
            company_id: companyId,
            logged_date: today(),
            status: { [Op.in]: ['present', 'late'] },
            signed_in_at: { [Op.ne]: null },
          },
        }),
        LeaveRequest.count({ where: { company_id: companyId, status: 'pending' } }),
        // Awaiting-me approximation: all pending where current user is admin+. Manager-team-filtering deferred.
        LeaveRequest.count({ where: { company_id: companyId, status: 'pending' } }),
      ]);

      const percentToday = totalEmployees > 0 ? Math.round((presentToday / totalEmployees) * 100) : 0;

      res.json({
        activeEmployees: { value: activeEmployees, delta: newThisMonth > 0 ? `+${newThisMonth} this month` : 'no new this month' },
        inProgressTasks: { value: inProgressTasks, sub: '' },
        todayAttendance: { value: `${presentToday} / ${totalEmployees}`, sub: `${percentToday}% present` },
        pendingLeaves: { value: pendingLeaves, sub: pendingAwaitingMe > 0 ? `${pendingAwaitingMe} awaiting your approval` : 'none awaiting you' },
      });
    } catch (err) { next(err); }
  },
};

module.exports = statsController;
