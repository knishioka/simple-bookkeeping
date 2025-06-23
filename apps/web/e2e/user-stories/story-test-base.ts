/**
 * ユーザーストーリーテストのベースクラス（改良版）
 *
 * Page Object Modelとヘルパークラスを統合した安定したストーリーテスト基盤
 */

import { test as base, expect, Page } from '@playwright/test';

import { MockResponseManager } from '../fixtures/mock-responses';
import { AccountsPage } from '../pages/accounts-page';
import { JournalEntryPage } from '../pages/journal-entry-page';
import { RadixSelectHelper } from '../utils/select-helpers';

import { UserStory, Scenario } from './user-stories';

export type StoryTestFixtures = {
  story: UserStory;
  scenario: Scenario;
  recordStep: (step: string, status: 'passed' | 'failed' | 'skipped') => void;
  mockManager: MockResponseManager;
  accountsPage: AccountsPage;
  journalPage: JournalEntryPage;
};

export const storyTest = base.extend<StoryTestFixtures>({
  story: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      // テスト実行時に動的に設定
      await use(undefined as unknown as UserStory);
    },
    { scope: 'test' },
  ],

  scenario: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      // テスト実行時に動的に設定
      await use(undefined as unknown as Scenario);
    },
    { scope: 'test' },
  ],

  mockManager: [
    async ({ page }, use) => {
      const mockManager = new MockResponseManager(page);
      await mockManager.setupBasicMocks();
      await use(mockManager);
    },
    { scope: 'test' },
  ],

  accountsPage: [
    async ({ page }, use) => {
      const accountsPage = new AccountsPage(page);
      await use(accountsPage);
    },
    { scope: 'test' },
  ],

  journalPage: [
    async ({ page }, use) => {
      const journalPage = new JournalEntryPage(page);
      await use(journalPage);
    },
    { scope: 'test' },
  ],

  recordStep: [
    async ({ page }, use) => {
      const steps: Array<{ step: string; status: string; timestamp: Date; duration?: number }> = [];

      await use((step: string, status: 'passed' | 'failed' | 'skipped') => {
        steps.push({
          step,
          status,
          timestamp: new Date(),
        });

        // コンソールに出力（CI/CDで確認可能）
        console.log(`[STORY STEP] ${status.toUpperCase()}: ${step}`);
      });

      // テスト終了時にレポートを生成
      if (steps.length > 0) {
        const report = {
          url: page.url(),
          timestamp: new Date(),
          steps,
          totalSteps: steps.length,
          passedSteps: steps.filter((s) => s.status === 'passed').length,
          failedSteps: steps.filter((s) => s.status === 'failed').length,
        };

        // アノテーションとして記録
        base.info().annotations.push({
          type: 'story-test-report',
          description: JSON.stringify(report, null, 2),
        });
      }
    },
    { auto: true },
  ],
});

/**
 * ストーリーテストのヘルパー関数（改良版）
 */
export class StoryTestHelper {
  /**
   * ステップを実行し、結果を記録（タイムアウト対応）
   */
  static async executeStep(
    page: Page,
    step: string,
    action: () => Promise<void>,
    recordStep: (step: string, status: 'passed' | 'failed' | 'skipped') => void,
    timeout: number = 30000
  ) {
    const startTime = Date.now();
    try {
      // タイムアウト付きで実行
      await Promise.race([
        action(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Step timeout after ${timeout}ms`)), timeout)
        ),
      ]);

      const duration = Date.now() - startTime;
      recordStep(step, 'passed');
      console.log(`[STEP COMPLETED] ${step} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      recordStep(step, 'failed');
      console.error(`[STEP FAILED] ${step} (${duration}ms):`, error);
      throw error;
    }
  }

  /**
   * 受け入れ条件を検証（再試行機能付き）
   */
  static async verifyAcceptanceCriteria(
    page: Page,
    criteria: string,
    verification: () => Promise<void>,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ) {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await verification();
        console.log(`[AC PASSED] ${criteria} (attempt ${attempt}/${maxRetries})`);
        return;
      } catch (error) {
        lastError = error as Error;
        console.warn(`[AC ATTEMPT ${attempt}/${maxRetries} FAILED] ${criteria}:`, error);

        if (attempt < maxRetries) {
          await page.waitForTimeout(retryDelay);
        }
      }
    }

    console.error(`[AC FAILED] ${criteria} after ${maxRetries} attempts`);
    throw lastError;
  }

  /**
   * ページロード完了を待機（安定版）
   */
  static async waitForPageReady(page: Page): Promise<void> {
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => document.readyState === 'complete');

    // スピナーやローディングインジケータの完了を待機
    await page
      .waitForFunction(
        () => {
          const spinners = document.querySelectorAll('[data-testid="loading"], .loading, .spinner');
          return spinners.length === 0;
        },
        { timeout: 10000 }
      )
      .catch(() => {
        console.warn('Loading indicators may still be present');
      });
  }

  /**
   * 安全なSelect操作（ストーリーテスト用）
   */
  static async selectOptionSafely(
    page: Page,
    selectLocator: string,
    optionText: string,
    description?: string
  ): Promise<void> {
    try {
      await RadixSelectHelper.selectOption(page, selectLocator, optionText);
      if (description) {
        console.log(`[SELECT SUCCESS] ${description}: ${optionText}`);
      }
    } catch (error) {
      console.error(`[SELECT FAILED] ${description || selectLocator}: ${optionText}`, error);
      throw error;
    }
  }

  /**
   * フォーム入力の安全な実行（ストーリーテスト用）
   */
  static async fillFormSafely(
    page: Page,
    selector: string,
    value: string,
    description?: string
  ): Promise<void> {
    try {
      const field = page.locator(selector);
      await field.waitFor();
      await field.clear();
      await field.fill(value);

      if (description) {
        console.log(`[FORM FILL SUCCESS] ${description}: ${value}`);
      }
    } catch (error) {
      console.error(`[FORM FILL FAILED] ${description || selector}: ${value}`, error);
      throw error;
    }
  }

  /**
   * ダイアログ操作の安全な実行
   */
  static async handleDialogSafely(
    page: Page,
    action: () => Promise<void>,
    description?: string
  ): Promise<void> {
    try {
      await action();

      // ダイアログが適切に開いているか確認
      await page.locator('[role="dialog"]').waitFor({ timeout: 5000 });

      if (description) {
        console.log(`[DIALOG SUCCESS] ${description}`);
      }
    } catch (error) {
      console.error(`[DIALOG FAILED] ${description}`, error);
      throw error;
    }
  }

  /**
   * パフォーマンス測定付きのアクション実行
   */
  static async measurePerformance<T>(
    action: () => Promise<T>,
    description: string,
    expectedMaxDuration?: number
  ): Promise<{ result: T; duration: number }> {
    const startTime = Date.now();
    const result = await action();
    const duration = Date.now() - startTime;

    console.log(`[PERFORMANCE] ${description}: ${duration}ms`);

    if (expectedMaxDuration && duration > expectedMaxDuration) {
      console.warn(
        `[PERFORMANCE WARNING] ${description} took ${duration}ms (expected < ${expectedMaxDuration}ms)`
      );
    }

    return { result, duration };
  }
}

/**
 * ストーリーテスト用のカスタムExpect（改良版）
 */
export const storyExpect = {
  /**
   * パフォーマンス条件の検証（詳細ログ付き）
   */
  async toCompleteWithin(action: () => Promise<void>, milliseconds: number, description?: string) {
    const start = Date.now();
    await action();
    const duration = Date.now() - start;

    const label = description || 'Action';
    console.log(`[PERFORMANCE] ${label} completed in ${duration}ms (limit: ${milliseconds}ms)`);

    expect(
      duration,
      `${label} should complete within ${milliseconds}ms but took ${duration}ms`
    ).toBeLessThan(milliseconds);
    return { duration };
  },

  /**
   * ユーザビリティ条件の検証（改良版）
   */
  async toBeUserFriendly(
    page: Page,
    checks: {
      hasProperLabels?: boolean;
      hasHelpText?: boolean;
      hasErrorMessages?: boolean;
      isKeyboardNavigable?: boolean;
      hasProperFocus?: boolean;
      isResponsive?: boolean;
    }
  ) {
    const results: Record<string, boolean> = {};

    if (checks.hasProperLabels) {
      const inputs = await page.locator('input, select, textarea').all();
      let allHaveLabels = true;

      for (const input of inputs) {
        const hasLabel = await input.evaluate((el: HTMLElement) => {
          const id = el.id;
          if (id) {
            const label = document.querySelector(`label[for="${id}"]`);
            return !!label;
          }
          return !!el.getAttribute('aria-label') || !!el.getAttribute('aria-labelledby');
        });

        if (!hasLabel) {
          allHaveLabels = false;
          break;
        }
      }
      results.hasProperLabels = allHaveLabels;
    }

    if (checks.hasHelpText) {
      results.hasHelpText =
        (await page.locator('[aria-describedby], [title], .help-text, [data-tooltip]').count()) > 0;
    }

    if (checks.hasErrorMessages) {
      // エラー状態をトリガー
      const form = page.locator('form').first();
      if ((await form.count()) > 0) {
        const submitBtn = form.locator(
          'button[type="submit"], button:has-text("作成"), button:has-text("送信")'
        );
        if ((await submitBtn.count()) > 0) {
          await submitBtn.click();
          await page.waitForTimeout(500); // エラー表示待機
          results.hasErrorMessages =
            (await page.locator('.error, [role="alert"], .field-error').count()) > 0;
        }
      }
    }

    if (checks.isKeyboardNavigable) {
      // Tabキーでナビゲーション可能か
      const initialElement = await page.evaluate(() => document.activeElement?.tagName);
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
      const newElement = await page.evaluate(() => document.activeElement?.tagName);
      results.isKeyboardNavigable = newElement !== 'BODY' && newElement !== initialElement;
    }

    if (checks.hasProperFocus) {
      // フォーカスリングが適切に表示されるか
      await page.keyboard.press('Tab');
      const focusVisible = await page.evaluate(() => {
        const activeElement = document.activeElement;
        if (!activeElement) return false;

        const styles = window.getComputedStyle(activeElement);
        return styles.outline !== 'none' || styles.boxShadow !== 'none';
      });
      results.hasProperFocus = focusVisible;
    }

    if (checks.isResponsive) {
      // レスポンシブ対応の確認（モバイルサイズ）
      const originalSize = page.viewportSize();
      await page.setViewportSize({ width: 390, height: 844 }); // iPhone 12
      await page.waitForTimeout(500);

      // 水平スクロールが発生していないか確認
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      results.isResponsive = !hasHorizontalScroll;

      // 元のサイズに戻す
      if (originalSize) {
        await page.setViewportSize(originalSize);
      }
    }

    // すべてのチェックが成功したか確認
    for (const [check, result] of Object.entries(results)) {
      expect(result, `Usability check failed: ${check}`).toBe(true);
    }

    console.log('[USABILITY] All checks passed:', Object.keys(results).join(', '));
  },

  /**
   * アクセシビリティの基本チェック
   */
  async toBeAccessible(page: Page) {
    // 基本的なアクセシビリティチェック
    const checks = {
      hasH1: (await page.locator('h1').count()) === 1,
      hasMainLandmark: (await page.locator('main').count()) > 0,
      hasProperHeadingOrder: await this.checkHeadingOrder(page),
      hasAltTextForImages: await this.checkImageAltText(page),
    };

    for (const [check, result] of Object.entries(checks)) {
      expect(result, `Accessibility check failed: ${check}`).toBe(true);
    }
  },

  async checkHeadingOrder(page: Page): Promise<boolean> {
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    let previousLevel = 0;

    for (const heading of headings) {
      const tagName = await heading.evaluate((el) => el.tagName);
      const level = parseInt(tagName[1]);

      if (level > previousLevel + 1) {
        return false; // 見出しレベルが飛んでいる
      }
      previousLevel = level;
    }

    return true;
  },

  async checkImageAltText(page: Page): Promise<boolean> {
    const images = await page.locator('img').all();

    for (const img of images) {
      const hasAlt = await img.evaluate((el) => el.hasAttribute('alt'));
      if (!hasAlt) {
        return false;
      }
    }

    return true;
  },
};
