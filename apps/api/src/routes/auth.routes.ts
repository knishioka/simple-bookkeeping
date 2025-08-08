import { loginSchema } from '@simple-bookkeeping/shared';
import { Router } from 'express';
import { z } from 'zod';

import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth';
import { validate } from '../middlewares/validation';

import type { Router as RouterType } from 'express';

const router: RouterType = Router();

// Register
const registerSchema = z.object({
  body: z.object({
    email: z.string().email('有効なメールアドレスを入力してください'),
    password: z.string().min(8, 'パスワードは8文字以上で入力してください'),
    name: z.string().min(1, '名前を入力してください'),
    organizationName: z.string().min(1, '組織名を入力してください'),
  }),
});

router.post('/register', validate(registerSchema), authController.register);

// Login
router.post('/login', validate(z.object({ body: loginSchema })), authController.login);

// Refresh token
router.post(
  '/refresh',
  validate(
    z.object({
      body: z.object({
        refreshToken: z.string(),
      }),
    })
  ),
  authController.refreshToken
);

// Logout
router.post('/logout', authenticate, authController.logout);

// Get current user
router.get('/me', authenticate, authController.getMe);

export default router;
