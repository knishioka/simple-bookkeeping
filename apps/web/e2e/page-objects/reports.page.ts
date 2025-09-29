import { Page } from '@playwright/test';

import { BasePage } from './base.page';

/**
 * Reports Page Object
 * Handles all report pages (Balance Sheet, P&L, Trial Balance, etc.)
 */
export class ReportsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to specific report
   */
  async navigateToReport(
    reportType: 'balance-sheet' | 'profit-loss' | 'trial-balance' | 'cash-book' | 'bank-book'
  ): Promise<void> {
    const reportPaths = {
      'balance-sheet': '/dashboard/reports/balance-sheet',
      'profit-loss': '/dashboard/reports/profit-loss',
      'trial-balance': '/dashboard/reports/trial-balance',
      'cash-book': '/dashboard/ledgers/cash-book',
      'bank-book': '/dashboard/ledgers/bank-book',
    };

    await this.navigate(reportPaths[reportType]);
    await this.waitForPageReady();
  }

  /**
   * Check if report is loaded
   */
  async isReportLoaded(reportType: string): Promise<boolean> {
    const expectedTexts: Record<string, string[]> = {
      'balance-sheet': ['貸借対照表', 'Balance Sheet', '資産', '負債', '資本'],
      'profit-loss': ['損益計算書', 'Profit', '収益', '費用'],
      'trial-balance': ['試算表', 'Trial Balance', '借方', '貸方'],
      'cash-book': ['現金', '出納帳', 'Cash'],
      'bank-book': ['預金', '出納帳', 'Bank'],
    };

    const texts = expectedTexts[reportType] || [];
    for (const text of texts) {
      if (
        await this.page
          .locator(`text=${text}`)
          .isVisible({ timeout: 3000 })
          .catch(() => false)
      ) {
        return true;
      }
    }

    // Also check for common report elements
    const hasTable = await this.page
      .locator('table')
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    const hasMain = await this.page
      .locator('main')
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    return hasTable || hasMain;
  }

  /**
   * Get report title
   */
  async getReportTitle(): Promise<string> {
    const title = this.page.locator('h1, h2').first();
    return (await title.textContent()) || '';
  }

  /**
   * Check if report table exists
   */
  async hasReportTable(): Promise<boolean> {
    return this.page
      .locator('table')
      .isVisible({ timeout: 5000 })
      .catch(() => false);
  }

  /**
   * Get report data rows count
   */
  async getDataRowsCount(): Promise<number> {
    const rows = this.page.locator('table tbody tr');
    return rows.count();
  }

  /**
   * Select date range for report
   */
  async selectDateRange(startDate: string, endDate: string): Promise<void> {
    const startDateInput = this.page.locator('input[type="date"]').first();
    const endDateInput = this.page.locator('input[type="date"]').last();

    await this.fillWithRetry(startDateInput, startDate);
    await this.fillWithRetry(endDateInput, endDate);

    // Click generate/refresh button if exists
    const generateButton = this.page.locator(
      'button:has-text("生成"), button:has-text("Generate"), button:has-text("更新"), button:has-text("Refresh")'
    );
    if (await generateButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickWithRetry(generateButton);
      await this.waitForPageReady();
    }
  }

  /**
   * Export report
   */
  async exportReport(format: 'pdf' | 'csv' | 'excel'): Promise<void> {
    const exportButton = this.page.locator(
      `button:has-text("Export"), button:has-text("エクスポート")`
    );
    if (await exportButton.isVisible()) {
      await this.clickWithRetry(exportButton);

      // Select format from dropdown if available
      const formatOption = this.page.locator(`button:has-text("${format.toUpperCase()}")`);
      if (await formatOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await this.clickWithRetry(formatOption);
      }
    }
  }

  /**
   * Check for empty state message
   */
  async hasEmptyState(): Promise<boolean> {
    const emptyStateTexts = [
      'データがありません',
      'No data',
      'レコードが見つかりません',
      'No records found',
    ];

    for (const text of emptyStateTexts) {
      if (
        await this.page
          .locator(`text=${text}`)
          .isVisible({ timeout: 2000 })
          .catch(() => false)
      ) {
        return true;
      }
    }

    return false;
  }
}
