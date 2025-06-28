import { z } from 'zod';

// import { REGEX_PATTERNS } from '../../constants';

// Define UserRole enum locally to avoid circular dependency
export enum UserRole {
  ADMIN = 'ADMIN',
  ACCOUNTANT = 'ACCOUNTANT',
  VIEWER = 'VIEWER',
}

// Password requirements
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REQUIREMENTS = {
  minLength: PASSWORD_MIN_LENGTH,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
};

// Email schema
export const emailSchema = z.string().email('Invalid email format').toLowerCase().trim();

// Password schema with strong requirements
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .refine(
    (password) => !PASSWORD_REQUIREMENTS.requireUppercase || /[A-Z]/.test(password),
    'Password must contain at least one uppercase letter'
  )
  .refine(
    (password) => !PASSWORD_REQUIREMENTS.requireLowercase || /[a-z]/.test(password),
    'Password must contain at least one lowercase letter'
  )
  .refine(
    (password) => !PASSWORD_REQUIREMENTS.requireNumber || /\d/.test(password),
    'Password must contain at least one number'
  )
  .refine(
    (password) => !PASSWORD_REQUIREMENTS.requireSpecial || /[@$!%*?&]/.test(password),
    'Password must contain at least one special character (@$!%*?&)'
  );

// Login schema
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  organizationId: z.string().uuid().optional(),
  rememberMe: z.boolean().optional().default(false),
});

// Registration schema
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').trim(),
  organizationName: z
    .string()
    .min(1, 'Organization name is required')
    .max(100, 'Organization name too long')
    .trim(),
  phoneNumber: z
    .string()
    .regex(/^[0-9-+().\s]+$/, 'Invalid phone number format')
    .optional(),
});

// Change password schema
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Password confirmation is required'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from current password',
    path: ['newPassword'],
  });

// Reset password schema
export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Password confirmation is required'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// Request password reset schema
export const requestPasswordResetSchema = z.object({
  email: emailSchema,
});

// User profile update schema
export const updateUserProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').trim().optional(),
  phoneNumber: z
    .string()
    .regex(/^[0-9-+().\s]+$/, 'Invalid phone number format')
    .optional(),
  language: z.enum(['ja', 'en']).optional(),
  timezone: z.string().optional(),
});

// Organization user invite schema
export const inviteUserSchema = z.object({
  email: emailSchema,
  name: z.string().min(1).max(100).trim(),
  role: z.nativeEnum(UserRole, {
    errorMap: () => ({ message: 'Invalid user role' }),
  }),
  sendInviteEmail: z.boolean().optional().default(true),
});

// Token validation schema
export const tokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  type: z.enum(['access', 'refresh', 'reset', 'verify']).optional(),
});

// Session schema
export const sessionSchema = z.object({
  userId: z.string().uuid(),
  organizationId: z.string().uuid(),
  role: z.nativeEnum(UserRole),
  expiresAt: z.date(),
  deviceInfo: z
    .object({
      userAgent: z.string().optional(),
      ip: z.string().optional(),
      device: z.string().optional(),
    })
    .optional(),
});

// Export types
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;
export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type TokenInput = z.infer<typeof tokenSchema>;
export type SessionData = z.infer<typeof sessionSchema>;
