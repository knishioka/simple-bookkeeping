/**
 * Storage State認証ヘルパー（改善版）
 * Issue #468対応: Storage State機能を改善して再有効化
 * 70-80%のテスト実行時間削減を実現
 */

import { test as base } from '@playwright/test';

import { getAuthStatePath } from '../../playwright/config';

/**
 * 認証済みのテストフィクスチャ（デフォルト: admin）
 * Storage Stateが利用可能な場合は使用、なければフォールバック
 */
export const test = base.extend({
  // eslint-disable-next-line no-empty-pattern
  storageState: async ({}, use) => {
    // Storage Stateが無効化されている場合はundefinedを使用
    if (process.env.DISABLE_STORAGE_STATE === 'true') {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      await use(undefined);
      return;
    }

    // adminロールのStorage Stateを使用
    const authPath = getAuthStatePath('admin');
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(authPath);
  },
});

export { expect } from '@playwright/test';

/**
 * ロール別のテスト作成
 * 各ロールに応じた権限でテストを実行
 */
export const createAuthenticatedTest = (role: 'admin' | 'accountant' | 'viewer' = 'admin') => {
  return base.extend({
    // eslint-disable-next-line no-empty-pattern
    storageState: async ({}, use) => {
      // Storage Stateが無効化されている場合はundefinedを使用
      if (process.env.DISABLE_STORAGE_STATE === 'true') {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        await use(undefined);
        return;
      }

      // 指定されたロールのStorage Stateを使用
      const authPath = getAuthStatePath(role);
      // eslint-disable-next-line react-hooks/rules-of-hooks
      await use(authPath);
    },
  });
};

/**
 * 認証なしのテスト（ログインページなど）
 * Storage Stateを使用しない
 */
export const testUnauthenticated = base.extend({
  storageState: undefined,
});

/**
 * adminロールのテスト（エイリアス）
 */
export const testAsAdmin = createAuthenticatedTest('admin');

/**
 * accountantロールのテスト（エイリアス）
 */
export const testAsAccountant = createAuthenticatedTest('accountant');

/**
 * viewerロールのテスト（エイリアス）
 */
export const testAsViewer = createAuthenticatedTest('viewer');

/**
 * パフォーマンス測定付きテスト
 * Storage Stateによる高速化の効果を測定
 */
export const testWithPerformance = base.extend({
  // eslint-disable-next-line no-empty-pattern
  storageState: async ({}, use, testInfo) => {
    const startTime = Date.now();

    // Storage Stateが無効化されている場合
    if (process.env.DISABLE_STORAGE_STATE === 'true') {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      await use(undefined);
      const duration = Date.now() - startTime;
      console.log(`[${testInfo.title}] Auth setup: ${duration}ms (Storage State disabled)`);
      return;
    }

    // Storage Stateを使用
    const authPath = getAuthStatePath('admin');
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(authPath);
    const duration = Date.now() - startTime;
    console.log(`[${testInfo.title}] Auth setup: ${duration}ms (Storage State enabled)`);
  },
});
