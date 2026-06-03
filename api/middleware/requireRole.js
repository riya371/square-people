const AppError = require('../utils/AppError');

const HIERARCHY = ['member', 'manager', 'admin', 'owner'];

function requireRole(minRole) {
  const minRank = HIERARCHY.indexOf(minRole);
  if (minRank === -1) throw new Error(`Unknown role: ${minRole}`);

  return (req, _res, next) => {
    if (!req.user?.role) return next(AppError.unauthenticated());
    const userRank = HIERARCHY.indexOf(req.user.role);
    if (userRank < minRank) {
      return next(AppError.forbidden(`Requires ${minRole} or higher.`));
    }
    next();
  };
}

module.exports = requireRole;
