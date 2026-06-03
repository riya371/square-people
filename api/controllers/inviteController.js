const crypto = require('crypto');
const { Op } = require('sequelize');
const { Invite, Employee, Company, User } = require('../association');
const { hashToken } = require('../utils/jwt');
const { hashPassword } = require('../utils/password');
const { hashPin } = require('../utils/pin');
const { mailer } = require('../utils/mailer');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const { auditEvent } = require('../utils/auditEvents');

const INVITE_TTL_DAYS = 7;

function toInviteDto(i) {
  return {
    id: i.id,
    email: i.email,
    role: i.role,
    employeeId: i.employee_id,
    expiresAt: i.expires_at,
    acceptedAt: i.accepted_at,
    createdAt: i.createdAt,
  };
}

async function emailInvite(invite, rawToken, req) {
  const inviter = req.user?.id ? await User.findByPk(req.user.id) : null;
  const inviterEmployee = inviter?.employee_id ? await Employee.findByPk(inviter.employee_id) : null;
  const company = await Company.findByPk(invite.company_id);
  const acceptUrl = `${env.FRONTEND_URL}/accept-invite?token=${rawToken}`;
  await mailer.send({
    to: invite.email,
    template: 'invite',
    data: {
      companyName: company?.name || 'your workspace',
      inviterName: inviterEmployee?.name || inviter?.email || 'An admin',
      role: invite.role,
      acceptUrl,
    },
  });
}

const inviteController = {
  list: async (req, res, next) => {
    try {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const rows = await Invite.findAll({
        where: {
          company_id: req.user.companyId,
          [Op.or]: [{ accepted_at: null }, { accepted_at: { [Op.gte]: cutoff } }],
        },
        order: [['createdAt', 'DESC']],
      });
      res.json({ data: rows.map(toInviteDto) });
    } catch (err) { next(err); }
  },

  create: async (req, res, next) => {
    try {
      const rawToken = crypto.randomBytes(24).toString('hex');
      const invite = await Invite.create({
        company_id: req.user.companyId,
        email: req.body.email,
        role: req.body.role || 'member',
        employee_id: req.body.employeeId || null,
        token_hash: hashToken(rawToken),
        expires_at: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
        created_by_user_id: req.user.id,
      });
      await emailInvite(invite, rawToken, req);
      await auditEvent(req, { entity: 'invite', action: 'create', entityId: invite.id });
      res.status(201).json(toInviteDto(invite));
    } catch (err) { next(err); }
  },

  remove: async (req, res, next) => {
    try {
      const invite = await req.scope(Invite).findByPk(req.params.id);
      if (!invite) return next(AppError.notFound('Invite'));
      if (invite.accepted_at) return next(AppError.businessRule('INVITE_ACCEPTED', 'Cannot revoke an accepted invite.'));
      await invite.destroy();
      await auditEvent(req, { entity: 'invite', action: 'delete', entityId: req.params.id });
      res.json({ ok: true });
    } catch (err) { next(err); }
  },

  resend: async (req, res, next) => {
    try {
      const invite = await req.scope(Invite).findByPk(req.params.id);
      if (!invite) return next(AppError.notFound('Invite'));
      if (invite.accepted_at) return next(AppError.businessRule('INVITE_ACCEPTED', 'Cannot resend an accepted invite.'));
      const rawToken = crypto.randomBytes(24).toString('hex');
      await invite.update({
        token_hash: hashToken(rawToken),
        expires_at: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
      });
      await emailInvite(invite, rawToken, req);
      await auditEvent(req, { entity: 'invite', action: 'resend', entityId: invite.id });
      res.json(toInviteDto(invite));
    } catch (err) { next(err); }
  },

  acceptGet: async (req, res, next) => {
    try {
      const tokenHash = hashToken(String(req.query.token || ''));
      const invite = await Invite.findOne({ where: { token_hash: tokenHash } });
      if (!invite) return next(AppError.notFound('Invite'));
      if (invite.accepted_at) return res.json({ status: 'accepted' });
      if (invite.expires_at < new Date()) return res.json({ status: 'expired' });
      const company = await Company.findByPk(invite.company_id);
      res.json({
        status: 'pending',
        invite: {
          companyName: company?.name,
          role: invite.role,
          email: invite.email,
        },
      });
    } catch (err) { next(err); }
  },

  acceptPost: async (req, res, next) => {
    const sequelize = require('../config/database');
    const { signAccessToken, signRefreshToken, REFRESH_TTL_SEC } = require('../utils/jwt');
    const { setAccessCookie, setRefreshCookie } = require('../utils/cookies');
    const { RefreshToken } = require('../association');
    const { token, fullName, password, pin } = req.body;
    try {
      const result = await sequelize.transaction(async (t) => {
        const tokenHash = hashToken(token);
        const invite = await Invite.findOne({ where: { token_hash: tokenHash }, transaction: t });
        if (!invite) throw AppError.notFound('Invite');
        if (invite.accepted_at) throw AppError.businessRule('INVITE_ACCEPTED', 'Invite already accepted.');
        if (invite.expires_at < new Date()) throw AppError.businessRule('INVITE_EXPIRED', 'Invite expired.');

        const { nextEmployeeCode } = require('../utils/employeeCode');
        let employee = invite.employee_id ? await Employee.findByPk(invite.employee_id, { transaction: t }) : null;
        if (!employee) {
          employee = await Employee.create({
            company_id: invite.company_id,
            name: fullName,
            email: invite.email,
            status: 'active',
            employee_code: await nextEmployeeCode(invite.company_id, { transaction: t }),
            hire_date: new Date().toISOString().slice(0, 10),
          }, { transaction: t });
        } else if (!employee.employee_code) {
          await employee.update({ employee_code: await nextEmployeeCode(invite.company_id, { transaction: t }) }, { transaction: t });
        }
        const user = await User.create({
          company_id: invite.company_id,
          employee_id: employee.employee_id,
          email: invite.email,
          password_hash: await hashPassword(password),
          pin_hash: pin ? await hashPin(pin) : null,
          role: invite.role,
        }, { transaction: t });
        await invite.update({ accepted_at: new Date() }, { transaction: t });
        return { user, employee, companyId: invite.company_id };
      });

      // Issue session (post-transaction)
      const access = signAccessToken({ userId: result.user.id, role: result.user.role, companyId: result.user.company_id, employeeId: result.user.employee_id });
      const { token: refresh } = signRefreshToken({ userId: result.user.id, role: result.user.role, companyId: result.user.company_id, employeeId: result.user.employee_id });
      await RefreshToken.create({ user_id: result.user.id, token_hash: hashToken(refresh), expires_at: new Date(Date.now() + REFRESH_TTL_SEC * 1000), ip: req.ip, ua: req.headers['user-agent'] || null });
      setAccessCookie(res, access);
      setRefreshCookie(res, refresh);

      await auditEvent({ ...req, user: { ...result.user.toJSON(), id: result.user.id, companyId: result.user.company_id } }, { entity: 'user', action: 'invite_accept', entityId: result.user.id });

      res.json({
        user: { id: result.user.id, email: result.user.email, role: result.user.role, companyId: result.user.company_id, employeeId: result.user.employee_id },
      });
    } catch (err) {
      if (err instanceof AppError) return next(err);
      next(err);
    }
  },
};

module.exports = inviteController;
