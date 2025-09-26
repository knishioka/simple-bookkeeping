/**
 * Storage State認証ヘルパー
 * Issue #338対応: Playwrightのセッション共有による認証処理の最適化
 *
 * Storage State機能を使用してテストの認証を高速化します。
 */

import path from 'path';

import { test as base } from '@playwright/test';

/**
 * Storage Stateファイルのパスを取得
 * CI環境でも正しく動作するよう絶対パスを使用
 */
const getAuthStatePath = (role: string = 'admin') => {
  // プロジェクトルートからの相対パスを絶対パスに変換
  return path.resolve(process.cwd(), `apps/web/e2e/.auth/${role}.json`);
};

/**
 * 認証済みのテストフィクスチャ
 * adminロールのStorage Stateを自動的に使用
 */
export const test = base.extend({
  // adminロールのStorage Stateを使用（絶対パス）
  storageState: getAuthStatePath('admin'),
});

export { expect } from '@playwright/test';

/**
 * ロール別のテスト作成
 */
export const createAuthenticatedTest = (role: 'admin' | 'accountant' | 'viewer' = 'admin') => {
  return base.extend({
    storageState: getAuthStatePath(role),
  });
};

/**
 * 認証なしのテスト（ログインページなど）
 */
export const testUnauthenticated = base;
