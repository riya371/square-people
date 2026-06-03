const { z } = require('zod');
const { User, Employee, Company } = require('../association');
const { hashPassword, verifyPassword } = require('../utils/password');
const { hashPin, isValidPin, verifyPin } = require('../utils/pin');
const AppError = require('../utils/AppError');

const updateMeSchema = z.object({
  // Limited safe fields only — name and phone live on Employee.
  name: z.string().min(1).max(120).optional(),
  phone: z.string().max(40).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const setPinSchema = z.object({
  currentPassword: z.string().min(1).optional(),
  currentPin: z.string().regex(/^\d{4}$/).optional(),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits.'),
}).refine((d) => d.currentPassword || d.currentPin, {
  message: 'Provide your current password or current PIN to confirm.',
  path: ['currentPassword'],
});

const PERMISSIONS_BY_ROLE = {
  owner:   ['*'],
  admin:   ['employees:write', 'roles:write', 'teams:write', 'projects:write', 'tasks:write', 'leaves:approve', 'audit:read'],
  manager: ['teams:write', 'projects:write', 'tasks:write', 'leaves:approve'],
  member:  ['tasks:update_own', 'time:write', 'attendance:write', 'leaves:create'],
};

const meController = {
  getMe: async (req, res, next) => {
    try {
      const user = await User.findByPk(req.user.id);
      if (!user) return next(AppError.unauthenticated());
      const company = await Company.findByPk(user.company_id);
      const employee = user.employee_id ? await Employee.findByPk(user.employee_id) : null;
      res.json({
        user: {
          id: user.id, email: user.email, role: user.role,
          employeeId: user.employee_id, companyId: user.company_id,
          lastLoginAt: user.last_login_at,
        },
        company: company && {
          id: company.company_id, slug: company.slug, name: company.name,
          industry: company.industry, companySize: company.companySize,
          workingDays: company.workingDays, workingHours: company.workingHours,
        },
        employee: employee && {
          id: employee.employee_id, name: employee.name, email: employee.email,
          phone: employee.phone, departmentId: employee.department_id,
          employeeCode: employee.employee_code, status: employee.status,
          hireDate: employee.hire_date,
        },
        permissions: PERMISSIONS_BY_ROLE[user.role] || [],
      });
    } catch (err) { next(err); }
  },

  patchMe: async (req, res, next) => {
    try {
      const parsed = updateMeSchema.parse(req.body);
      if (!req.user.employeeId) return next(AppError.badRequest('No linked employee record.'));
      const employee = await Employee.findByPk(req.user.employeeId);
      if (!employee) return next(AppError.notFound('Employee'));
      await employee.update(parsed);
      res.json({ ok: true });
    } catch (err) {
      if (err?.issues) return next(AppError.validation(err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))));
      next(err);
    }
  },

  changePassword: async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
      const user = await User.findByPk(req.user.id);
      if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
        return next(AppError.unauthenticated('Current password is incorrect.'));
      }
      await user.update({ password_hash: await hashPassword(newPassword) });
      res.json({ ok: true });
    } catch (err) {
      if (err?.issues) return next(AppError.validation(err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))));
      next(err);
    }
  },

  setPin: async (req, res, next) => {
    try {
      const { currentPassword, currentPin, pin } = setPinSchema.parse(req.body);
      const user = await User.findByPk(req.user.id);
      if (!user) return next(AppError.unauthenticated());
      const passwordOk = currentPassword && user.password_hash && await verifyPassword(currentPassword, user.password_hash);
      const pinOk = currentPin && user.pin_hash && await verifyPin(currentPin, user.pin_hash);
      if (!passwordOk && !pinOk) {
        return next(AppError.unauthenticated('Current password or PIN is incorrect.'));
      }
      if (!isValidPin(pin)) return next(AppError.badRequest('PIN must be exactly 4 digits.'));
      await user.update({ pin_hash: await hashPin(pin) });
      res.json({ ok: true });
    } catch (err) {
      if (err?.issues) return next(AppError.validation(err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))));
      next(err);
    }
  },
};

module.exports = meController;
