/**
 * Storage State認証ヘルパー
 * Issue #338対応: Playwrightのセッション共有による認証処理の最適化
 *
 * Storage State機能を使用してテストの認証を高速化します。
 */

import { test as base } from '@playwright/test';

/**
 * 認証済みのテストフィクスチャ
 * adminロールのStorage Stateを自動的に使用
 */
export const test = base.extend({
  // adminロールのStorage Stateを使用
  storageState: 'e2e/.auth/admin.json',
});

export { expect } from '@playwright/test';

/**
 * ロール別のテスト作成
 */
export const createAuthenticatedTest = (role: 'admin' | 'accountant' | 'viewer' = 'admin') => {
  return base.extend({
    storageState: `e2e/.auth/${role}.json`,
  });
};

/**
 * 認証なしのテスト（ログインページなど）
 */
export const testUnauthenticated = base;
