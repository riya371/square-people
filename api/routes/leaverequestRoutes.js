const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const requireTenant = require('../middleware/requireTenant');
const validate = require('../middleware/validate');
const { idParam, leaveCreateBody, leaveRejectBody } = require('../validators/resourceValidators');
const controller = require('../controllers/leaverequestController');
const approvalController = require('../controllers/leaveapprovalController');

router.use(requireAuth, requireTenant);

router.get('/mine', controller.mine);
router.get('/pending', requireRole('manager'), controller.pending);
router.post('/', validate({ body: leaveCreateBody }), controller.create);
router.patch('/:id', validate({ params: idParam, body: leaveCreateBody.partial() }), controller.update);
router.delete('/:id', validate({ params: idParam }), controller.cancel);

router.post('/:id/approve', requireRole('manager'), validate({ params: idParam }), approvalController.approve);
router.post('/:id/reject', requireRole('manager'), validate({ params: idParam, body: leaveRejectBody }), approvalController.reject);

module.exports = router;
