/**
 * Stub auth routes for backward compatibility
 * Authentication is now handled by Supabase in Next.js
 * This file is kept to avoid breaking Express API build
 * The Express API will be completely removed in the next phase
 */

import { Router } from 'express';

const router = Router();

// Stub routes - return 501 Not Implemented
router.post('/login', (_req, res) => {
  res.status(501).json({
    error: 'Authentication is now handled by Supabase. Use /api/auth/login in Next.js app',
  });
});

router.post('/logout', (_req, res) => {
  res.status(501).json({
    error: 'Authentication is now handled by Supabase. Use /api/auth/logout in Next.js app',
  });
});

router.post('/signup', (_req, res) => {
  res.status(501).json({
    error: 'Authentication is now handled by Supabase. Use /api/auth/signup in Next.js app',
  });
});

router.get('/me', (_req, res) => {
  res.status(501).json({
    error: 'Authentication is now handled by Supabase. Use /api/auth/me in Next.js app',
  });
});

export default router;
