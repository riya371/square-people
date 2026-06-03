const { auditEvent } = require('../utils/auditEvents');

// Usage: router.post('/', audit('department', 'create'), handler)
// Wraps res.json so the audit row fires after the handler returns 2xx.
// For richer diffs / entity_id, controllers should call auditEvent() directly.
function audit(entity, action) {
  return (req, res, next) => {
    const origJson = res.json.bind(res);
    res.json = (payload) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const entityId = payload?.id || payload?.data?.id || null;
        auditEvent(req, { entity, action, entityId });
      }
      return origJson(payload);
    };
    next();
  };
}

module.exports = audit;
