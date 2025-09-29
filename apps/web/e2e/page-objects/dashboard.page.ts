import { Page } from '@playwright/test';

import { BasePage } from './base.page';

/**
 * Dashboard Page Object
 * Handles dashboard navigation and interactions
 */
export class DashboardPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to dashboard
   */
  async goto(): Promise<void> {
    await this.navigate('/dashboard');
  }

  /**
   * Navigate to specific section
   */
  async navigateToSection(section: 'accounts' | 'journal' | 'reports' | 'settings'): Promise<void> {
    const sectionMap = {
      accounts: '/dashboard/accounts',
      journal: '/dashboard/journal-entries',
      reports: '/dashboard/reports',
      settings: '/dashboard/settings',
    };

    await this.navigate(sectionMap[section]);
  }

  /**
   * Get sidebar navigation
   */
  private getSidebarNav() {
    return this.page.locator('nav[aria-label="サイドバー"], nav[aria-label="Sidebar"]');
  }

  /**
   * Click on sidebar menu item
   */
  async clickSidebarItem(itemText: string): Promise<void> {
    const sidebar = this.getSidebarNav();
    const menuItem = sidebar.locator(`a:has-text("${itemText}"), button:has-text("${itemText}")`);
    await this.clickWithRetry(menuItem);
    await this.waitForPageReady();
  }

  /**
   * Check if specific page content is visible
   */
  async isPageContentVisible(expectedText: string | string[]): Promise<boolean> {
    const texts = Array.isArray(expectedText) ? expectedText : [expectedText];

    for (const text of texts) {
      const element = this.page.locator(`text=${text}`);
      const isVisible = await element.isVisible({ timeout: 5000 }).catch(() => false);
      if (isVisible) return true;
    }

    return false;
  }

  /**
   * Get page title
   */
  async getPageTitle(): Promise<string> {
    const title = this.page.locator('h1, h2').first();
    return title.textContent() || '';
  }

  /**
   * Check if main navigation is visible
   */
  async isNavigationVisible(): Promise<boolean> {
    const nav = this.page.locator('nav');
    return nav.isVisible({ timeout: 5000 });
  }

  /**
   * Check if main content area is visible
   */
  async isMainContentVisible(): Promise<boolean> {
    const main = this.page.locator('main');
    return main.isVisible({ timeout: 5000 });
  }

  /**
   * Wait for dashboard to be fully loaded
   */
  async waitForDashboardReady(): Promise<void> {
    await this.waitForPageReady();
    await this.page.waitForSelector('nav', { timeout: 10000 });
    await this.page.waitForSelector('main', { timeout: 10000 });
  }
}
