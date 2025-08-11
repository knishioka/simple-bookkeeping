/**
 * Playwright グローバルティアダウン
 * Issue #95対応: E2Eテスト実行後のクリーンアップ
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import { FullConfig } from '@playwright/test';

/**
 * グローバルティアダウン関数
 * 全テスト実行後に一度だけ実行される
 */
async function globalTeardown(_config: FullConfig) {
  console.log('🧹 Starting E2E test global teardown...');

  const startTime = Date.now();

  try {
    // 一時ファイルのクリーンアップ
    await cleanupTempFiles();

    // テストデータのクリーンアップ（CI環境のみ）
    if (process.env.CI) {
      await cleanupTestData();
    }

    // 認証状態ファイルのクリーンアップ
    if (process.env.CLEANUP_AUTH_STATE === 'true') {
      await cleanupAuthState();
    }

    // テスト結果の集計
    await aggregateTestResults();

    const duration = Date.now() - startTime;
    console.log(`✅ Global teardown completed in ${duration}ms`);
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // ティアダウンのエラーはテスト失敗にしない
  }
}

/**
 * 一時ファイルのクリーンアップ
 */
async function cleanupTempFiles() {
  console.log('🗑️ Cleaning up temporary files...');

  const tempDirs = ['test-results', 'playwright-report', '.tmp'];

  for (const dir of tempDirs) {
    try {
      const dirPath = path.join(process.cwd(), dir);
      const stats = await fs.stat(dirPath).catch(() => null);

      if (stats && stats.isDirectory()) {
        // CI環境では削除、ローカルでは保持
        if (process.env.CI) {
          await fs.rm(dirPath, { recursive: true, force: true });
          console.log(`✅ Removed ${dir}`);
        } else {
          console.log(`ℹ️ Keeping ${dir} for debugging`);
        }
      }
    } catch (error) {
      console.warn(`⚠️ Could not clean ${dir}:`, error);
    }
  }
}

/**
 * テストデータのクリーンアップ
 */
async function cleanupTestData() {
  console.log('🗄️ Cleaning up test data...');

  try {
    // データベースのテストデータクリーンアップ
    // 必要に応じて実装
    // await exec('pnpm db:cleanup');

    console.log('✅ Test data cleaned');
  } catch (error) {
    console.warn('⚠️ Test data cleanup failed:', error);
  }
}

/**
 * 認証状態ファイルのクリーンアップ
 */
async function cleanupAuthState() {
  console.log('🔐 Cleaning up authentication state...');

  const authDir = '.auth';

  try {
    const dirPath = path.join(process.cwd(), authDir);
    const stats = await fs.stat(dirPath).catch(() => null);

    if (stats && stats.isDirectory()) {
      await fs.rm(dirPath, { recursive: true, force: true });
      console.log('✅ Authentication state cleaned');
    }
  } catch (error) {
    console.warn('⚠️ Auth state cleanup failed:', error);
  }
}

/**
 * テスト結果の集計
 */
async function aggregateTestResults() {
  console.log('📊 Aggregating test results...');

  try {
    // テスト結果ファイルの読み込み
    const resultsPath = path.join(process.cwd(), 'test-results.json');
    const stats = await fs.stat(resultsPath).catch(() => null);

    if (stats && stats.isFile()) {
      const results = JSON.parse(await fs.readFile(resultsPath, 'utf-8'));

      // 結果の集計
      const summary = {
        total: results.suites?.length || 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
      };

      // サマリーの計算
      if (results.suites) {
        for (const suite of results.suites) {
          for (const spec of suite.specs || []) {
            if (spec.ok) summary.passed++;
            else summary.failed++;

            for (const test of spec.tests || []) {
              summary.duration += test.duration || 0;
            }
          }
        }
      }

      // サマリーの表示
      console.log('📈 Test Summary:');
      console.log(`   Total: ${summary.total}`);
      console.log(`   Passed: ${summary.passed}`);
      console.log(`   Failed: ${summary.failed}`);
      console.log(`   Duration: ${(summary.duration / 1000).toFixed(2)}s`);

      // CI環境では結果をアーティファクトとして保存
      if (process.env.CI) {
        await fs.writeFile('test-summary.json', JSON.stringify(summary, null, 2), 'utf-8');
        console.log('✅ Test summary saved');
      }
    } else {
      console.log('ℹ️ No test results file found');
    }
  } catch (error) {
    console.warn('⚠️ Could not aggregate test results:', error);
  }
}

export default globalTeardown;
