/**
 * Storage State認証ヘルパー（一時的に無効化）
 * Issue #466対応: Storage State機能を一時的に無効化
 *
 * Storage State機能が競合状態を引き起こすため、
 * 一時的に無効化し、各テストで独立してログインする方式を使用
 */

import { test as base } from '@playwright/test';

/**
 * 認証済みのテストフィクスチャ
 * Note: Storage Stateは一時的に無効化されています
 */
export const test = base.extend({
  // Storage State機能を無効化
  storageState: undefined,
});

export { expect } from '@playwright/test';

/**
 * ロール別のテスト作成
 * Note: Storage State機能が無効のため、ロールに関係なく同じ動作
 */
export const createAuthenticatedTest = (_role: 'admin' | 'accountant' | 'viewer' = 'admin') => {
  return base.extend({
    // Storage State機能を無効化
    storageState: undefined,
  });
};

/**
 * 認証なしのテスト（ログインページなど）
 */
export const testUnauthenticated = base;
