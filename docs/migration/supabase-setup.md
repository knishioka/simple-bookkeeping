# Supabase セットアップガイド

## 概要

このドキュメントは、Simple BookkeepingプロジェクトをSupabaseサーバーレス構成へ移行するための初期セットアップ手順を説明します。

## 前提条件

- Node.js v18以上
- pnpm v8以上
- PostgreSQL（ローカル開発用）
- Supabaseアカウント（本番環境用）

## セットアップ手順

### 1. Supabaseプロジェクトの作成

#### オンラインプロジェクト（本番環境）

1. [Supabase Dashboard](https://app.supabase.com)にログイン
2. 「New Project」をクリック
3. 以下の情報を入力：
   - Project name: `simple-bookkeeping`
   - Database Password: 強力なパスワードを設定
   - Region: Tokyo (Northeast Asia)を推奨
4. プロジェクト作成後、設定画面からAPIキーを取得

#### ローカル開発環境

```bash
# Supabase CLIのインストール
brew install supabase/tap/supabase

# プロジェクトディレクトリで初期化
cd /path/to/simple-bookkeeping
supabase init

# ローカルサービスの起動
supabase start
```

### 2. 環境変数の設定

`.env.local`ファイルを作成し、以下の環境変数を設定：

```bash
# .env.exampleをコピー
cp .env.example .env.local

# 以下の値を実際の値に置き換え
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# ローカル開発時
SUPABASE_DB_URL=postgresql://postgres:postgres@localhost:54322/postgres
SUPABASE_STUDIO_URL=http://localhost:54323
SUPABASE_API_URL=http://localhost:54321
```

### 3. データベースマイグレーション

#### 初回セットアップ

```bash
# マイグレーションファイルの実行
supabase db push

# または個別に実行
supabase db push --file supabase/migrations/20240101000001_initial_schema.sql
supabase db push --file supabase/migrations/20240101000000_rls_policies.sql
```

#### 既存データの移行

既存のPostgreSQLデータベースからSupabaseへデータを移行する場合：

```bash
# 既存DBからダンプを作成
pg_dump -h localhost -U bookkeeping -d simple_bookkeeping > backup.sql

# Supabaseへインポート
psql -h db.your-project-ref.supabase.co -U postgres -d postgres < backup.sql
```

### 4. Row Level Security (RLS) の設定

RLSは自動的に有効化されますが、以下のコマンドで確認できます：

```sql
-- Supabase SQL Editorで実行
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

### 5. 認証設定

#### Supabase Authの設定

1. Supabase Dashboardで「Authentication」→「Providers」へ移動
2. Email認証を有効化
3. 必要に応じてOAuth プロバイダーを設定（Google、GitHub等）

#### ユーザーの作成

```typescript
// サンプルコード
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 新規ユーザー登録
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
  options: {
    data: {
      name: 'Test User',
      role: 'accountant',
    },
  },
});
```

## ローカル開発

### Supabaseサービスの管理

```bash
# サービス起動
supabase start

# サービス停止
supabase stop

# サービスステータス確認
supabase status

# データベースリセット
supabase db reset

# Supabase Studio（GUI）を開く
supabase studio
```

### デバッグとログ

```bash
# ログの確認
supabase logs

# データベース接続
psql postgresql://postgres:postgres@localhost:54322/postgres
```

## 本番環境へのデプロイ

### 1. Supabaseプロジェクトのリンク

```bash
# プロジェクトをリンク
supabase link --project-ref your-project-ref

# リモートの状態を確認
supabase db remote status
```

### 2. マイグレーションの適用

```bash
# 本番環境へマイグレーションを適用
supabase db push --linked
```

### 3. 環境変数の設定（Vercel）

```bash
# Vercel CLIで環境変数を設定
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. RLSポリシーエラー

```sql
-- ポリシーの確認
SELECT * FROM pg_policies WHERE tablename = 'your_table';

-- ポリシーの無効化（デバッグ用）
ALTER TABLE your_table DISABLE ROW LEVEL SECURITY;
```

#### 2. 認証エラー

```typescript
// トークンの確認
const {
  data: { session },
} = await supabase.auth.getSession();
console.log('Session:', session);

// 強制的にセッションをリフレッシュ
const { data, error } = await supabase.auth.refreshSession();
```

#### 3. CORS エラー

Supabase Dashboardで以下を確認：

- API Settings → CORS Allowed Origins にフロントエンドのURLが含まれている
- 例: `http://localhost:3000`, `https://your-app.vercel.app`

## セキュリティベストプラクティス

1. **Service Role Keyの管理**
   - 絶対にクライアントサイドで使用しない
   - サーバーサイドのみで使用
   - 環境変数で管理

2. **RLSポリシーの徹底**
   - すべてのテーブルでRLSを有効化
   - ポリシーは最小権限の原則に従う
   - 定期的な監査を実施

3. **環境変数の分離**
   - 開発・ステージング・本番で異なるプロジェクトを使用
   - 各環境で異なるAPIキーを使用

## 次のステップ

1. [認証システムの移行](./auth-migration.md)
2. APIエンドポイントの移行
3. フロントエンドの接続設定
4. E2Eテストの更新

## リファレンス

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
