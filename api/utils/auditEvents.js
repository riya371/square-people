const { AuditLog } = require('../association');

// Diff helper: keep only changed keys from `next` compared to `prev`.
function computeDiff(prev, next) {
  if (!prev || !next) return next || null;
  const out = {};
  for (const k of Object.keys(next)) {
    if (JSON.stringify(prev[k]) !== JSON.stringify(next[k])) out[k] = { from: prev[k] ?? null, to: next[k] ?? null };
  }
  return Object.keys(out).length ? out : null;
}

async function auditEvent(req, { entity, action, entityId = null, diff = null }) {
  try {
    if (!req?.user?.companyId) return;
    await AuditLog.create({
      company_id: req.user.companyId,
      actor_user_id: req.user.id ?? null,
      entity,
      entity_id: entityId == null ? null : String(entityId),
      action,
      diff,
      ip: req.ip || null,
      ua: req.headers?.['user-agent'] || null,
    });
  } catch (err) {
    if (req?.log) req.log.warn({ err }, 'auditEvent failed');
    else console.warn('auditEvent failed:', err.message);
  }
}

module.exports = { auditEvent, computeDiff };
