/**
 * E2Eテストのデバッグユーティリティ
 *
 * テストの失敗時やデバッグ時に役立つユーティリティ関数群
 */

import * as fs from 'fs';
import * as path from 'path';

import { Page, Locator } from '@playwright/test';

/**
 * テスト失敗時のスクリーンショット保存
 * @param page Playwrightのページオブジェクト
 * @param testName テスト名
 * @param options オプション設定
 */
export async function captureDebugScreenshot(
  page: Page,
  testName: string,
  options?: {
    fullPage?: boolean;
    path?: string;
  }
) {
  const { fullPage = true, path: customPath } = options || {};

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${testName.replace(/[^a-z0-9]/gi, '-')}-${timestamp}.png`;
  const screenshotPath = customPath || `./test-results/screenshots/${fileName}`;

  // ディレクトリが存在しない場合は作成
  const dir = path.dirname(screenshotPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  await page.screenshot({
    path: screenshotPath,
    fullPage,
  });

  console.log(`📸 Screenshot saved: ${screenshotPath}`);
  return screenshotPath;
}

/**
 * ページのHTMLダンプを保存
 * @param page Playwrightのページオブジェクト
 * @param testName テスト名
 * @param options オプション設定
 */
export async function capturePageHTML(
  page: Page,
  testName: string,
  options?: {
    path?: string;
  }
) {
  const { path: customPath } = options || {};

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${testName.replace(/[^a-z0-9]/gi, '-')}-${timestamp}.html`;
  const htmlPath = customPath || `./test-results/html/${fileName}`;

  // ディレクトリが存在しない場合は作成
  const dir = path.dirname(htmlPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const html = await page.content();
  fs.writeFileSync(htmlPath, html);

  console.log(`📄 HTML saved: ${htmlPath}`);
  return htmlPath;
}

/**
 * ネットワークログを記録
 * @param page Playwrightのページオブジェクト
 */
export function startNetworkLogging(page: Page) {
  const networkLogs: Array<{
    timestamp: Date;
    method: string;
    url: string;
    status?: number;
    duration?: number;
  }> = [];

  page.on('request', (request) => {
    networkLogs.push({
      timestamp: new Date(),
      method: request.method(),
      url: request.url(),
    });
  });

  page.on('response', (response) => {
    const request = response.request();
    const log = networkLogs.find((l) => l.url === request.url() && !l.status);
    if (log) {
      log.status = response.status();
      log.duration = new Date().getTime() - log.timestamp.getTime();
    }
  });

  return {
    getLogs: () => networkLogs,
    clear: () => (networkLogs.length = 0),
    print: () => {
      console.log('\n=== Network Logs ===');
      networkLogs.forEach((log) => {
        const status = log.status ? `[${log.status}]` : '[pending]';
        const duration = log.duration ? `(${log.duration}ms)` : '';
        console.log(`${status} ${log.method} ${log.url} ${duration}`);
      });
      console.log('==================\n');
    },
  };
}

/**
 * コンソールログを記録
 * @param page Playwrightのページオブジェクト
 */
export function startConsoleLogging(page: Page) {
  const consoleLogs: Array<{
    timestamp: Date;
    type: string;
    message: string;
  }> = [];

  page.on('console', (msg) => {
    consoleLogs.push({
      timestamp: new Date(),
      type: msg.type(),
      message: msg.text(),
    });

    // エラーは即座に出力
    if (msg.type() === 'error') {
      console.error(`🔴 Console Error: ${msg.text()}`);
    }
  });

  return {
    getLogs: () => consoleLogs,
    clear: () => (consoleLogs.length = 0),
    print: () => {
      console.log('\n=== Console Logs ===');
      consoleLogs.forEach((log) => {
        const emoji = log.type === 'error' ? '🔴' : log.type === 'warning' ? '🟡' : '⚪';
        console.log(`${emoji} [${log.type}] ${log.message}`);
      });
      console.log('==================\n');
    },
    getErrors: () => consoleLogs.filter((l) => l.type === 'error'),
    getWarnings: () => consoleLogs.filter((l) => l.type === 'warning'),
  };
}

/**
 * 要素の詳細情報をログ出力
 * @param locator Playwrightのロケーター
 * @param label ログのラベル
 */
export async function debugElement(locator: Locator, label: string) {
  try {
    const count = await locator.count();
    console.log(`\n=== Debug: ${label} ===`);
    console.log(`Found ${count} element(s)`);

    if (count > 0) {
      const element = locator.first();
      const isVisible = await element.isVisible();
      const isEnabled = await element.isEnabled();
      const isEditable = await element.isEditable().catch(() => false);
      const text = await element.textContent().catch(() => 'N/A');
      const value = await element.inputValue().catch(() => 'N/A');
      const tagName = await element.evaluate((el) => el.tagName);
      const className = await element.evaluate((el) => el.className);
      const id = await element.evaluate((el) => el.id);

      console.log(`Tag: ${tagName}`);
      console.log(`ID: ${id || 'none'}`);
      console.log(`Class: ${className || 'none'}`);
      console.log(`Visible: ${isVisible}`);
      console.log(`Enabled: ${isEnabled}`);
      console.log(`Editable: ${isEditable}`);
      console.log(`Text: ${text}`);
      console.log(`Value: ${value}`);
    }
    console.log('==================\n');
  } catch (error) {
    console.error(`Failed to debug element: ${error}`);
  }
}

/**
 * テストのタイミング情報を記録
 * @param label タイミングのラベル
 */
export class TestTimer {
  private timings: Map<string, { start: number; end?: number }> = new Map();

  start(label: string) {
    this.timings.set(label, { start: Date.now() });
  }

  end(label: string) {
    const timing = this.timings.get(label);
    if (timing && !timing.end) {
      timing.end = Date.now();
    }
  }

  getDuration(label: string): number | undefined {
    const timing = this.timings.get(label);
    if (timing && timing.end) {
      return timing.end - timing.start;
    }
    return undefined;
  }

  print() {
    console.log('\n=== Test Timings ===');
    this.timings.forEach((timing, label) => {
      const duration = timing.end ? timing.end - timing.start : 'ongoing';
      console.log(`${label}: ${duration}ms`);
    });
    console.log('==================\n');
  }

  reset() {
    this.timings.clear();
  }
}

/**
 * 待機戦略のデバッグ
 * @param page Playwrightのページオブジェクト
 * @param strategy 使用した待機戦略
 * @param success 成功したかどうか
 * @param duration 待機にかかった時間
 */
export function logWaitStrategy(
  strategy: string,
  success: boolean,
  duration: number,
  details?: string
) {
  const emoji = success ? '✅' : '❌';
  const status = success ? 'SUCCESS' : 'FAILED';
  console.log(`${emoji} Wait Strategy: ${strategy} - ${status} (${duration}ms)`);
  if (details) {
    console.log(`   Details: ${details}`);
  }
}

/**
 * CI環境かどうかを判定
 */
export function isCI(): boolean {
  return (
    process.env.CI === 'true' ||
    process.env.GITHUB_ACTIONS === 'true' ||
    process.env.VERCEL === '1' ||
    process.env.RENDER === 'true'
  );
}

/**
 * デバッグモードかどうかを判定
 */
export function isDebugMode(): boolean {
  return process.env.DEBUG === 'true' || process.env.PWDEBUG === '1';
}

/**
 * テスト環境情報をログ出力
 */
export function logTestEnvironment() {
  console.log('\n=== Test Environment ===');
  console.log(`Node Version: ${process.version}`);
  console.log(`Platform: ${process.platform}`);
  console.log(`CI: ${isCI()}`);
  console.log(`Debug Mode: ${isDebugMode()}`);
  console.log(`Base URL: ${process.env.BASE_URL || 'http://localhost:3000'}`);
  console.log(`Headless: ${process.env.HEADLESS !== 'false'}`);
  console.log('======================\n');
}

/**
 * エラー発生時の詳細情報を収集
 * @param page Playwrightのページオブジェクト
 * @param error エラーオブジェクト
 * @param testName テスト名
 */
export async function collectErrorDetails(page: Page, error: Error, testName: string) {
  console.error('\n🔴 Test Failed:', testName);
  console.error('Error:', error.message);

  // スクリーンショットを保存
  await captureDebugScreenshot(page, `error-${testName}`);

  // HTMLを保存
  await capturePageHTML(page, `error-${testName}`);

  // ページ情報を出力
  console.log('\n=== Page Info ===');
  console.log(`URL: ${page.url()}`);
  console.log(`Title: ${await page.title()}`);
  console.log('================\n');

  return {
    error: error.message,
    url: page.url(),
    title: await page.title(),
    timestamp: new Date().toISOString(),
  };
}

/**
 * waitForTimeout の使用を警告
 * @param duration タイムアウト時間
 * @param reason 使用理由
 */
export function warnWaitForTimeout(duration: number, reason?: string) {
  console.warn(`⚠️ Warning: Using waitForTimeout(${duration}ms)`);
  if (reason) {
    console.warn(`   Reason: ${reason}`);
  }
  console.warn('   Consider using explicit wait strategies instead');
}
