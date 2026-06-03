const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const requireTenant = require('../middleware/requireTenant');
const statsController = require('../controllers/statsController');
const activityController = require('../controllers/activityController');
const worktrackingController = require('../controllers/worktrackingController');

router.use(requireAuth, requireTenant);
router.get('/stats', statsController.stats);
router.get('/activity', activityController.list);
router.get('/hours-this-week', worktrackingController.weeklyHours);

module.exports = router;
