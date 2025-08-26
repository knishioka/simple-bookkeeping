# Supabase Integration Guide

## 概要

このドキュメントは、Simple BookkeepingプロジェクトをSupabaseに移行するための包括的なガイドです。

## 目次

1. [セットアップ](#セットアップ)
2. [データベース構造](#データベース構造)
3. [認証とセキュリティ](#認証とセキュリティ)
4. [マイグレーション](#マイグレーション)
5. [開発ワークフロー](#開発ワークフロー)
6. [トラブルシューティング](#トラブルシューティング)

## セットアップ

### 1. Supabaseプロジェクトの作成

1. [Supabase](https://app.supabase.com)にアクセスしてプロジェクトを作成
2. プロジェクトダッシュボードから以下の情報を取得：
   - Project URL
   - Anon Key
   - Service Role Key
   - Project ID

### 2. 環境変数の設定

```bash
# .env.supabase.exampleをコピーして設定
cp .env.supabase.example .env.local

# 取得した情報を.env.localに設定
```

### 3. Supabase CLIのインストール

```bash
# macOS
brew install supabase/tap/supabase

# npm/yarn
npm install -g supabase
```

### 4. ローカル開発環境の起動

```bash
# Supabaseローカル環境を起動
supabase start

# 停止
supabase stop
```

## データベース構造

### テーブル構成

```sql
-- 主要テーブル
- organizations: 組織管理
- users: ユーザー管理（auth.usersと連携）
- accounting_periods: 会計期間
- accounts: 勘定科目
- partners: 取引先
- journal_entries: 仕訳ヘッダー
- journal_entry_lines: 仕訳明細
- audit_logs: 監査ログ
```

### 型定義

型定義は自動生成されます：

```bash
# Supabase型を生成
pnpm --filter @simple-bookkeeping/supabase-client db:generate-types
```

## 認証とセキュリティ

### Row Level Security (RLS)

すべてのテーブルでRLSが有効になっています：

- **組織分離**: ユーザーは所属組織のデータのみアクセス可能
- **ロールベース**: admin/accountant/viewerの権限管理
- **監査ログ**: すべての変更を自動記録

### 認証フロー

```typescript
// クライアントサイド認証
import { supabase } from '@simple-bookkeeping/supabase-client';

// ログイン
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password',
});

// ログアウト
await supabase.auth.signOut();

// セッション取得
const {
  data: { session },
} = await supabase.auth.getSession();
```

## マイグレーション

### 既存データのマイグレーション

```bash
# Prismaデータベースからのマイグレーション
pnpm --filter @simple-bookkeeping/supabase-client db:migrate
```

### スキーマのマイグレーション

```bash
# 新しいマイグレーションを作成
supabase migration new <migration_name>

# マイグレーションを適用
supabase migration up

# ロールバック
supabase migration down
```

## 開発ワークフロー

### 1. ローカル開発

```bash
# Supabaseローカル環境を起動
supabase start

# アプリケーションを起動
pnpm dev

# Supabase Studioを開く（データベース管理UI）
supabase studio
```

### 2. データベース変更

1. SQLマイグレーションファイルを作成
2. `supabase migration up`で適用
3. 型定義を再生成

### 3. デプロイ

```bash
# リモートに変更を適用
supabase db push

# 本番環境の型を生成
supabase gen types typescript --project-id=your-project-id
```

## API使用例

### データ取得

```typescript
import { supabase } from '@simple-bookkeeping/supabase-client';

// 勘定科目を取得
const { data: accounts, error } = await supabase
  .from('accounts')
  .select('*')
  .eq('organization_id', orgId)
  .order('code');

// 仕訳とその明細を取得
const { data: entries, error } = await supabase
  .from('journal_entries')
  .select(
    `
    *,
    journal_entry_lines (
      *,
      account:accounts(*)
    )
  `
  )
  .eq('accounting_period_id', periodId);
```

### データ作成

```typescript
// 仕訳を作成（トランザクション）
const { data: entry, error } = await supabase.rpc('create_journal_entry', {
  entry_data: {
    accounting_period_id: periodId,
    entry_date: '2024-01-15',
    description: '売上計上',
  },
  lines: [
    {
      account_id: cashAccountId,
      debit_amount: 1000,
      credit_amount: 0,
    },
    {
      account_id: salesAccountId,
      debit_amount: 0,
      credit_amount: 1000,
    },
  ],
});
```

### リアルタイム購読

```typescript
// 仕訳の変更をリアルタイムで監視
const subscription = supabase
  .channel('journal_entries')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'journal_entries',
      filter: `organization_id=eq.${orgId}`,
    },
    (payload) => {
      console.log('Change received!', payload);
    }
  )
  .subscribe();

// 購読解除
subscription.unsubscribe();
```

## Edge Functions

複雑なビジネスロジックはEdge Functionsで実装：

```typescript
// supabase/functions/calculate-balance/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  const { accountId, date } = await req.json();

  // 残高計算ロジック
  const balance = await calculateBalance(accountId, date);

  return new Response(JSON.stringify({ balance }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

## トラブルシューティング

### よくある問題と解決策

#### 1. RLSポリシーエラー

```
Error: new row violates row-level security policy
```

**解決策**: ユーザーの組織IDと権限を確認

```sql
-- ユーザーの権限を確認
SELECT * FROM users WHERE id = auth.uid();
```

#### 2. 型エラー

```
Type 'unknown' is not assignable to type 'Database'
```

**解決策**: 型定義を再生成

```bash
pnpm --filter @simple-bookkeeping/supabase-client db:generate-types
```

#### 3. 接続エラー

```
Error: Unable to connect to Supabase
```

**解決策**: 環境変数を確認

```bash
# 必須環境変数
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY
```

## パフォーマンス最適化

### 1. インデックス

適切なインデックスが設定されています：

```sql
-- パフォーマンス向上のためのインデックス
CREATE INDEX idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX idx_journal_entry_lines_account ON journal_entry_lines(account_id);
```

### 2. クエリ最適化

```typescript
// Bad: N+1クエリ
const entries = await supabase.from('journal_entries').select('*');
for (const entry of entries.data) {
  const lines = await supabase
    .from('journal_entry_lines')
    .select('*')
    .eq('journal_entry_id', entry.id);
}

// Good: JOINを使用
const entries = await supabase.from('journal_entries').select('*, journal_entry_lines(*)');
```

### 3. キャッシュ戦略

```typescript
// React Queryとの統合
import { useQuery } from '@tanstack/react-query';

function useAccounts(orgId: string) {
  return useQuery({
    queryKey: ['accounts', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('organization_id', orgId);

      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5分間キャッシュ
  });
}
```

## セキュリティベストプラクティス

1. **環境変数の管理**: 本番環境のキーは絶対にコミットしない
2. **RLSの徹底**: すべてのテーブルでRLSを有効化
3. **Service Roleキーの制限**: クライアントサイドでは使用しない
4. **監査ログ**: すべての変更を記録

## 参考リンク

- [Supabase公式ドキュメント](https://supabase.com/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Edge Functions Guide](https://supabase.com/docs/guides/functions)
