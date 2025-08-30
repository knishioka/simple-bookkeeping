/**
 * E2E Test Authentication Helper for Supabase Auth
 * This helper provides authentication utilities for E2E tests using Supabase
 */

import { Page } from '@playwright/test';

export interface TestUser {
  email: string;
  password: string;
  role?: 'admin' | 'accountant' | 'viewer';
  organizationId?: string;
}

/**
 * Default test users for E2E testing
 */
export const TEST_USERS = {
  admin: {
    email: 'admin@test.example.com',
    password: 'testpass123!',
    role: 'admin' as const,
  },
  accountant: {
    email: 'accountant@test.example.com',
    password: 'testpass123!',
    role: 'accountant' as const,
  },
  viewer: {
    email: 'viewer@test.example.com',
    password: 'testpass123!',
    role: 'viewer' as const,
  },
};

/**
 * Login a test user via the UI
 */
export async function loginTestUser(page: Page, user: TestUser = TEST_USERS.admin): Promise<void> {
  await page.goto('/auth/login');
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', user.password);
  await page.click('button[type="submit"]');

  // Wait for navigation to complete
  await page.waitForURL((url) => !url.pathname.includes('/auth/login'), {
    waitUntil: 'networkidle',
  });
}

/**
 * Logout the current user
 */
export async function logoutUser(page: Page): Promise<void> {
  // Call logout API endpoint
  await page.evaluate(async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  });

  // Navigate to login page
  await page.goto('/auth/login');
}

/**
 * Setup mock authentication for test environment
 * This is used when Supabase is not configured (dummy URLs)
 */
export async function setupMockAuth(page: Page, user: TestUser = TEST_USERS.admin): Promise<void> {
  // Set mock auth cookies for test environment
  await page.context().addCookies([
    {
      name: 'test-auth-user',
      value: JSON.stringify({
        id: `test-user-${user.role}`,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId || 'test-org-id',
      }),
      domain: 'localhost',
      path: '/',
    },
  ]);
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  const response = await page.request.get('/api/auth/me');
  return response.ok();
}

/**
 * Get current user info
 */
export async function getCurrentUser(page: Page): Promise<unknown> {
  const response = await page.request.get('/api/auth/me');
  if (response.ok()) {
    return await response.json();
  }
  return null;
}
