# E2Eテスト改修ガイド

## 🎯 改修概要

このE2Eテストスイートは、Radix UI Selectコンポーネントの操作安定化とテスト保守性向上を目的として全面的に改修されました。

## 🏗️ アーキテクチャ

### 1. Page Object Model (POM)

```
e2e/pages/
├── base-page.ts         # 全ページ共通の基底クラス
├── accounts-page.ts     # 勘定科目管理ページ
└── journal-entry-page.ts # 仕訳入力ページ
```

**使用例:**

```typescript
const accountsPage = new AccountsPage(page);
await accountsPage.navigate();
await accountsPage.createAccount({
  code: '1999',
  name: 'テスト勘定科目',
  type: '資産',
});
```

### 2. ヘルパーライブラリ

```
e2e/utils/
└── select-helpers.ts    # Radix UI Select専用操作
```

**RadixSelectHelper の主要メソッド:**

- `selectOption()` - オプション選択
- `selectWithTypeahead()` - 検索付き選択
- `getAvailableOptions()` - 利用可能オプション取得
- `waitForOptionsVisible()` - オプション表示待機

### 3. テストデータ管理

```
e2e/fixtures/
├── test-data.ts         # 共通テストデータ
└── mock-responses.ts    # API モックレスポンス統一
```

**MockResponseManager の使用例:**

```typescript
const mockManager = new MockResponseManager(page);
await mockManager.setupBasicMocks();
await mockManager.mockCustomResponse('**/api/v1/custom', {
  status: 200,
  body: { data: [...] }
});
```

### 4. ストーリーテスト基盤

```
e2e/user-stories/
├── story-test-base.ts   # ストーリーテスト基底クラス
└── freelancer/         # ペルソナ別ストーリー
```

**StoryTestHelper の機能:**

- 段階的ステップ実行
- パフォーマンス測定
- 受け入れ条件検証
- エラー再試行機能

## 🔧 主要改善点

### 1. Radix UI Select操作の安定化

**Before (問題のあるコード):**

```typescript
// 不安定な操作
await page.click('[role="combobox"]');
await page.click('[role="option"]:has-text("資産")');
```

**After (安定したコード):**

```typescript
// RadixSelectHelperを使用
await RadixSelectHelper.selectOption(page, '[role="combobox"]', '資産');
```

### 2. 再利用可能なテストコンポーネント

**勘定科目作成の例:**

```typescript
// Page Objectを使用した高レベル操作
await accountsPage.createAccount({
  code: '1999',
  name: 'テスト勘定科目',
  type: '資産',
});
```

### 3. 統一されたモックデータ管理

**共通テストデータの活用:**

```typescript
import { TestAccounts, FormTestData } from '../fixtures/test-data';

// 一貫したテストデータを使用
await journalPage.createSimpleEntry({
  debitAccount: TestAccounts.cash.name,
  creditAccount: TestAccounts.sales.name,
  // ...
});
```

## 📋 テスト実行ガイド

### 基本的な実行コマンド

```bash
# 全E2Eテストを実行
pnpm --filter @simple-bookkeeping/web test:e2e

# 特定のテストファイルを実行
pnpm --filter @simple-bookkeeping/web test:e2e select-test

# ブラウザを表示してテスト実行（デバッグ用）
pnpm --filter @simple-bookkeeping/web test:e2e:ui

# 特定のプロジェクトのみ実行
npx playwright test --project=chromium-desktop

# ストーリーテストのみ実行
npx playwright test --project=user-stories
```

### 環境別設定

#### ローカル開発環境

- タイムアウト: 45秒
- リトライ: 1回
- 並列実行: フル並列

#### CI環境

- タイムアウト: 60秒
- リトライ: 3回
- ワーカー数: 2（安定性重視）

## 🐛 トラブルシューティング

### よくある問題と解決策

#### 1. Select操作でタイムアウトエラー

**問題:**

```
TimeoutError: Locator.click: Timeout 30000ms exceeded.
```

**解決策:**

```typescript
// RadixSelectHelperを使用（より長いタイムアウト）
await RadixSelectHelper.selectOption(page, selector, option, 10000);

// または、要素の表示を明示的に待機
await page.locator('[role="combobox"]').waitFor();
```

#### 2. Page Object Modelの import エラー

**問題:**

```
Cannot find module '../pages/accounts-page'
```

**解決策:**

```typescript
// 正しいimport文
import { AccountsPage } from '../pages/accounts-page';
import { JournalEntryPage } from '../pages/journal-entry-page';
```

#### 3. モックレスポンスが適用されない

**問題:**
モックが設定されているのにAPIリクエストが実際のサーバーに送信される

**解決策:**

```typescript
// beforeEachでモックを確実に設定
test.beforeEach(async ({ page }) => {
  const mockManager = new MockResponseManager(page);
  await mockManager.setupBasicMocks();
  // その他の設定...
});
```

### デバッグ手法

#### 1. ブラウザ表示でのデバッグ

```bash
npx playwright test --debug
```

#### 2. スクリーンショットとビデオ

- 失敗時に自動的に生成される
- `playwright-report/` フォルダに保存

#### 3. トレース機能

```bash
npx playwright show-trace playwright-report/trace.zip
```

## 📈 パフォーマンス最適化

### プロジェクト別実行

**モバイルテストのみ:**

```bash
npx playwright test --project=mobile-chrome
```

**パフォーマンステストのみ:**

```bash
npx playwright test --project=performance
```

### 並列実行の制御

```typescript
// 特定のテストを直列実行
test.describe.configure({ mode: 'serial' });
```

## 🔄 継続的改善

### 新しいテストを追加する際のガイドライン

#### 1. Page Objectの拡張

```typescript
// AccountsPageに新しいメソッドを追加
async bulkImportAccounts(csvData: string): Promise<void> {
  // 実装...
}
```

#### 2. 新しいヘルパーの作成

```typescript
// e2e/utils/new-helper.ts
export class NewComponentHelper {
  // 新コンポーネント専用のヘルパーメソッド
}
```

#### 3. テストデータの追加

```typescript
// test-data.ts に新しいデータを追加
export const NewTestData = {
  // 新しいテストデータ
};
```

### 品質指標

#### 目標値

- **テスト成功率**: 90%以上
- **実行時間**: 全テスト10分以内
- **並列実行効率**: 70%以上

#### 監視項目

- 失敗率の高いテスト
- 実行時間の長いテスト
- 不安定（フレーキー）なテスト

## 📚 関連ドキュメント

- [Playwright 公式ドキュメント](https://playwright.dev/)
- [Radix UI Select](https://www.radix-ui.com/docs/primitives/components/select)
- [Page Object Model パターン](https://playwright.dev/docs/pom)

## 🤝 貢献ガイド

### テスト追加時のチェックリスト

- [ ] Page Object Modelを使用している
- [ ] RadixSelectHelperを使用している
- [ ] 共通テストデータを活用している
- [ ] 適切なタイムアウトを設定している
- [ ] モバイル対応が必要な場合は考慮している
- [ ] エラーハンドリングが適切である

### レビューポイント

1. **再利用性**: 他のテストでも使える形になっているか
2. **安定性**: フレーキーテストになる要素はないか
3. **可読性**: テストの意図が明確か
4. **保守性**: メンテナンスしやすい構造か

---

このガイドは、E2Eテストの改修内容と今後の開発指針をまとめたものです。
テスト品質の向上と開発効率の改善のため、継続的に更新していきます。
