const express = require('express');
const router = express.Router();
const { z } = require('zod');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const requireTenant = require('../middleware/requireTenant');
const validate = require('../middleware/validate');
const { idParam, teamBody, assignTeamMembersBody, pageQuery } = require('../validators/resourceValidators');
const controller = require('../controllers/teamController');

router.use(requireAuth, requireTenant);

router.get('/', validate({ query: pageQuery }), controller.list);
router.get('/:id', validate({ params: idParam }), controller.getById);
router.post('/', requireRole('admin'), validate({ body: teamBody }), controller.create);
router.patch('/:id', requireRole('admin'), validate({ params: idParam, body: teamBody.partial() }), controller.update);
router.delete('/:id', requireRole('admin'), validate({ params: idParam }), controller.remove);

router.post('/:id/members', requireRole('admin'), validate({ params: idParam, body: assignTeamMembersBody }), controller.setMembers);
router.delete('/:id/members/:employeeId',
  requireRole('admin'),
  validate({ params: z.object({ id: z.coerce.number().int().positive(), employeeId: z.coerce.number().int().positive() }) }),
  controller.removeMember,
);

module.exports = router;
