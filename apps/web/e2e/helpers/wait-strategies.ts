/**
 * E2Eテストのための待機戦略ヘルパー
 *
 * 優先順位：
 * 1. waitForApiResponse() - APIレスポンスを直接待つ
 * 2. waitForSelector() - 明示的な要素
 * 3. waitForFunction() - カスタム条件
 * 4. waitForURL() - URL変更
 * 5. waitForLoadState('domcontentloaded') - DOM準備
 * 6. waitForLoadState('load') - リソース読み込み
 * 7. waitForLoadState('networkidle') - 最終手段
 * 8. waitForTimeout() - 使用禁止
 */

import { Page, Response } from '@playwright/test';

/**
 * APIレスポンスを待機
 * @param page Playwrightのページオブジェクト
 * @param urlPattern APIのURLパターン（正規表現または文字列）
 * @param options オプション設定
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  options?: {
    timeout?: number;
    statusCode?: number;
    method?: string;
  }
): Promise<Response> {
  const { timeout = 3000, statusCode = 200, method } = options || {};

  return await page.waitForResponse(
    (response) => {
      const urlMatches =
        typeof urlPattern === 'string'
          ? response.url().includes(urlPattern)
          : urlPattern.test(response.url());

      const statusMatches = response.status() === statusCode;
      const methodMatches = method ? response.request().method() === method : true;

      return urlMatches && statusMatches && methodMatches;
    },
    { timeout }
  );
}

/**
 * 複数のAPIレスポンスを並行して待機
 * @param page Playwrightのページオブジェクト
 * @param patterns 待機するAPIパターンの配列
 * @param options オプション設定
 */
export async function waitForApiResponses(
  page: Page,
  patterns: Array<string | RegExp>,
  options?: {
    timeout?: number;
    statusCode?: number;
  }
): Promise<Response[]> {
  const promises = patterns.map((pattern) => waitForApiResponse(page, pattern, options));

  return await Promise.all(promises);
}

/**
 * data-testid属性を持つ要素を待機
 * @param page Playwrightのページオブジェクト
 * @param testId data-testidの値
 * @param options オプション設定
 */
export async function waitForTestId(
  page: Page,
  testId: string,
  options?: {
    state?: 'attached' | 'detached' | 'visible' | 'hidden';
    timeout?: number;
  }
) {
  const { state = 'visible', timeout = 5000 } = options || {};

  return await page.waitForSelector(`[data-testid="${testId}"]`, { state, timeout });
}

/**
 * データロード完了を待機（data-loaded属性）
 * @param page Playwrightのページオブジェクト
 * @param selector 要素のセレクター
 * @param options オプション設定
 */
export async function waitForDataLoaded(
  page: Page,
  selector?: string,
  options?: {
    timeout?: number;
  }
) {
  const { timeout = 5000 } = options || {};
  const targetSelector = selector || '[data-loaded="true"]';

  await page.waitForSelector(targetSelector, { timeout });

  // data-loaded属性が"true"になるまで待機
  if (selector) {
    await page.waitForFunction(
      (sel) => {
        const element = document.querySelector(sel);
        return element?.getAttribute('data-loaded') === 'true';
      },
      selector,
      { timeout }
    );
  }
}

/**
 * ページの準備完了を待機（複数の条件を組み合わせ）
 * @param page Playwrightのページオブジェクト
 * @param options オプション設定
 */
export async function waitForPageReady(
  page: Page,
  options?: {
    waitForApi?: string | RegExp;
    waitForTestId?: string;
    waitForSelector?: string;
    skipNetworkIdle?: boolean;
    timeout?: number;
  }
) {
  const {
    waitForApi,
    waitForTestId: testId,
    waitForSelector: selector,
    skipNetworkIdle = false,
    timeout = 5000,
  } = options || {};

  // DOM読み込み完了を待機
  await page.waitForLoadState('domcontentloaded');

  // 指定された条件を並行して待機
  const promises: Promise<unknown>[] = [];

  if (waitForApi) {
    promises.push(waitForApiResponse(page, waitForApi, { timeout }));
  }

  if (testId) {
    promises.push(waitForTestId(page, testId, { timeout }));
  }

  if (selector) {
    promises.push(page.waitForSelector(selector, { timeout }));
  }

  // デフォルトでnetworkidleも待機（明示的にスキップしない限り）
  if (!skipNetworkIdle && promises.length === 0) {
    promises.push(page.waitForLoadState('networkidle'));
  }

  if (promises.length > 0) {
    await Promise.all(promises);
  }
}

/**
 * リトライ付き待機
 * @param fn 実行する関数
 * @param options オプション設定
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: {
    retries?: number;
    delay?: number;
    timeout?: number;
  }
): Promise<T> {
  const { retries = 3, delay = 1000, timeout = 5000 } = options || {};

  const startTime = Date.now();
  let lastError: Error | undefined;

  for (let i = 0; i < retries; i++) {
    try {
      // タイムアウトチェック
      if (Date.now() - startTime > timeout) {
        throw new Error(`Timeout after ${timeout}ms`);
      }

      return await fn();
    } catch (error) {
      lastError = error as Error;

      // 最後のリトライでなければ待機
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('All retries failed');
}

/**
 * 条件付き待機（特定の条件が満たされるまで待機）
 * @param page Playwrightのページオブジェクト
 * @param condition 待機条件を評価する関数
 * @param options オプション設定
 */
export async function waitForCondition(
  page: Page,
  condition: () => boolean | Promise<boolean>,
  options?: {
    timeout?: number;
    polling?: number;
  }
) {
  const { timeout = 5000, polling = 100 } = options || {};

  return await page.waitForFunction(condition, { timeout, polling });
}

/**
 * ナビゲーション完了を待機
 * @param page Playwrightのページオブジェクト
 * @param url 遷移先URL（部分一致）
 * @param options オプション設定
 */
export async function waitForNavigation(
  page: Page,
  url?: string | RegExp,
  options?: {
    timeout?: number;
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  }
) {
  const { timeout = 5000, waitUntil = 'domcontentloaded' } = options || {};

  if (url) {
    await page.waitForURL(url, { timeout, waitUntil });
  } else {
    await page.waitForLoadState(waitUntil, { timeout });
  }
}

/**
 * 要素のテキスト変更を待機
 * @param page Playwrightのページオブジェクト
 * @param selector 要素のセレクター
 * @param expectedText 期待するテキスト（正規表現可）
 * @param options オプション設定
 */
export async function waitForTextChange(
  page: Page,
  selector: string,
  expectedText: string | RegExp,
  options?: {
    timeout?: number;
  }
) {
  const { timeout = 5000 } = options || {};

  await page.waitForFunction(
    ({ sel, text }) => {
      const element = document.querySelector(sel);
      if (!element) return false;

      const actualText = element.textContent || '';

      if (typeof text === 'string') {
        return actualText.includes(text);
      } else {
        // 正規表現の場合は文字列として評価
        return new RegExp(text.source, text.flags).test(actualText);
      }
    },
    { sel: selector, text: expectedText },
    { timeout }
  );
}

/**
 * Radix UI のSelectコンポーネントが開くのを待機
 * @param page Playwrightのページオブジェクト
 * @param triggerSelector トリガー要素のセレクター
 * @param options オプション設定
 */
export async function waitForSelectOpen(
  page: Page,
  triggerSelector?: string,
  options?: {
    timeout?: number;
  }
) {
  const { timeout = 5000 } = options || {};

  // Radix UIのSelectコンテンツが表示されるまで待機
  await page.waitForSelector('[role="listbox"], [data-radix-select-content]', {
    state: 'visible',
    timeout,
  });

  // アニメーション完了を待つ
  await page.waitForTimeout(100);
}

/**
 * フォーム送信完了を待機
 * @param page Playwrightのページオブジェクト
 * @param formSelector フォームのセレクター
 * @param options オプション設定
 */
export async function waitForFormSubmit(
  page: Page,
  formSelector: string,
  options?: {
    successUrl?: string | RegExp;
    successApi?: string | RegExp;
    timeout?: number;
  }
) {
  const { successUrl, successApi, timeout = 5000 } = options || {};

  const promises: Promise<unknown>[] = [];

  if (successUrl) {
    promises.push(page.waitForURL(successUrl, { timeout }));
  }

  if (successApi) {
    promises.push(waitForApiResponse(page, successApi, { timeout }));
  }

  if (promises.length === 0) {
    // デフォルトはネットワークアイドルを待つ
    promises.push(page.waitForLoadState('networkidle', { timeout }));
  }

  await Promise.race(promises);
}

/**
 * モーダル/ダイアログの表示を待機
 * @param page Playwrightのページオブジェクト
 * @param options オプション設定
 */
export async function waitForModal(
  page: Page,
  options?: {
    role?: string;
    testId?: string;
    timeout?: number;
  }
) {
  const { role = 'dialog', testId, timeout = 5000 } = options || {};

  if (testId) {
    await waitForTestId(page, testId, { timeout });
  } else {
    await page.waitForSelector(`[role="${role}"]`, { state: 'visible', timeout });
  }

  // アニメーション完了を待つ
  await page.waitForTimeout(200);
}

/**
 * トーストメッセージの表示を待機
 * @param page Playwrightのページオブジェクト
 * @param message 期待するメッセージ（部分一致）
 * @param options オプション設定
 */
export async function waitForToast(
  page: Page,
  message?: string,
  options?: {
    timeout?: number;
  }
) {
  const { timeout = 5000 } = options || {};

  // トースト要素の表示を待機
  const toastSelector = '[data-sonner-toast], [role="status"], .toast';
  await page.waitForSelector(toastSelector, { state: 'visible', timeout });

  // メッセージの確認
  if (message) {
    await waitForTextChange(page, toastSelector, message, { timeout });
  }
}

/**
 * デバッグ用：現在のページ状態をログ出力
 * @param page Playwrightのページオブジェクト
 * @param label ログのラベル
 */
export async function debugPageState(page: Page, label: string) {
  const url = page.url();
  const title = await page.title();
  const readyState = await page.evaluate(() => document.readyState);
  const hasLoader = (await page.locator('.loader, [data-loading="true"]').count()) > 0;

  console.log(`\n=== ${label} ===`);
  console.log(`URL: ${url}`);
  console.log(`Title: ${title}`);
  console.log(`Ready State: ${readyState}`);
  console.log(`Has Loader: ${hasLoader}`);
  console.log(`================\n`);
}

/**
 * スマート待機：要素の種類に応じて最適な待機戦略を選択
 * @param page Playwrightのページオブジェクト
 * @param target 待機対象（セレクター、URL、APIパターンなど）
 * @param type 対象の種類
 * @param options オプション設定
 */
export async function smartWait(
  page: Page,
  target: string | RegExp,
  type: 'element' | 'api' | 'navigation' | 'text' | 'auto' = 'auto',
  options?: {
    timeout?: number;
  }
) {
  const { timeout = 5000 } = options || {};

  if (type === 'auto') {
    // 自動判定
    if (typeof target === 'string') {
      if (target.startsWith('http') || target.startsWith('/')) {
        type = target.includes('/api/') ? 'api' : 'navigation';
      } else if (target.startsWith('[') || target.startsWith('#') || target.startsWith('.')) {
        type = 'element';
      } else {
        type = 'text';
      }
    } else {
      // 正規表現の場合はAPIまたはナビゲーション
      type = 'api';
    }
  }

  switch (type) {
    case 'element':
      await page.waitForSelector(target as string, { timeout });
      break;
    case 'api':
      await waitForApiResponse(page, target, { timeout });
      break;
    case 'navigation':
      await page.waitForURL(target, { timeout });
      break;
    case 'text':
      await page.waitForSelector(`text=${target}`, { timeout });
      break;
  }
}
