# テストガイド

## テスト記述規約

### Server Actionsのテスト

```typescript
// ✅ Good: Server Actionsのテスト
import { createJournalEntry, getJournalEntries } from '@/app/actions/journal-entries';
import { createClient } from '@/lib/supabase/server';

// モックの設定
jest.mock('@/lib/supabase/server');

describe('Journal Entry Actions', () => {
  describe('createJournalEntry', () => {
    it('should create a balanced journal entry', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'test-user' } },
          }),
        },
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: '123', date: '2024-01-15' },
              }),
            }),
          }),
        }),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      const formData = new FormData();
      formData.append('date', '2024-01-15');
      formData.append('description', '売上計上');

      const result = await createJournalEntry(formData);

      expect(result.id).toBe('123');
      expect(mockSupabase.from).toHaveBeenCalledWith('journal_entries');
    });

    it('should throw error if user is not authenticated', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
          }),
        },
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      const formData = new FormData();

      await expect(createJournalEntry(formData)).rejects.toThrow('Unauthorized');
    });
  });
});
```

## テストの実行義務

### push前の必須確認事項

```bash
# 1. ESLintチェック
pnpm lint

# 2. TypeScriptの型チェック
pnpm typecheck

# 3. 単体テストの実行
pnpm test

# 4. E2Eテストの実行（必須）
pnpm --filter web test:e2e

# 5. ビルドが通ることを確認
pnpm build
```

### ⚠️ 重要: Push前の必須手順

以下の手順を**必ず順番通りに実行**してからpushすること：

1. **Lint チェック**

   ```bash
   pnpm lint
   # エラーがある場合は修正してから次へ
   ```

2. **Unit Test 実行**

   ```bash
   pnpm test
   # 全てのテストが通ることを確認
   ```

3. **E2E Test 実行（絶対にスキップしない）**

   ```bash
   pnpm --filter web test:e2e
   # ローカルでE2Eテストが全て通ることを確認
   # 失敗した場合は必ず修正してから再実行
   ```

4. **最終ビルド確認**
   ```bash
   pnpm build
   # ビルドエラーがないことを確認
   ```

### 🚫 絶対にやってはいけないこと

- E2Eテストをスキップしてpushする
- テストが失敗したまま`--no-verify`でpushする
- `test.skip`や`describe.skip`を使ってテストを無効化する
- ローカルで確認せずにCIでのテストに頼る

### テストが失敗した場合

1. 必ず失敗の原因を調査する
2. テストを修正するか、コードを修正する
3. テストをスキップしたり削除したりしない
4. E2Eテストは特に重要 - 必ず全て通してからpush

## E2Eテスト実装の教訓

### 1. 実装前の確認事項

E2Eテストを実装する前に必ず以下を確認すること：

1. **実際のファイル存在確認**

   ```bash
   # テスト対象のファイルが存在するか確認
   ls -la apps/web/e2e/
   find apps/web -name "*.spec.ts" -type f
   ```

2. **アプリケーション構造の理解**

   ```bash
   # ページ構造を確認
   ls -la apps/web/src/app/
   # デモページと認証が必要なページを区別
   ls -la apps/web/src/app/demo/
   ls -la apps/web/src/app/dashboard/
   ```

3. **既存のテストパターンを参照**
   ```bash
   # 成功しているテストを参考にする
   grep -r "test\|describe" apps/web/e2e/*.spec.ts
   ```

### 2. 認証の扱い

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

### 3. セレクタの選択

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

### 4. デモページ vs ダッシュボードページ

- **デモページ（/demo/...）**: 認証不要、公開ページ
- **ダッシュボードページ（/dashboard/...）**: 認証必要、適切なモック設定が必要

### 5. ローカルテストの重要性

```bash
# 必ずローカルで実行してから commit/push
REUSE_SERVER=true npx playwright test --project=chromium-desktop --reporter=list

# 特定のテストファイルのみ実行
REUSE_SERVER=true npx playwright test extended-coverage.spec.ts --project=chromium-desktop --reporter=list
```

### 6. エラー時のデバッグ

```bash
# トレースファイルを確認
npx playwright show-trace test-results/.../trace.zip

# スクリーンショットを確認
open test-results/.../test-failed-1.png
```

## E2Eテストの改善と教訓

### E2Eテストを修正する際のステップ

1. **サーバーの確認**

   ```bash
   # Webサーバーが正しく起動しているか確認
   curl -s http://localhost:3000 | grep -q "Simple Bookkeeping"

   # 間違ったアプリが起動している場合は停止
   pkill -f "next dev" || true

   # 正しいアプリを起動
   pnpm --filter @simple-bookkeeping/web dev
   ```

2. **実際のページ構造の確認**

   ```bash
   # HTML構造を確認
   curl -s http://localhost:3000/demo/accounts | grep -o "<h1[^>]*>[^<]*</h1>"
   ```

3. **セレクタの適切な選択**
   - `waitUntil: 'networkidle'` を使用してページの完全な読み込みを待つ
   - `timeout` オプションを設定して十分な待機時間を確保
   - `filter({ hasText: '...' })` を使用してより正確な要素を選択

4. **認証が必要なページのテスト**

   ```typescript
   // 必ずbeforeEachでAPIモックを設定
   test.beforeEach(async ({ page, context }) => {
     await UnifiedAuth.setupMockRoutes(context);
     await context.route('**/api/v1/auth/me', async (route) => {
       // ユーザー情報のモック
     });
   });

   // テスト内で認証設定
   await page.goto('/', { waitUntil: 'domcontentloaded' });
   await UnifiedAuth.setAuthData(page);
   ```

5. **ダイアログテストの注意点**
   - Radix UIのダイアログは`[data-state="open"]`属性を持つ
   - `waitForTimeout`を使用してダイアログのアニメーションを待つ
   - フォーム要素は`name`属性で特定

6. **テストの実行とデバッグ**

   ```bash
   # 全テストを実行
   REUSE_SERVER=true npx playwright test --project=chromium-desktop --reporter=list

   # 特定のテストのみ実行
   REUSE_SERVER=true npx playwright test extended-coverage.spec.ts:203 --project=chromium-desktop

   # トレースを表示
   npx playwright show-trace test-results/output/.../trace.zip
   ```

### よくある問題と解決策

1. **「要素が見つからない」エラー**
   - ページが完全に読み込まれていない可能性
   - 解決策: `waitUntil: 'networkidle'` や `timeout` オプションを使用

2. **認証ページがエラーになる**
   - APIモックが正しく設定されていない
   - 解決策: 必要なAPIエンドポイントをすべてモックする

3. **テストの不安定性**
   - タイミング問題や環境依存
   - 解決策: 適切な待機時間と柔軟なアサーションを使用

## サーバー起動時の必須確認事項

### Webサーバー起動手順

```bash
# サーバー起動
pnpm --filter @simple-bookkeeping/web dev

# 疎通確認（必須）
curl -I http://localhost:3000
curl -s http://localhost:3000 | grep -q "Simple Bookkeeping"
```

### 重要: サーバー起動時の必須ルール

1. **疎通確認必須**: サーバー起動後は必ず動作確認を行う
2. **複数ページテスト**: 主要ページ（/, /demo, /demo/accounts, /demo/journal-entries）の動作を確認
3. **失敗時の対応**: 疎通確認に失敗した場合は原因調査と再起動を行う
4. **ユーザー報告**: 疎通確認完了後にのみURLを案内する

### 疎通確認コマンド例

```bash
# 基本疎通確認
curl -I http://localhost:3000

# ページ内容確認
curl -s http://localhost:3000 | head -5

# デモページ確認
curl -s http://localhost:3000/demo | grep -q "機能デモ" && echo "✅ Demo working" || echo "❌ Demo failed"
curl -s http://localhost:3000/demo/accounts | grep -q "勘定科目管理" && echo "✅ Accounts working" || echo "❌ Accounts failed"
curl -s http://localhost:3000/demo/journal-entries | grep -q "仕訳入力" && echo "✅ Journal entries working" || echo "❌ Journal entries failed"
```

### APIサーバー起動時も同様に確認

```bash
# APIサーバー起動
pnpm --filter @simple-bookkeeping/api dev

# 疎通確認（廃止予定）
# Express.js APIサーバーは段階的に廃止されます
# curl -I http://localhost:3001/api/v1/
# curl -s http://localhost:3001/api/v1/ | grep -q "Simple Bookkeeping API"
```

## テスト駆動開発の原則

- 新機能実装時は先にテストを書く
- 単体テストのカバレッジ80%以上を維持
- E2Eテストで主要なユーザーフローをカバー
- バグ修正時は再現テストを先に書く

## パフォーマンステストのヒント

### クエリ最適化

```typescript
// ✅ Good: 必要なデータのみ取得
const getAccountsWithBalance = async (date: Date) => {
  return await prisma.account.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      journalLines: {
        select: {
          debitAmount: true,
          creditAmount: true,
        },
        where: {
          journalEntry: {
            entryDate: { lte: date },
          },
        },
      },
    },
  });
};

// ❌ Bad: N+1問題
const accounts = await prisma.account.findMany();
for (const account of accounts) {
  const balance = await prisma.journalEntryLine.aggregate({
    where: { accountId: account.id },
    _sum: { debitAmount: true, creditAmount: true },
  });
}
```
