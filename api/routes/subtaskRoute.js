const express = require('express');
const router = express.Router({ mergeParams: true });
const { z } = require('zod');
const requireAuth = require('../middleware/requireAuth');
const requireTenant = require('../middleware/requireTenant');
const validate = require('../middleware/validate');
const { subtaskBody } = require('../validators/resourceValidators');
const controller = require('../controllers/subtaskController');

const paramsCreate = z.object({ taskId: z.coerce.number().int().positive() });
const paramsItem = z.object({ taskId: z.coerce.number().int().positive(), id: z.coerce.number().int().positive() });

router.use(requireAuth, requireTenant);

router.get('/tasks/:taskId/subtasks', validate({ params: paramsCreate }), controller.listForTask);
router.post('/tasks/:taskId/subtasks', validate({ params: paramsCreate, body: subtaskBody }), controller.create);
router.patch('/tasks/:taskId/subtasks/:id', validate({ params: paramsItem, body: subtaskBody.partial() }), controller.update);
router.delete('/tasks/:taskId/subtasks/:id', validate({ params: paramsItem }), controller.remove);

module.exports = router;
