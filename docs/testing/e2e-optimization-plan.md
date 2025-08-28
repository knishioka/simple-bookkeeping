# E2Eテスト最適化プラン

## 現状分析

### テスト実行時間

- **総テスト数**: 144テスト
- **実行時間**: 約1.5分（CI環境）
- **並列実行**: 4ワーカー

### テストファイル別の分析

| ファイル                      | 行数 | テスト数 | 主な内容                           |
| ----------------------------- | ---- | -------- | ---------------------------------- |
| accounting-periods.spec.ts    | 704  | 11       | 会計期間管理テスト（最大ファイル） |
| extended-coverage.spec.ts     | 428  | 13       | 拡張カバレッジテスト               |
| audit-logs.spec.ts            | 345  | 10       | 監査ログテスト                     |
| simple-entry.spec.ts          | 256  | 9        | かんたん入力テスト                 |
| css-styles.spec.ts            | 256  | 8        | CSSスタイルテスト                  |
| basic.spec.ts                 | 241  | 9        | 基本的なページアクセステスト       |
| responsive-navigation.spec.ts | 227  | 5        | レスポンシブナビゲーションテスト   |
| dialog-interactions.spec.ts   | 154  | 4        | ダイアログ操作テスト               |
| auth-test.spec.ts             | 111  | 4        | 認証テスト（スキップ中）           |
| journal-entries.spec.ts       | 42   | 3        | 仕訳入力テスト                     |

## 主な問題点

### 1. 時間がかかっているテスト

- `accounting-periods.spec.ts:173` - 編集テスト: **7.3秒**
- `audit-logs.spec.ts:99` - フィルタリングテスト: **8.0秒**
- 多くのテストが3秒以上かかっている

### 2. タイムアウト設定

- テスト全体: 30秒（ローカル）/ 20秒（CI）
- ナビゲーション: 10秒（CI）
- これらの設定が長すぎる可能性

### 3. リトライ設定

- CI環境で2回リトライ（最大3回実行）
- 失敗したテストが3回実行されるため時間がかかる

## 最適化提案

### 1. 即座に実施できる最適化

#### A. 重複テストの削除

```typescript
// extended-coverage.spec.ts と basic.spec.ts で重複しているテストを統合
// 例: デモページのテストが両方に存在
```

#### B. スキップ中のテストを削除

```typescript
// auth-test.spec.ts の4つのテストはすべてスキップされている
// → 削除または別ファイルに移動
```

#### C. CSSテストの簡略化

- CSSスタイルのテスト（8個）は本当にE2Eで必要か？
- ユニットテストまたはビジュアルリグレッションテストへ移行を検討

### 2. 設定の最適化

#### A. タイムアウトの短縮

```typescript
// playwright.config.ts
const TEST_TIMEOUTS = {
  test: isCI ? 15000 : 20000, // 20秒 → 15秒（CI）
  expect: 1500, // 2秒 → 1.5秒
  action: 2000, // 3秒 → 2秒
  navigation: isCI ? 5000 : 3000, // 10秒 → 5秒（CI）
};
```

#### B. リトライ回数の削減

```typescript
const RETRIES = {
  ci: 1, // 2回 → 1回
  local: 0, // そのまま
};
```

#### C. ワーカー数の最適化

```typescript
const WORKERS = {
  ci: 6, // 4 → 6（並列度を上げる）
  local: '75%',
};
```

### 3. テストの分割と並列実行

#### A. テストのグループ化

```typescript
// package.json に追加
"test:e2e:core": "playwright test basic accounting-periods journal-entries",
"test:e2e:ui": "playwright test css-styles dialog-interactions responsive-navigation",
"test:e2e:features": "playwright test simple-entry audit-logs extended-coverage",
```

#### B. CIでの並列ジョブ実行

```yaml
# .github/workflows/e2e-tests.yml
jobs:
  e2e-core:
    # 基本機能のテスト
  e2e-ui:
    # UIテスト
  e2e-features:
    # 機能テスト
```

### 4. テストコードの最適化

#### A. 共通処理の効率化

```typescript
// beforeEachで重複している認証処理を最適化
test.beforeAll(async ({ browser }) => {
  // 認証を一度だけ実行してコンテキストを共有
});
```

#### B. 不要な待機の削除

```typescript
// waitForTimeout の使用を避ける
// await page.waitForTimeout(1000); // ❌
await page.waitForSelector('.element'); // ✅
```

### 5. 長期的な改善

#### A. テストの分類

- **Critical Path Tests**: 必須機能のみ（毎回実行）
- **Full Regression**: 全テスト（mainブランチのみ）
- **Smoke Tests**: 最小限のテスト（PR時）

#### B. テストデータの事前準備

- テストDBのシード最適化
- モックデータの共有化

## 実装優先順位

1. **高優先度**（すぐに効果が出る）✅ 完了
   - [x] auth-test.spec.ts のスキップテストを削除
   - [x] タイムアウト設定の短縮
   - [x] リトライ回数の削減
   - [x] ワーカー数の増加（6ワーカーに増加）

2. **中優先度**（効果的だが検証が必要）✅ 完了
   - [x] 重複テストの統合（extended-coverage.spec と basic.spec）
   - [x] CSSテストの簡略化（8個→3個に削減）
   - [x] waitForTimeout の削除（条件ベース待機へ改善）

3. **低優先度**（長期的な改善）
   - [ ] テストの分類と選択的実行
   - [ ] CI並列ジョブの実装
   - [ ] テストデータの最適化

## 期待される効果

現在の実行時間: **約1.5分**

最適化後の予想:

- 即座の最適化: **約1分**（33%削減）
- 完全な最適化: **約45秒**（50%削減）

## 実装済みの最適化（2025-08-27）

### 第1段階: 高優先度タスク

- ✅ auth-test.spec.ts の削除（4個のスキップテスト削除）
- ✅ タイムアウト設定の短縮（CI: 20s→15s, expect: 2s→1.5s, action: 3s→2s, navigation: 10s→5s）
- ✅ リトライ回数の削減（CI: 2→1回）
- ✅ ワーカー数の増加（CI: 4→6ワーカー）

### 第2段階: 中優先度タスク

- ✅ 重複テストの統合
  - extended-coverage.spec から基本表示テスト3個を削除
  - basic.spec に基本テストを集約
- ✅ CSSテストの簡略化
  - 8個のテストを3個に削減（基本CSS変数、レスポンシブ、ファイル読み込みのみ）
- ✅ waitForTimeout の削除
  - dialog-interactions.spec: waitForLoadState() へ置き換え
  - extended-coverage.spec: 条件ベースの待機へ改善

### 次のステップ

1. CI環境での実行時間測定
2. 必要に応じて低優先度タスクの実装検討
3. パフォーマンス監視の継続
