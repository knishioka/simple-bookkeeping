# Performance: Optimize E2E test timeouts and execution speed

## 🎯 概要

E2Eテストの実行時間が長く、開発効率を低下させています。特に30秒のタイムアウト設定が多用されており、テスト全体の実行時間が必要以上に長くなっています。パフォーマンスを最適化し、テストの信頼性を保ちながら実行時間を短縮します。

## 🔍 現状の問題点

### 1. 過剰なタイムアウト設定

| 現在の設定 | 使用箇所             | 実際に必要な時間 |
| ---------- | -------------------- | ---------------- |
| 30000ms    | E2E全般のデフォルト  | 5000-10000ms     |
| 30000ms    | データベース操作待機 | 2000-3000ms      |
| 30000ms    | ページ遷移待機       | 1000-2000ms      |
| 30000ms    | API応答待機          | 500-1000ms       |

### 2. パフォーマンスボトルネック

```typescript
// ❌ 現状の問題のあるコード
test('should load journal entries', async ({ page }) => {
  await page.goto('/journal-entries');
  await page.waitForTimeout(3000); // 固定待機時間
  await expect(page.locator('table')).toBeVisible({ timeout: 30000 });
});

// ❌ 非効率な待機処理
await page.waitForLoadState('networkidle'); // 全ネットワーク停止まで待機
await page.waitForTimeout(5000); // 追加の固定待機
```

### 3. テスト実行時間の統計

| テストスイート          | 現在の実行時間 | 理想的な実行時間 |
| ----------------------- | -------------- | ---------------- |
| basic.spec.ts           | 45秒           | 15秒             |
| journal-entries.spec.ts | 120秒          | 40秒             |
| accounts.spec.ts        | 90秒           | 30秒             |
| auth.spec.ts            | 60秒           | 20秒             |
| **合計**                | **約8分**      | **約3分**        |

## 💡 推奨される解決策

### 1. 適切なタイムアウト設定

```typescript
// playwright.config.ts
export default defineConfig({
  timeout: 10000, // グローバルタイムアウトを10秒に
  expect: {
    timeout: 5000, // アサーションタイムアウトを5秒に
  },
  use: {
    actionTimeout: 3000, // アクションタイムアウトを3秒に
    navigationTimeout: 5000, // ナビゲーションタイムアウトを5秒に
  },
});

// 特定のテストで長い処理が必要な場合のみ個別設定
test('should process large dataset', async ({ page }) => {
  test.setTimeout(20000); // このテストのみ20秒
  // ...
});
```

### 2. 効率的な待機戦略

```typescript
// ✅ 要素の出現を待つ
await page.waitForSelector('[data-testid="journal-table"]', {
  state: 'visible',
  timeout: 5000,
});

// ✅ 特定の条件を待つ
await page.waitForFunction(() => document.querySelectorAll('tbody tr').length > 0, {
  timeout: 3000,
});

// ✅ APIレスポンスを待つ
const responsePromise = page.waitForResponse(
  (response) => response.url().includes('/api/journal-entries') && response.status() === 200,
  { timeout: 3000 }
);
await page.click('[data-testid="load-button"]');
await responsePromise;
```

### 3. テストの並列実行

```typescript
// playwright.config.ts
export default defineConfig({
  workers: process.env.CI ? 2 : 4, // 並列実行数を増やす
  fullyParallel: true, // 完全並列実行を有効化

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /.*\.spec\.ts/,
    },
  ],
});
```

### 4. テストデータの最適化

```typescript
// テストデータの事前準備
test.beforeAll(async ({ request }) => {
  // APIで直接データを準備（UIを通さない）
  await request.post('/api/test/seed', {
    data: { scenario: 'journal-entries' },
  });
});

// テストデータのクリーンアップ
test.afterAll(async ({ request }) => {
  await request.delete('/api/test/cleanup');
});
```

### 5. セレクタの最適化

```typescript
// ❌ 遅いセレクタ
await page.locator('div > div > button:has-text("Submit")').click();

// ✅ 高速なセレクタ
await page.locator('[data-testid="submit-button"]').click();
await page.locator('#submit-btn').click();
```

## 📋 アクセプタンスクライテリア

- [ ] E2Eテスト全体の実行時間が50%以上短縮される
- [ ] タイムアウトエラーの発生率が減少する
- [ ] テストの信頼性が維持される（フレーキーテストがない）
- [ ] 並列実行が正しく動作する
- [ ] CI/CDでの実行時間が5分以内になる
- [ ] テストコードが読みやすく保守しやすい

## 🏗️ 実装ステップ

1. **現状分析**（1日）
   - 各テストの実行時間測定
   - ボトルネックの特定
   - 待機時間の分析

2. **設定の最適化**（1日）
   - playwright.config.tsの更新
   - グローバルタイムアウトの調整
   - 並列実行の設定

3. **テストコードのリファクタリング**（3日）
   - 固定待機時間の削除
   - 効率的な待機戦略の実装
   - セレクタの最適化

4. **テストデータ管理の改善**（2日）
   - APIベースのデータ準備
   - テストデータの共有化
   - クリーンアップの自動化

5. **検証と調整**（1日）
   - パフォーマンス測定
   - フレーキーテストの修正
   - CI/CDでの動作確認

## ⏱️ 見積もり工数

- **総工数**: 8人日
- **優先度**: Medium 🟡
- **影響度**: 開発効率とCI/CD速度

## 🏷️ ラベル

- `performance`
- `testing`
- `medium-priority`
- `developer-experience`

## 📊 成功指標

- E2Eテスト実行時間: 8分 → 3分以下
- タイムアウトエラー: 90%削減
- CI/CD実行時間: 50%短縮
- テスト成功率: 98%以上維持
- 並列実行効率: 70%以上

## ⚠️ リスクと考慮事項

- **タイムアウト短縮によるエラー**: ネットワークが遅い環境での失敗
- **並列実行の競合**: データベースやポートの競合
- **テストの信頼性低下**: 最適化により見逃されるバグ
- **環境依存**: ローカルとCIで異なる動作

## 🛠️ パフォーマンス測定ツール

```typescript
// テスト実行時間の測定
test.beforeEach(async ({}, testInfo) => {
  console.time(`Test: ${testInfo.title}`);
});

test.afterEach(async ({}, testInfo) => {
  console.timeEnd(`Test: ${testInfo.title}`);
});

// HTMLレポートの生成
// playwright.config.ts
export default defineConfig({
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results.json' }],
  ],
});
```

## 🔄 段階的な最適化アプローチ

### Phase 1: Quick Wins（1週目）

- グローバルタイムアウトの調整
- 固定待機時間の削除
- 明らかに長すぎるタイムアウトの修正

### Phase 2: 構造的改善（2週目）

- 並列実行の導入
- テストデータ管理の改善
- セレクタの最適化

### Phase 3: 継続的改善（3週目以降）

- パフォーマンスモニタリング
- フレーキーテストの特定と修正
- 更なる最適化の検討

## 📚 参考資料

- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright Performance Tips](https://playwright.dev/docs/test-parallel)
- [Web Performance Testing](https://web.dev/vitals/)
- [E2E Testing Optimization](https://martinfowler.com/articles/practical-test-pyramid.html#E2eTests)
