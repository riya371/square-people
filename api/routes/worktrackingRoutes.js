const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const requireTenant = require('../middleware/requireTenant');
const validate = require('../middleware/validate');
const { idParam, timerStartBody, timeEntriesQuery, weeklyHoursQuery } = require('../validators/resourceValidators');
const controller = require('../controllers/worktrackingController');

router.use(requireAuth, requireTenant);

router.get('/entries', validate({ query: timeEntriesQuery }), controller.entries);
router.get('/today-total', controller.todayTotal);
router.get('/weekly-hours', validate({ query: weeklyHoursQuery }), controller.weeklyHours);

router.post('/start', validate({ body: timerStartBody }), controller.start);
router.post('/:id/pause', validate({ params: idParam }), controller.pause);
router.post('/:id/resume', validate({ params: idParam }), controller.resume);
router.post('/:id/stop', validate({ params: idParam }), controller.stop);

module.exports = router;
