import { Page, BrowserContext } from '@playwright/test';

import { SupabaseAuth } from '../helpers/supabase-auth';

import { BasePage } from './base.page';

/**
 * Login Page Object
 * Handles authentication and login operations
 */
export class LoginPage extends BasePage {
  private context: BrowserContext;

  constructor(page: Page, context: BrowserContext) {
    super(page);
    this.context = context;
  }

  /**
   * Navigate to login page
   */
  async goto(): Promise<void> {
    await this.navigate('/login');
  }

  /**
   * Setup authentication with specified role
   */
  async setupAuth(role: 'admin' | 'accountant' | 'viewer' = 'admin'): Promise<void> {
    // Navigate to home first to set up context
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
    await SupabaseAuth.setup(this.context, this.page, { role });
  }

  /**
   * Login with email and password (for actual login flow)
   */
  async loginWithCredentials(email: string, password: string): Promise<void> {
    const emailInput = this.page.locator('input[type="email"]');
    const passwordInput = this.page.locator('input[type="password"]');
    const submitButton = this.getByRole('button', { name: /ログイン|Login/i });

    await this.fillWithRetry(emailInput, email);
    await this.fillWithRetry(passwordInput, password);
    await this.clickWithRetry(submitButton);

    // Wait for navigation after login
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Check if user is logged in
   */
  async isLoggedIn(): Promise<boolean> {
    // Check for presence of logout button or user menu
    const logoutButton = this.page.locator(
      'button:has-text("ログアウト"), button:has-text("Logout")'
    );
    return logoutButton.isVisible({ timeout: 5000 }).catch(() => false);
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    const logoutButton = this.page.locator(
      'button:has-text("ログアウト"), button:has-text("Logout")'
    );
    if (await logoutButton.isVisible()) {
      await this.clickWithRetry(logoutButton);
      await this.page.waitForLoadState('networkidle');
    }
  }
}
