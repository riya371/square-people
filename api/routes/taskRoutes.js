const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const requireTenant = require('../middleware/requireTenant');
const validate = require('../middleware/validate');
const { idParam, taskBody, taskUpdateBody, taskListQuery, taskKanbanQuery, taskMoveBody } = require('../validators/resourceValidators');
const controller = require('../controllers/taskController');

router.use(requireAuth, requireTenant);

router.get('/kanban', validate({ query: taskKanbanQuery }), controller.kanban);
router.get('/', validate({ query: taskListQuery }), controller.list);
router.get('/:id', validate({ params: idParam }), controller.getById);
router.post('/', validate({ body: taskBody }), controller.create);
router.patch('/:id', validate({ params: idParam, body: taskUpdateBody }), controller.update);
router.delete('/:id', validate({ params: idParam }), controller.remove);
router.post('/:id/move', validate({ params: idParam, body: taskMoveBody }), controller.move);

module.exports = router;
