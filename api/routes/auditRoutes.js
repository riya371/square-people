const express = require('express');
const router = express.Router();
const { z } = require('zod');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const requireTenant = require('../middleware/requireTenant');
const validate = require('../middleware/validate');
const controller = require('../controllers/auditController');

const auditQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  perPage: z.coerce.number().int().positive().max(100).optional(),
  entity: z.string().optional(),
  action: z.string().optional(),
  actorId: z.coerce.number().int().positive().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

router.use(requireAuth, requireTenant, requireRole('admin'));
router.get('/', validate({ query: auditQuery }), controller.list);

module.exports = router;
