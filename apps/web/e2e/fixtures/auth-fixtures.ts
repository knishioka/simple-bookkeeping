/**
 * Authentication Fixtures for E2E Tests
 * Issue #520: Stabilize E2E authentication and enable Playwright sharding compatibility
 *
 * This file provides Playwright fixtures that handle authentication setup once per worker,
 * eliminating race conditions and supporting full sharding capabilities.
 *
 * Pattern:
 * - Authentication happens once per worker (not per test)
 * - Storage state is persisted and reused across tests in same worker
 * - Single-step authentication flow without multiple navigations
 * - Role-based authentication support
 */

/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable security/detect-non-literal-fs-filename */

import fs from 'fs/promises';
import path from 'path';

import { test as base, Page, BrowserContext } from '@playwright/test';

import { UnifiedMock } from '../helpers/server-actions-unified-mock';
import { UserRole, SupabaseUser, SupabaseSession, SupabaseAuth } from '../helpers/supabase-auth';

/**
 * Authentication state interface for fixtures
 */
interface AuthState {
  session: SupabaseSession;
  user: SupabaseUser;
  role: UserRole;
}

/**
 * Test fixtures that extend the base Playwright test
 */
export interface AuthFixtures {
  /**
   * Authenticated page fixture - automatically sets up authentication
   */
  authenticatedPage: Page;

  /**
   * Authenticated context fixture - provides authenticated browser context
   */
  authenticatedContext: BrowserContext;

  /**
   * Current authentication state
   */
  authState: AuthState | null;
}

/**
 * Worker fixtures for authentication state persistence
 */
interface WorkerFixtures {
  /**
   * User role for the current worker (defaults to 'admin')
   */
  userRole: UserRole;

  /**
   * Worker-scoped storage state that persists authentication across tests
   */
  workerStorageState: string | undefined;

  /**
   * Worker authentication setup - runs once per worker
   */
  workerAuth: AuthState | null;
}

/**
 * Get storage state file path for a specific worker and role
 */
function getStorageStatePath(workerIndex: number, role: UserRole): string {
  const storageDir = path.join(process.cwd(), '.playwright', 'storage-states');
  return path.join(storageDir, `auth-${role}-worker-${workerIndex}.json`);
}

/**
 * Ensure storage directory exists
 */
async function ensureStorageDir(): Promise<void> {
  const storageDir = path.join(process.cwd(), '.playwright', 'storage-states');
  await fs.mkdir(storageDir, { recursive: true });
}

/**
 * Extended test with authentication fixtures
 */
export const test = base.extend<AuthFixtures, WorkerFixtures>({
  /**
   * User role fixture - defaults to 'admin' but can be overridden per test suite
   * Note: This is a worker fixture, so it applies to all tests in a worker
   */
  userRole: ['admin', { option: true, scope: 'worker' }],

  /**
   * Worker-scoped authentication setup
   * This runs once per worker and sets up authentication
   */
  workerAuth: [
    async ({ browser: _browser }, use, testInfo) => {
      // Skip auth setup if using mock auth or in CI
      const useMockAuth = process.env.E2E_USE_MOCK_AUTH === 'true' || process.env.CI === 'true';

      if (useMockAuth) {
        // Use simplified mock auth state
        const mockAuthState: AuthState = {
          session: {
            access_token: `mock-token-worker-${testInfo.parallelIndex}`,
            refresh_token: `mock-refresh-token-${testInfo.parallelIndex}`,
            expires_at: Date.now() / 1000 + 3600,
            user: {
              id: `mock-admin-${testInfo.parallelIndex}`,
              email: 'admin.e2e@test.example.com',
              user_metadata: {
                name: 'E2E Test Admin',
                organization_id: 'test-org-e2e-001',
                role: 'admin',
                permissions: ['*'],
              },
            },
          },
          user: {
            id: `mock-admin-${testInfo.parallelIndex}`,
            email: 'admin.e2e@test.example.com',
            user_metadata: {
              name: 'E2E Test Admin',
              organization_id: 'test-org-e2e-001',
              role: 'admin',
              permissions: ['*'],
            },
          },
          role: 'admin',
        };

        await use(mockAuthState);
        return;
      }

      // Real authentication setup (for future use when Supabase is available)
      await use(null);
    },
    { scope: 'worker', timeout: 60000 },
  ],

  /**
   * Worker storage state - persists authentication across tests
   */
  workerStorageState: [
    async ({ workerAuth, userRole }, use, testInfo) => {
      if (!workerAuth) {
        await use(undefined);
        return;
      }

      // Ensure storage directory exists
      await ensureStorageDir();

      // Get storage state file path
      const storagePath = getStorageStatePath(testInfo.parallelIndex, userRole);

      // Create storage state with authentication data
      const storageState = {
        cookies: [
          {
            name: 'mockAuth',
            value: 'true',
            domain: 'localhost',
            path: '/',
            expires: -1,
            httpOnly: false,
            secure: false,
            sameSite: 'Lax' as const,
          },
        ],
        origins: [
          {
            origin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
            localStorage: [
              {
                name: 'sb-placeholder-auth-token',
                value: JSON.stringify({
                  currentSession: {
                    access_token: workerAuth.session.access_token,
                    refresh_token: workerAuth.session.refresh_token,
                    expires_at: workerAuth.session.expires_at,
                    expires_in: 3600,
                    token_type: 'bearer',
                    user: workerAuth.session.user,
                  },
                  expiresAt: workerAuth.session.expires_at,
                }),
              },
              {
                name: 'supabase.auth.token',
                value: JSON.stringify({
                  currentSession: {
                    access_token: workerAuth.session.access_token,
                    refresh_token: workerAuth.session.refresh_token,
                    expires_at: workerAuth.session.expires_at,
                    expires_in: 3600,
                    token_type: 'bearer',
                    user: workerAuth.session.user,
                  },
                  expiresAt: workerAuth.session.expires_at,
                }),
              },
              {
                name: 'mockAuth',
                value: 'true',
              },
              {
                name: 'selectedOrganizationId',
                value: workerAuth.user.user_metadata.organization_id,
              },
            ],
          },
        ],
      };

      // Write storage state to file
      await fs.writeFile(storagePath, JSON.stringify(storageState, null, 2));

      // Use the storage state file path
      await use(storagePath);

      // Cleanup storage state file after tests
      try {
        await fs.unlink(storagePath);
      } catch {
        // Ignore cleanup errors
      }
    },
    { scope: 'worker' },
  ],

  /**
   * Override the default storageState fixture to use our worker storage state
   */
  storageState: async ({ workerStorageState }, use) => {
    await use(workerStorageState);
  },

  /**
   * Authenticated context fixture
   * Provides a browser context with authentication already set up
   */
  authenticatedContext: async ({ context, workerAuth }, use) => {
    // Context already has storage state from worker setup

    // CRITICAL: Explicitly add mockAuth cookie to bypass middleware redirect
    // This ensures the cookie is present regardless of storage state loading
    if (workerAuth) {
      await context.addCookies([
        {
          name: 'mockAuth',
          value: 'true',
          domain: 'localhost',
          path: '/',
          httpOnly: false,
          secure: false,
          sameSite: 'Lax',
        },
      ]);
    }

    // Mocks should be set up in beforeEach hooks by tests themselves
    await use(context);
  },

  /**
   * Authenticated page fixture
   * Provides a page with authentication already set up
   * Follows the exact pattern from accounting-periods-simple.spec.ts (which works):
   * 1. UnifiedMock.setupAll() - creates/gets page and injects mocks
   * 2. page.goto('/') - navigate to trigger auth setup
   * 3. SupabaseAuth.setup() - configure authentication
   *
   * CRITICAL: Creates page from authenticatedContext to ensure storage state is applied
   */
  authenticatedPage: async ({ authenticatedContext }, use) => {
    // Step 1: Setup mocks using authenticated context
    await UnifiedMock.setupAll(authenticatedContext, { enabled: true });

    // Step 2: Get or create page from authenticated context
    // This ensures the page has the authentication cookies from worker storage state
    let page = authenticatedContext.pages()[0];
    if (!page) {
      page = await authenticatedContext.newPage();
    }

    // Step 3: Navigate to home page
    await page.goto('/');

    // Step 4: Setup authentication (matching accounting-periods-simple.spec.ts pattern)
    await SupabaseAuth.setup(authenticatedContext, page, { role: 'admin' });

    // Step 5: Provide the authenticated page to the test
    await use(page);

    // Step 6: Close the page
    await page.close();
  },

  /**
   * Current authentication state
   */
  authState: async ({ workerAuth }, use) => {
    await use(workerAuth);
  },
});

/**
 * Export additional test variants for specific roles
 */
export const adminTest = test.extend<Record<string, never>, { userRole: UserRole }>({
  userRole: ['admin', { option: true, scope: 'worker' }],
});

export const accountantTest = test.extend<Record<string, never>, { userRole: UserRole }>({
  userRole: ['accountant', { option: true, scope: 'worker' }],
});

export const viewerTest = test.extend<Record<string, never>, { userRole: UserRole }>({
  userRole: ['viewer', { option: true, scope: 'worker' }],
});

/**
 * Helper function to create authenticated test with specific role
 */
export function createRoleTest(role: UserRole) {
  return test.extend<Record<string, never>, { userRole: UserRole }>({
    userRole: [role, { option: true, scope: 'worker' }],
  });
}

/**
 * Re-export expect for convenience
 */
export { expect } from '@playwright/test';
