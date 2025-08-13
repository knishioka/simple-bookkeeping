import { TEST_CREDENTIALS, TEST_API_CONFIG } from '../test-config';

/**
 * Interface for Playwright Page-like object
 */
interface PageLike {
  goto(url: string): Promise<void>;
  fill(selector: string, value: string): Promise<void>;
  click(selector: string): Promise<void>;
  waitForURL(url: string | RegExp): Promise<void>;
  locator(selector: string): any;
}

/**
 * Login as admin user in E2E tests
 * @param page - Playwright page object
 * @param baseUrl - Optional base URL override
 */
export async function loginAsAdmin(page: PageLike, baseUrl?: string): Promise<void> {
  const url = baseUrl || TEST_API_CONFIG.baseUrl;
  const { email, password } = TEST_CREDENTIALS.admin;

  await page.goto(`${url}/login`);
  await page.fill('[data-testid="email-input"]', email);
  await page.fill('[data-testid="password-input"]', password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL(/\/dashboard/);
}

/**
 * Login as accountant user in E2E tests
 * @param page - Playwright page object
 * @param baseUrl - Optional base URL override
 */
export async function loginAsAccountant(page: PageLike, baseUrl?: string): Promise<void> {
  const url = baseUrl || TEST_API_CONFIG.baseUrl;
  const { email, password } = TEST_CREDENTIALS.accountant;

  await page.goto(`${url}/login`);
  await page.fill('[data-testid="email-input"]', email);
  await page.fill('[data-testid="password-input"]', password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL(/\/dashboard/);
}

/**
 * Login as viewer user in E2E tests
 * @param page - Playwright page object
 * @param baseUrl - Optional base URL override
 */
export async function loginAsViewer(page: PageLike, baseUrl?: string): Promise<void> {
  const url = baseUrl || TEST_API_CONFIG.baseUrl;
  const { email, password } = TEST_CREDENTIALS.viewer;

  await page.goto(`${url}/login`);
  await page.fill('[data-testid="email-input"]', email);
  await page.fill('[data-testid="password-input"]', password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL(/\/dashboard/);
}

/**
 * Login with custom credentials in E2E tests
 * @param page - Playwright page object
 * @param email - User email
 * @param password - User password
 * @param baseUrl - Optional base URL override
 */
export async function loginWithCredentials(
  page: PageLike,
  email: string,
  password: string,
  baseUrl?: string
): Promise<void> {
  const url = baseUrl || TEST_API_CONFIG.baseUrl;

  await page.goto(`${url}/login`);
  await page.fill('[data-testid="email-input"]', email);
  await page.fill('[data-testid="password-input"]', password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL(/\/dashboard/);
}

/**
 * Logout user in E2E tests
 * @param page - Playwright page object
 */
export async function logout(page: PageLike): Promise<void> {
  await page.click('[data-testid="user-menu"]');
  await page.click('[data-testid="logout-button"]');
  await page.waitForURL(/\/login/);
}

/**
 * Get test user credentials by role for E2E tests
 * @param role - User role
 * @returns Email and password for the role
 */
export function getE2ECredentials(role: 'admin' | 'accountant' | 'viewer') {
  switch (role) {
    case 'admin':
      return {
        email: TEST_CREDENTIALS.admin.email,
        password: TEST_CREDENTIALS.admin.password,
      };
    case 'accountant':
      return {
        email: TEST_CREDENTIALS.accountant.email,
        password: TEST_CREDENTIALS.accountant.password,
      };
    case 'viewer':
      return {
        email: TEST_CREDENTIALS.viewer.email,
        password: TEST_CREDENTIALS.viewer.password,
      };
    default:
      return {
        email: TEST_CREDENTIALS.testUser.email,
        password: TEST_CREDENTIALS.testUser.password,
      };
  }
}

/**
 * Setup test user session in E2E tests
 * @param page - Playwright page object
 * @param role - User role
 * @param organizationId - Optional organization ID
 */
export async function setupTestSession(
  page: PageLike,
  role: 'admin' | 'accountant' | 'viewer' = 'viewer',
  organizationId?: string
): Promise<void> {
  // This would typically set up cookies or local storage
  // to simulate an authenticated session

  // Example: Set auth cookie (adjust based on your auth implementation)
  await (page as any).context().addCookies([
    {
      name: 'auth-token',
      value: `test-token-${role}`,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);

  if (organizationId) {
    await (page as any).context().addCookies([
      {
        name: 'organization-id',
        value: organizationId,
        domain: 'localhost',
        path: '/',
      },
    ]);
  }
}

/**
 * Wait for API call to complete in E2E tests
 * @param page - Playwright page object
 * @param urlPattern - URL pattern to match
 * @param method - HTTP method to match
 */
export async function waitForAPI(
  page: any,
  urlPattern: string | RegExp,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET'
): Promise<void> {
  await page.waitForResponse(
    (response: any) =>
      response.url().match(urlPattern) &&
      response.request().method() === method &&
      response.status() === 200
  );
}
