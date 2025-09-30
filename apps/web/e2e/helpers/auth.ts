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
  // Navigate to dashboard or any authenticated page first
  await page.goto('/dashboard');

  // Click the logout button if it exists, or clear cookies
  // Note: This assumes there's a logout button in the UI
  const logoutButton = page.locator('[data-testid="logout-button"], button:has-text("ログアウト")');

  if (await logoutButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await logoutButton.click();
  } else {
    // If no logout button is visible, clear auth cookies as fallback
    await page.context().clearCookies();
  }

  // Navigate to login page to ensure logout
  await page.goto('/auth/login');

  // Wait for the page to be ready
  await page.waitForLoadState('networkidle');
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
  // Check authentication by navigating to a protected page
  // and seeing if we get redirected to login
  const response = await page.goto('/dashboard', { waitUntil: 'networkidle' });

  // If we're redirected to login page, we're not authenticated
  const currentUrl = page.url();
  return !currentUrl.includes('/auth/login') && response?.ok() === true;
}

/**
 * Get current user info
 */
export async function getCurrentUser(page: Page): Promise<unknown> {
  // For E2E tests, we'll check for user info in the page context
  // This assumes the app renders user info somewhere in the DOM
  // or stores it in localStorage/sessionStorage

  // Try to get user info from localStorage or sessionStorage
  const userInfo = await page.evaluate(() => {
    // Check localStorage for Supabase session
    const supabaseKey = Object.keys(localStorage).find(
      (key) => key.startsWith('sb-') && key.includes('-auth-token')
    );

    if (supabaseKey) {
      try {
        const session = JSON.parse(localStorage.getItem(supabaseKey) || '{}');
        if (session.user) {
          return {
            id: session.user.id,
            email: session.user.email,
            role: session.user.user_metadata?.role,
          };
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Fallback: check for test auth cookie (for mock environments)
    const cookies = document.cookie.split(';');
    const authCookie = cookies.find((c) => c.trim().startsWith('test-auth-user='));

    if (authCookie) {
      try {
        const value = decodeURIComponent(authCookie.split('=')[1]);
        return JSON.parse(value);
      } catch {
        // Ignore parse errors
      }
    }

    return null;
  });

  return userInfo;
}
