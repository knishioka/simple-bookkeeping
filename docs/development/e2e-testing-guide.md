# E2Eテスト実装ガイド

## 実装前の確認事項

### 1. ファイル存在確認

```bash
# テスト対象のファイルが存在するか確認
ls -la apps/web/e2e/
find apps/web -name "*.spec.ts" -type f
```

### 2. アプリケーション構造の理解

```bash
# ページ構造を確認
ls -la apps/web/src/app/
# デモページと認証が必要なページを区別
ls -la apps/web/src/app/demo/
ls -la apps/web/src/app/dashboard/
```

### 3. 既存のテストパターンを参照

```bash
# 成功しているテストを参考にする
grep -r "test\|describe" apps/web/e2e/*.spec.ts
```

## 認証の扱い

認証が必要なページのテストでは以下のパターンを使用：

```typescript
// ✅ Good: ページを開いてから認証設定
test('認証が必要なページ', async ({ page, context }) => {
  // まず適当なページを開く
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // 認証設定
  await UnifiedAuth.setupMockRoutes(context);
  await UnifiedAuth.setAuthData(page);

  // APIモックの設定
  await context.route('**/api/v1/auth/me', async (route) => {
    // ユーザー情報のモック
  });

  // 認証が必要なページへ移動
  await page.goto('/dashboard/...', { waitUntil: 'domcontentloaded' });
});

// ❌ Bad: beforeEachで全テスト共通の認証設定
test.beforeEach(async ({ page, context }) => {
  await UnifiedAuth.setAuthData(page); // about:blankで失敗する可能性
});
```

## セレクタの選択

```typescript
// ✅ Good: 複数の可能性を考慮した柔軟なセレクタ
const pageHasContent = await page.evaluate(() => {
  const bodyText = document.body.innerText || '';
  return (
    bodyText.includes('勘定科目') ||
    bodyText.includes('Accounts') ||
    document.querySelector('table') !== null ||
    document.querySelector('main') !== null
  );
});

// ❌ Bad: 単一の厳密なセレクタ
await expect(page.locator('h1:has-text("勘定科目")')).toBeVisible();
```

## ページタイプの違い

- **デモページ（/demo/...）**: 認証不要、公開ページ
- **ダッシュボードページ（/dashboard/...）**: 認証必要、適切なモック設定が必要

## ローカルテストの実行

```bash
# 必ずローカルで実行してから commit/push
REUSE_SERVER=true npx playwright test --project=chromium-desktop --reporter=list

# 特定のテストファイルのみ実行
REUSE_SERVER=true npx playwright test extended-coverage.spec.ts --project=chromium-desktop --reporter=list
```

## デバッグ方法

```bash
# トレースファイルを確認
npx playwright show-trace test-results/.../trace.zip

# スクリーンショットを確認
open test-results/.../test-failed-1.png
```

## よくある問題と解決策

### 「要素が見つからない」エラー

- ページが完全に読み込まれていない可能性
- 解決策: `waitUntil: 'networkidle'` や `timeout` オプションを使用

### 認証ページがエラーになる

- APIモックが正しく設定されていない
- 解決策: 必要なAPIエンドポイントをすべてモックする

### テストの不安定性

- タイミング問題や環境依存
- 解決策: 適切な待機時間と柔軟なアサーションを使用

## 関連ドキュメント

- [E2Eテスト実装ガイド](../testing/e2e/)
- [テストアンチパターン](../testing/testing-antipatterns-and-solutions.md)
