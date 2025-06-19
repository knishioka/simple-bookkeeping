import { loginSchema } from '@simple-bookkeeping/shared';
import { Router } from 'express';
import { z } from 'zod';

import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth';
import { validate } from '../middlewares/validation';

import type { Router as RouterType } from 'express';

const router: RouterType = Router();

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

export default router;
