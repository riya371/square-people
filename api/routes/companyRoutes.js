const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const requireTenant = require('../middleware/requireTenant');
const companyController = require('../controllers/companyController');

// Public endpoint (no auth) — used by signup wizard
router.get('/me/workspace-check', companyController.workspaceCheck);

// Authenticated tenant-scoped endpoints
router.get('/me', requireAuth, requireTenant, companyController.getMe);
router.patch('/me', requireAuth, requireTenant, requireRole('admin'), companyController.updateMe);

module.exports = router;
