/**
 * E2Eテストパフォーマンス最適化ユーティリティ
 * Issue #202: E2Eテストのパフォーマンス最適化
 */

import { Page, BrowserContext } from '@playwright/test';

/**
 * テストグループごとの共通設定
 */
export const TEST_GROUPS = {
  auth: {
    tests: ['login', 'logout', 'register'],
    parallel: true,
    maxRetries: 1,
  },
  demo: {
    tests: ['accounts', 'journal-entries', 'reports'],
    parallel: true,
    maxRetries: 0,
  },
  dashboard: {
    tests: ['accounts', 'journal-entries', 'reports', 'settings'],
    parallel: false, // 認証状態を共有するため順次実行
    maxRetries: 2,
  },
} as const;

/**
 * パフォーマンス最適化されたページ待機
 * waitForTimeoutの代替として使用
 */
export async function waitForPageStable(
  page: Page,
  options?: {
    timeout?: number;
    checkInterval?: number;
  }
) {
  const { timeout = 3000 } = options || {};
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    // ネットワークアクティビティのチェック
    const hasActiveRequests = await page.evaluate(() => {
      return (
        performance.getEntriesByType('resource').filter((entry) => {
          const resource = entry as PerformanceResourceTiming;
          return resource.responseEnd === 0;
        }).length > 0
      );
    });

    if (!hasActiveRequests) {
      // DOM変更の監視
      const domStable = await page.evaluate(() => {
        return new Promise<boolean>((resolve) => {
          let changeCount = 0;
          const observer = new MutationObserver(() => {
            changeCount++;
          });

          observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
          });

          setTimeout(() => {
            observer.disconnect();
            resolve(changeCount === 0);
          }, 50);
        });
      });

      if (domStable) {
        return;
      }
    }

    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 100)));
  }
}

/**
 * 共通モックのキャッシュ設定
 * 同じテストグループ内でモックを再利用
 */
const mockCache = new Map<string, unknown>();

export async function getCachedMock(key: string, factory: () => unknown) {
  if (!mockCache.has(key)) {
    mockCache.set(key, await factory());
  }
  return mockCache.get(key);
}

/**
 * バッチAPIリクエストの設定
 * 複数のAPIエンドポイントを一度にモック
 */
export async function setupBatchMocks(
  context: BrowserContext,
  endpoints: Array<{ url: string | RegExp; response: unknown }>
) {
  const promises = endpoints.map(({ url, response }) =>
    context.route(url, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    })
  );

  await Promise.all(promises);
}

/**
 * スマート待機戦略
 * 条件に応じて最適な待機方法を選択
 */
export async function smartWait(
  page: Page,
  options: {
    selector?: string;
    text?: string;
    url?: string | RegExp;
    apiEndpoint?: string | RegExp;
    stable?: boolean;
  }
) {
  const promises: Promise<unknown>[] = [];

  if (options.selector) {
    promises.push(page.waitForSelector(options.selector, { state: 'visible' }));
  }

  if (options.text) {
    promises.push(page.waitForSelector(`text=${options.text}`, { state: 'visible' }));
  }

  if (options.url) {
    promises.push(page.waitForURL(options.url));
  }

  if (options.apiEndpoint) {
    promises.push(page.waitForResponse(options.apiEndpoint));
  }

  if (options.stable) {
    promises.push(waitForPageStable(page));
  }

  // 最初に完了した条件で続行
  if (promises.length > 0) {
    await Promise.race(promises);
  }
}

/**
 * パフォーマンスメトリクスの収集
 */
export async function collectPerformanceMetrics(page: Page) {
  return await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');

    return {
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
      firstPaint: paint.find((p) => p.name === 'first-paint')?.startTime || 0,
      firstContentfulPaint: paint.find((p) => p.name === 'first-contentful-paint')?.startTime || 0,
      totalResources: performance.getEntriesByType('resource').length,
    };
  });
}

/**
 * テスト実行時間の記録と分析
 */
class TestTimeTracker {
  private static times = new Map<string, number[]>();

  static startTimer(testName: string): () => void {
    const startTime = Date.now();
    return () => {
      const duration = Date.now() - startTime;
      if (!this.times.has(testName)) {
        this.times.set(testName, []);
      }
      const times = this.times.get(testName);
      if (times) {
        times.push(duration);
      }
    };
  }

  static getAverageTime(testName: string): number {
    const times = this.times.get(testName);
    if (!times || times.length === 0) return 0;
    return times.reduce((a, b) => a + b, 0) / times.length;
  }

  static getReport(): Record<string, { average: number; runs: number }> {
    const report: Record<string, { average: number; runs: number }> = {};
    this.times.forEach((times, testName) => {
      report[testName] = {
        average: Math.round(this.getAverageTime(testName)),
        runs: times.length,
      };
    });
    return report;
  }
}

export { TestTimeTracker };
