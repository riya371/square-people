const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const requireTenant = require('../middleware/requireTenant');
const validate = require('../middleware/validate');
const { idParam, roleBody, pageQuery } = require('../validators/resourceValidators');
const controller = require('../controllers/roleController');

router.use(requireAuth, requireTenant);

router.get('/', validate({ query: pageQuery }), controller.list);
router.get('/:id', validate({ params: idParam }), controller.getById);
router.post('/', requireRole('admin'), validate({ body: roleBody }), controller.create);
router.patch('/:id', requireRole('admin'), validate({ params: idParam, body: roleBody.partial() }), controller.update);
router.delete('/:id', requireRole('admin'), validate({ params: idParam }), controller.remove);

module.exports = router;
