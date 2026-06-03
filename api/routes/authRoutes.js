const express = require('express');
const router = express.Router();
const validate = require('../middleware/validate');
const requireAuth = require('../middleware/requireAuth');
const {
  signupSchema,
  loginSchema,
  employeeLoginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('../validators/authValidators');
const authController = require('../controllers/authController');

router.post('/signup', validate({ body: signupSchema }), authController.signup);
router.post('/login', validate({ body: loginSchema }), authController.login);
router.post('/employee-login', validate({ body: employeeLoginSchema }), authController.employeeLogin);
router.post('/refresh', authController.refresh);
router.post('/logout', requireAuth, authController.logout);
router.post('/logout-all', requireAuth, authController.logoutAll);
router.post('/forgot-password', validate({ body: forgotPasswordSchema }), authController.forgotPassword);
router.post('/reset-password', validate({ body: resetPasswordSchema }), authController.resetPassword);

module.exports = router;
