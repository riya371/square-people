const env = require('../config/env');
const { ACCESS_TTL_SEC, REFRESH_TTL_SEC } = require('./jwt');

const baseFlags = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'lax',
  domain: env.COOKIE_DOMAIN,
};

function setAccessCookie(res, token) {
  res.cookie('sp_access', token, {
    ...baseFlags,
    path: '/',
    maxAge: ACCESS_TTL_SEC * 1000,
  });
}

function setRefreshCookie(res, token) {
  res.cookie('sp_refresh', token, {
    ...baseFlags,
    path: '/api/auth',
    maxAge: REFRESH_TTL_SEC * 1000,
  });
}

function clearAuthCookies(res) {
  res.clearCookie('sp_access', { ...baseFlags, path: '/' });
  res.clearCookie('sp_refresh', { ...baseFlags, path: '/api/auth' });
}

module.exports = { setAccessCookie, setRefreshCookie, clearAuthCookies };
