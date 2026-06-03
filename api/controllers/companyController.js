const { z } = require('zod');
const { Company, Employee } = require('../association');
const AppError = require('../utils/AppError');
const { auditEvent } = require('../utils/auditEvents');

const updateCompanySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  industry: z.string().max(60).optional(),
  companySize: z.string().max(40).optional(),
  workingDays: z.string().max(40).optional(),
  workingHours: z.string().max(40).optional(),
  address: z.string().max(200).optional(),
  website: z.string().url().max(200).optional(),
  phone: z.string().max(40).optional(),
});

function toCompanyDto(company, headcount) {
  return {
    id: company.company_id,
    slug: company.slug,
    name: company.name,
    industry: company.industry,
    companySize: company.companySize,
    workingDays: company.workingDays,
    workingHours: company.workingHours,
    address: company.address,
    website: company.website,
    phone: company.phone,
    headcount: headcount ?? null,
  };
}

const companyController = {
  getMe: async (req, res, next) => {
    try {
      const company = await Company.findByPk(req.user.companyId);
      if (!company) return next(AppError.notFound('Company'));
      const headcount = await Employee.count({ where: { company_id: req.user.companyId, status: 'active' } });
      res.json(toCompanyDto(company, headcount));
    } catch (err) { next(err); }
  },

  updateMe: async (req, res, next) => {
    try {
      const parsed = updateCompanySchema.parse(req.body);
      const company = await Company.findByPk(req.user.companyId);
      if (!company) return next(AppError.notFound('Company'));
      await company.update(parsed);
      await auditEvent(req, { entity: 'company', action: 'update', entityId: company.company_id });
      res.json(toCompanyDto(company, null));
    } catch (err) {
      if (err?.issues) return next(AppError.validation(err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))));
      next(err);
    }
  },

  workspaceCheck: async (req, res, next) => {
    try {
      const slug = String(req.query.slug || '').toLowerCase().trim();
      if (!/^[a-z0-9-]{2,64}$/.test(slug)) {
        return res.json({ available: false, reason: 'invalid_format' });
      }
      const existing = await Company.findOne({ where: { slug }, attributes: ['company_id'] });
      res.json({ available: !existing });
    } catch (err) { next(err); }
  },
};

module.exports = companyController;
