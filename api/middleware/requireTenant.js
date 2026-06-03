const AppError = require('../utils/AppError');

function makeScope(companyId) {
  function withTenant(opts = {}) {
    const where = { ...(opts.where || {}), company_id: companyId };
    return { ...opts, where };
  }

  return function scope(Model) {
    return {
      findAll: (opts) => Model.findAll(withTenant(opts)),
      findOne: (opts) => Model.findOne(withTenant(opts)),
      findByPk: (id, opts = {}) =>
        Model.findOne({ ...opts, where: { ...(opts.where || {}), [Model.primaryKeyAttribute]: id, company_id: companyId } }),
      count: (opts) => Model.count(withTenant(opts)),
      create: (values, opts = {}) => Model.create({ ...values, company_id: companyId }, opts),
      update: (values, opts) => Model.update(values, withTenant(opts)),
      destroy: (opts) => Model.destroy(withTenant(opts)),
    };
  };
}

function requireTenant(req, _res, next) {
  if (!req.user?.companyId) {
    return next(AppError.unauthenticated('No tenant context.'));
  }
  req.scope = makeScope(req.user.companyId);
  next();
}

module.exports = requireTenant;
