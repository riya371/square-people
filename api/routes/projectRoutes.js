const express = require('express');
const router = express.Router();
const { z } = require('zod');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const requireTenant = require('../middleware/requireTenant');
const validate = require('../middleware/validate');
const { idParam, projectBody, assignProjectTeamsBody, pageQuery } = require('../validators/resourceValidators');
const controller = require('../controllers/projectController');

router.use(requireAuth, requireTenant);

router.get('/', validate({ query: pageQuery }), controller.list);
router.get('/:id', validate({ params: idParam }), controller.getById);
router.post('/', requireRole('manager'), validate({ body: projectBody }), controller.create);
router.patch('/:id', requireRole('manager'), validate({ params: idParam, body: projectBody.partial() }), controller.update);
router.delete('/:id', requireRole('admin'), validate({ params: idParam }), controller.remove);

router.post('/:id/teams', requireRole('admin'), validate({ params: idParam, body: assignProjectTeamsBody }), controller.setTeams);
router.delete('/:id/teams/:teamId',
  requireRole('admin'),
  validate({ params: z.object({ id: z.coerce.number().int().positive(), teamId: z.coerce.number().int().positive() }) }),
  controller.removeTeam,
);

module.exports = router;
