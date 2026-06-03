const { verifyAccessToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');

function requireAuth(req, _res, next) {
  const token = req.cookies?.sp_access;
  if (!token) return next(AppError.unauthenticated('No access token.'));
  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      role: payload.role,
      companyId: payload.companyId,
      employeeId: payload.employeeId,
    };
    next();
  } catch (_err) {
    return next(AppError.unauthenticated('Invalid or expired access token.'));
  }
}

module.exports = requireAuth;
