const sequelize = require('../config/database');
const { Company, Employee, User, RefreshToken } = require('../association');
const { hashPassword } = require('../utils/password');
const { signAccessToken, signRefreshToken, hashToken, REFRESH_TTL_SEC } = require('../utils/jwt');
const { setAccessCookie, setRefreshCookie } = require('../utils/cookies');
const AppError = require('../utils/AppError');
const { auditEvent } = require('../utils/auditEvents');
const crypto = require('crypto');

function toUserDto(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    employeeId: user.employee_id,
    companyId: user.company_id,
    lastLoginAt: user.last_login_at,
  };
}

function toCompanyDto(company) {
  return {
    id: company.company_id,
    slug: company.slug,
    name: company.name,
    industry: company.industry,
    companySize: company.companySize,
    workingDays: company.workingDays,
    workingHours: company.workingHours,
  };
}

async function issueSession(res, user, req) {
  const access = signAccessToken({
    userId: user.id,
    role: user.role,
    companyId: user.company_id,
    employeeId: user.employee_id,
  });
  const { token: refresh, jti } = signRefreshToken({
    userId: user.id,
    role: user.role,
    companyId: user.company_id,
    employeeId: user.employee_id,
  });
  await RefreshToken.create({
    user_id: user.id,
    token_hash: hashToken(refresh),
    expires_at: new Date(Date.now() + REFRESH_TTL_SEC * 1000),
    ip: req.ip,
    ua: req.headers['user-agent'] || null,
  });
  setAccessCookie(res, access);
  setRefreshCookie(res, refresh);
}

const authController = {
  signup: async (req, res, next) => {
    const { fullName, email, password, companyName, workspaceSlug, companySize, industry, workdays } = req.body;
    try {
      const result = await sequelize.transaction(async (t) => {
        // Slug must be globally unique
        const slugTaken = await Company.findOne({ where: { slug: workspaceSlug }, transaction: t });
        if (slugTaken) throw AppError.conflict('WORKSPACE_SLUG_TAKEN', 'That workspace URL is taken.');

        const company = await Company.create(
          {
            name: companyName,
            email,
            slug: workspaceSlug,
            industry: industry || null,
            companySize: companySize || null,
            workingDays: workdays ? workdays.join(',') : null,
          },
          { transaction: t },
        );

        const { nextEmployeeCode } = require('../utils/employeeCode');
        const employee = await Employee.create(
          {
            company_id: company.company_id,
            name: fullName,
            email,
            status: 'active',
            employee_code: await nextEmployeeCode(company.company_id, { transaction: t }),
            hire_date: new Date().toISOString().slice(0, 10),
          },
          { transaction: t },
        );

        const user = await User.create(
          {
            company_id: company.company_id,
            employee_id: employee.employee_id,
            email,
            password_hash: await hashPassword(password),
            role: 'owner',
          },
          { transaction: t },
        );

        return { company, employee, user };
      });

      await issueSession(res, result.user, req);
      req.user = { id: result.user.id, companyId: result.company.company_id };
      await auditEvent(req, { entity: 'user', action: 'signup', entityId: result.user.id });
      res.status(201).json({
        user: toUserDto(result.user),
        company: toCompanyDto(result.company),
      });
    } catch (err) {
      if (err instanceof AppError) return next(err);
      if (err?.name === 'SequelizeUniqueConstraintError') {
        return next(AppError.conflict('EMAIL_TAKEN', 'An account with that email already exists in this workspace.'));
      }
      next(err);
    }
  },

  login: async (req, res, next) => {
    const { email, password, workspaceSlug } = req.body;
    try {
      let user;

      if (workspaceSlug) {
        const company = await Company.findOne({ where: { slug: workspaceSlug } });
        if (!company) return next(AppError.unauthenticated('Workspace not found.'));
        user = await User.findOne({ where: { company_id: company.company_id, email } });
      } else {
        const matches = await User.findAll({ where: { email } });
        if (matches.length === 0) return next(AppError.unauthenticated('Invalid email or password.'));
        if (matches.length > 1) {
          const companies = await Company.findAll({
            where: { company_id: matches.map((m) => m.company_id) },
            attributes: ['company_id', 'slug', 'name'],
          });
          return next(
            AppError.conflict('MULTIPLE_WORKSPACES', 'This email is in multiple workspaces. Specify workspaceSlug.', {
              companies: companies.map((c) => ({ slug: c.slug, name: c.name })),
            }),
          );
        }
        user = matches[0];
      }

      const { verifyPassword } = require('../utils/password');
      if (!user || !(await verifyPassword(password, user.password_hash))) {
        return next(AppError.unauthenticated('Invalid email or password.'));
      }

      await user.update({ last_login_at: new Date(), last_login_ip: req.ip });
      await issueSession(res, user, req);

      const company = await Company.findByPk(user.company_id);
      req.user = { id: user.id, companyId: user.company_id };
      await auditEvent(req, { entity: 'user', action: 'login', entityId: user.id });
      res.json({ user: toUserDto(user), company: toCompanyDto(company) });
    } catch (err) {
      next(err);
    }
  },

  employeeLogin: async (req, res, next) => {
    const { companySlug, employeeCode, pin } = req.body;
    try {
      const company = await Company.findOne({ where: { slug: companySlug } });
      if (!company) return next(AppError.unauthenticated('Invalid credentials.'));

      const employee = await Employee.findOne({
        where: { company_id: company.company_id, employee_code: employeeCode },
      });
      if (!employee) return next(AppError.unauthenticated('Invalid credentials.'));

      const user = await User.findOne({ where: { employee_id: employee.employee_id } });
      if (!user) return next(AppError.unauthenticated('Invalid credentials.'));

      const { verifyPin } = require('../utils/pin');
      if (!(await verifyPin(pin, user.pin_hash))) {
        return next(AppError.unauthenticated('Invalid credentials.'));
      }

      await user.update({ last_login_at: new Date(), last_login_ip: req.ip });
      await issueSession(res, user, req);
      req.user = { id: user.id, companyId: user.company_id };
      await auditEvent(req, { entity: 'user', action: 'login_pin', entityId: user.id });
      res.json({ user: toUserDto(user), company: toCompanyDto(company) });
    } catch (err) {
      next(err);
    }
  },

  refresh: async (req, res, next) => {
    const token = req.cookies?.sp_refresh;
    if (!token) return next(AppError.unauthenticated('No refresh token.'));
    try {
      const { verifyRefreshToken } = require('../utils/jwt');
      const payload = verifyRefreshToken(token);
      const tokenHash = hashToken(token);
      const row = await RefreshToken.findOne({ where: { user_id: payload.sub, token_hash: tokenHash } });
      if (!row || row.revoked_at || row.expires_at < new Date()) {
        return next(AppError.unauthenticated('Refresh token expired or revoked.'));
      }
      const user = await User.findByPk(payload.sub);
      if (!user) return next(AppError.unauthenticated('User no longer exists.'));

      // Rotate: revoke old, issue new
      await row.update({ revoked_at: new Date() });
      await issueSession(res, user, req);
      res.json({ ok: true });
    } catch (_err) {
      return next(AppError.unauthenticated('Invalid refresh token.'));
    }
  },

  logout: async (req, res, next) => {
    try {
      const token = req.cookies?.sp_refresh;
      if (token) {
        await RefreshToken.update({ revoked_at: new Date() }, { where: { user_id: req.user.id, token_hash: hashToken(token) } });
      }
      const { clearAuthCookies } = require('../utils/cookies');
      clearAuthCookies(res);
      await auditEvent(req, { entity: 'user', action: 'logout', entityId: req.user.id });
      res.json({ ok: true });
    } catch (err) { next(err); }
  },

  logoutAll: async (req, res, next) => {
    try {
      await RefreshToken.update(
        { revoked_at: new Date() },
        { where: { user_id: req.user.id, revoked_at: null } },
      );
      const { clearAuthCookies } = require('../utils/cookies');
      clearAuthCookies(res);
      await auditEvent(req, { entity: 'user', action: 'logout_all', entityId: req.user.id });
      res.json({ ok: true });
    } catch (err) { next(err); }
  },

  forgotPassword: async (req, res, next) => {
    const { email } = req.body;
    try {
      const users = await User.findAll({ where: { email } });
      // Always respond 200 regardless to avoid email enumeration.
      for (const user of users) {
        const { PasswordResetToken } = require('../association');
        const raw = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashToken(raw);
        await PasswordResetToken.create({
          user_id: user.id,
          token_hash: tokenHash,
          expires_at: new Date(Date.now() + 30 * 60 * 1000),
        });
        const { mailer } = require('../utils/mailer');
        const env = require('../config/env');
        const employee = user.employee_id ? await Employee.findByPk(user.employee_id) : null;
        await mailer.send({
          to: user.email,
          template: 'password-reset',
          data: {
            name: employee?.name || 'there',
            resetUrl: `${env.FRONTEND_URL}/reset-password?token=${raw}`,
          },
        });
      }
      res.json({ ok: true });
    } catch (err) { next(err); }
  },

  resetPassword: async (req, res, next) => {
    const { token, newPassword } = req.body;
    try {
      const { PasswordResetToken } = require('../association');
      const tokenHash = hashToken(token);
      const row = await PasswordResetToken.findOne({ where: { token_hash: tokenHash } });
      if (!row || row.used_at || row.expires_at < new Date()) {
        return next(AppError.badRequest('Reset link is invalid or expired.'));
      }
      const user = await User.findByPk(row.user_id);
      if (!user) return next(AppError.notFound('User'));
      await user.update({ password_hash: await hashPassword(newPassword) });
      await row.update({ used_at: new Date() });
      // Revoke all existing refresh tokens for safety.
      await RefreshToken.update({ revoked_at: new Date() }, { where: { user_id: user.id, revoked_at: null } });
      req.user = { id: user.id, companyId: user.company_id };
      await auditEvent(req, { entity: 'user', action: 'password_reset', entityId: user.id });
      res.json({ ok: true });
    } catch (err) { next(err); }
  },
};

module.exports = authController;
