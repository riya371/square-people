const { z } = require('zod');

const SLUG_REGEX = /^[a-z0-9-]+$/;

const signupSchema = z.object({
  fullName: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  companyName: z.string().min(1).max(120),
  workspaceSlug: z.string().min(2).max(64).regex(SLUG_REGEX, 'Slug must be lowercase letters, digits, or hyphens.'),
  companySize: z.string().max(40).optional(),
  industry: z.string().max(60).optional(),
  workdays: z.array(z.string().min(1)).max(7).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  workspaceSlug: z.string().regex(SLUG_REGEX).optional(),
});

const employeeLoginSchema = z.object({
  companySlug: z.string().regex(SLUG_REGEX),
  employeeCode: z.string().min(1).max(40),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits.'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(8),
});

module.exports = {
  signupSchema,
  loginSchema,
  employeeLoginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
