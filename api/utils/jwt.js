const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { randomUUID } = require('crypto');
const env = require('../config/env');

const ACCESS_TTL_SEC = 15 * 60; // 15 minutes
const REFRESH_TTL_SEC = 30 * 24 * 60 * 60; // 30 days

function signAccessToken({ userId, role, companyId, employeeId }) {
  return jwt.sign(
    {
      sub: userId,
      role,
      companyId,
      employeeId: employeeId ?? null,
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TTL_SEC, jwtid: randomUUID() },
  );
}

function signRefreshToken({ userId, role, companyId, employeeId }) {
  const jti = randomUUID();
  const token = jwt.sign(
    {
      sub: userId,
      role,
      companyId,
      employeeId: employeeId ?? null,
      type: 'refresh',
    },
    env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TTL_SEC, jwtid: jti },
  );
  return { token, jti };
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  ACCESS_TTL_SEC,
  REFRESH_TTL_SEC,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
};
