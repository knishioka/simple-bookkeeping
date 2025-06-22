/**
 * ユーザーストーリーテストのベースクラス
 *
 * 各ストーリーテストはこのベースを継承して実装
 */

import { test as base, expect } from '@playwright/test';

import { UserStory, Scenario } from './user-stories';

export type StoryTestFixtures = {
  story: UserStory;
  scenario: Scenario;
  recordStep: (step: string, status: 'passed' | 'failed' | 'skipped') => void;
};

export const storyTest = base.extend<StoryTestFixtures>({
  story: [
    async ({ page: _page }, use) => {
      // テスト実行時に動的に設定
      await use(undefined as unknown as UserStory);
    },
    { scope: 'test' },
  ],

  scenario: [
    async ({ page: _page }, use) => {
      // テスト実行時に動的に設定
      await use(undefined as unknown as Scenario);
    },
    { scope: 'test' },
  ],

  recordStep: [
    async ({ page }, use) => {
      const steps: Array<{ step: string; status: string; timestamp: Date }> = [];

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
 * ストーリーテストのヘルパー関数
 */
export class StoryTestHelper {
  /**
   * ステップを実行し、結果を記録
   */
  static async executeStep(
    _page: Page,
    step: string,
    action: () => Promise<void>,
    recordStep: (step: string, status: 'passed' | 'failed' | 'skipped') => void
  ) {
    try {
      await action();
      recordStep(step, 'passed');
    } catch (error) {
      recordStep(step, 'failed');
      throw error;
    }
  }

  /**
   * 受け入れ条件を検証
   */
  static async verifyAcceptanceCriteria(
    _page: Page,
    criteria: string,
    verification: () => Promise<void>
  ) {
    try {
      await verification();
      console.log(`[AC PASSED] ${criteria}`);
    } catch (error) {
      console.error(`[AC FAILED] ${criteria}`);
      throw error;
    }
  }
}

/**
 * ストーリーテスト用のカスタムExpect
 */
export const storyExpect = {
  /**
   * パフォーマンス条件の検証
   */
  async toCompleteWithin(action: () => Promise<void>, milliseconds: number) {
    const start = Date.now();
    await action();
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(milliseconds);
    return { duration };
  },

  /**
   * ユーザビリティ条件の検証
   */
  async toBeUserFriendly(
    page: Page,
    checks: {
      hasProperLabels?: boolean;
      hasHelpText?: boolean;
      hasErrorMessages?: boolean;
      isKeyboardNavigable?: boolean;
    }
  ) {
    const results: Record<string, boolean> = {};

    if (checks.hasProperLabels) {
      const inputs = await page.locator('input, select, textarea').all();
      for (const input of inputs) {
        const label = await input.evaluate((el: HTMLElement) => {
          const id = el.id;
          if (id) {
            const label = document.querySelector(`label[for="${id}"]`);
            return !!label;
          }
          return !!el.getAttribute('aria-label');
        });
        results.hasProperLabels = label;
        if (!label) break;
      }
    }

    if (checks.hasHelpText) {
      results.hasHelpText =
        (await page.locator('[aria-describedby], [title], .help-text').count()) > 0;
    }

    if (checks.hasErrorMessages) {
      // エラー状態をトリガー（空のフォーム送信など）
      const form = page.locator('form').first();
      if ((await form.count()) > 0) {
        await form.locator('button[type="submit"]').click();
        results.hasErrorMessages = (await page.locator('.error, [role="alert"]').count()) > 0;
      }
    }

    if (checks.isKeyboardNavigable) {
      // Tab キーでナビゲーション可能か
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      results.isKeyboardNavigable = focusedElement !== 'BODY';
    }

    // すべてのチェックが成功したか確認
    for (const [check, result] of Object.entries(results)) {
      expect(result, `Failed: ${check}`).toBe(true);
    }
  },
};
