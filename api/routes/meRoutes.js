const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const requireTenant = require('../middleware/requireTenant');
const meController = require('../controllers/meController');

router.use(requireAuth, requireTenant);

router.get('/', meController.getMe);
router.patch('/', meController.patchMe);
router.post('/change-password', meController.changePassword);
router.post('/set-pin', meController.setPin);

module.exports = router;
