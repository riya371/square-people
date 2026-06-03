const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const requireTenant = require('../middleware/requireTenant');
const validate = require('../middleware/validate');
const { attendanceMonthQuery, attendanceSummaryQuery } = require('../validators/resourceValidators');
const controller = require('../controllers/attendanceController');

router.use(requireAuth, requireTenant);

router.get('/today', controller.today);
router.get('/month', validate({ query: attendanceMonthQuery }), controller.month);
router.post('/sign-in', controller.signIn);
router.post('/sign-out', controller.signOut);
router.get('/summary', requireRole('manager'), validate({ query: attendanceSummaryQuery }), controller.summary);

module.exports = router;
