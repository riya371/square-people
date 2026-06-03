const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const requireTenant = require('../middleware/requireTenant');
const validate = require('../middleware/validate');
const { z } = require('zod');
const { idParam, employeeBody, employeeListQuery, assignRolesBody } = require('../validators/resourceValidators');
const controller = require('../controllers/employeeController');

router.use(requireAuth, requireTenant);

router.get('/', validate({ query: employeeListQuery }), controller.list);
router.get('/:id', validate({ params: idParam }), controller.getById);
router.post('/', requireRole('admin'), validate({ body: employeeBody }), controller.create);
router.patch('/:id', requireRole('admin'), validate({ params: idParam, body: employeeBody.partial() }), controller.update);
router.delete('/:id', requireRole('admin'), validate({ params: idParam }), controller.remove);

router.post('/:id/roles', requireRole('admin'), validate({ params: idParam, body: assignRolesBody }), controller.assignRoles);
router.delete('/:id/roles/:roleId',
  requireRole('admin'),
  validate({ params: z.object({ id: z.coerce.number().int().positive(), roleId: z.coerce.number().int().positive() }) }),
  controller.removeRole,
);

router.get('/:id/tasks', validate({ params: idParam }), controller.listTasks);
router.get('/:id/attendance', validate({ params: idParam, query: z.object({ year: z.coerce.number().int().optional(), month: z.coerce.number().int().optional() }) }), controller.listAttendance);
router.get('/:id/leaves', validate({ params: idParam }), controller.listLeaves);

module.exports = router;
