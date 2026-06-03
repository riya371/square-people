const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const requireTenant = require('../middleware/requireTenant');
const validate = require('../middleware/validate');
const { idParam, inviteCreateBody, inviteAcceptBody } = require('../validators/resourceValidators');
const controller = require('../controllers/inviteController');

// PUBLIC routes first
router.get('/accept', controller.acceptGet);
router.post('/accept', validate({ body: inviteAcceptBody }), controller.acceptPost);

// AUTHED admin routes after
router.use(requireAuth, requireTenant, requireRole('admin'));
router.get('/', controller.list);
router.post('/', validate({ body: inviteCreateBody }), controller.create);
router.delete('/:id', validate({ params: idParam }), controller.remove);
router.post('/:id/resend', validate({ params: idParam }), controller.resend);

module.exports = router;
