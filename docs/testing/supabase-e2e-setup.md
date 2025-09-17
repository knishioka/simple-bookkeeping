# Supabase E2E テスト環境セットアップガイド

## 概要

本ドキュメントでは、Simple Bookkeeping プロジェクトのE2Eテストで使用するSupabase認証環境のセットアップ手順を説明します。実際のSupabase認証を使用することで、本番環境により近い形でのテストが可能になります。

## 重要な注意事項

⚠️ **テスト専用のSupabaseプロジェクトを必ず使用してください。本番環境のSupabaseプロジェクトは絶対に使用しないでください。**

## セットアップ手順

### 1. Supabaseテストプロジェクトの作成

1. [Supabaseダッシュボード](https://app.supabase.com)にログイン
2. 「New Project」をクリック
3. プロジェクト名を設定（例: `simple-bookkeeping-test`）
4. データベースパスワードを設定（安全に保管してください）
5. リージョンを選択（東京推奨: `Northeast Asia (Tokyo)`）

### 2. 環境変数の設定

#### 2.1 環境変数ファイルの作成

```bash
# プロジェクトルートで実行
cp .env.test.example .env.test.local
```

#### 2.2 Supabase設定値の取得と設定

Supabaseダッシュボードから以下の値を取得し、`.env.test.local`に設定：

1. **Settings > API** から:
   - `NEXT_PUBLIC_SUPABASE_URL`: Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Anon/public key
   - `SUPABASE_SERVICE_ROLE_KEY`: Service role key（秘密鍵）

2. **Settings > Database** から:
   - `SUPABASE_DB_URL`: Connection string（Direct connection）

```bash
# .env.test.local の例
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_DB_URL=postgresql://postgres:YOUR_PASSWORD@db.abcdefghijklmnop.supabase.co:6543/postgres
```

### 3. データベーススキーマの設定

#### 3.1 必要なテーブルの作成

Supabase SQL Editorで以下のSQLを実行：

```sql
-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  plan TEXT DEFAULT 'standard',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User organizations relationship
CREATE TABLE IF NOT EXISTS user_organizations (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, organization_id)
);

-- Accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  balance DECIMAL(15, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, code)
);

-- Journal entries table
CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  description TEXT,
  amount DECIMAL(15, 2) NOT NULL,
  debit_account_id TEXT REFERENCES accounts(id),
  credit_account_id TEXT REFERENCES accounts(id),
  status TEXT DEFAULT 'posted' CHECK (status IN ('draft', 'posted', 'canceled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Accounting periods table
CREATE TABLE IF NOT EXISTS accounting_periods (
  id TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, start_date, end_date)
);
```

#### 3.2 Row Level Security (RLS) の設定

```sql
-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_periods ENABLE ROW LEVEL SECURITY;

-- Create policies for test environment (permissive for testing)
-- Note: These are test-only policies. Production policies should be more restrictive.

-- Organizations policies
CREATE POLICY "Test users can view their organizations" ON organizations
  FOR SELECT USING (
    id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Test users can create organizations" ON organizations
  FOR INSERT WITH CHECK (true);

-- User organizations policies
CREATE POLICY "Test users can view their assignments" ON user_organizations
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Test users can assign themselves" ON user_organizations
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Accounts policies
CREATE POLICY "Test users can manage accounts in their org" ON accounts
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid()
    )
  );

-- Journal entries policies
CREATE POLICY "Test users can manage journal entries in their org" ON journal_entries
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid()
    )
  );

-- Accounting periods policies
CREATE POLICY "Test users can manage periods in their org" ON accounting_periods
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid()
    )
  );
```

### 4. E2Eテストの実行

#### 4.1 ローカル環境でのテスト実行

```bash
# 環境変数を読み込んでテスト実行
source .env.test.local
pnpm test:e2e
```

#### 4.2 特定のテストファイルの実行

```bash
# 認証テストのみ実行
pnpm --filter web test:e2e auth.spec.ts

# デバッグモードで実行
pnpm --filter web test:e2e --debug
```

#### 4.3 ヘッドレスモードの切り替え

```bash
# ブラウザを表示して実行（デバッグ用）
TEST_HEADLESS=false pnpm test:e2e
```

### 5. CI/CD設定

GitHub Actionsでテストを実行するには、以下のSecretsを設定：

#### GitHub Secrets設定

リポジトリの Settings > Secrets and variables > Actions で以下を追加：

- `TEST_SUPABASE_URL`: テスト用SupabaseプロジェクトのURL
- `TEST_SUPABASE_ANON_KEY`: テスト用Anon Key
- `TEST_SUPABASE_SERVICE_ROLE_KEY`: テスト用Service Role Key
- `TEST_SUPABASE_DB_URL`: テスト用データベース接続URL
- `TEST_ADMIN_EMAIL`: 管理者テストユーザーのメール
- `TEST_ADMIN_PASSWORD`: 管理者テストユーザーのパスワード
- `TEST_ACCOUNTANT_EMAIL`: 経理担当テストユーザーのメール
- `TEST_ACCOUNTANT_PASSWORD`: 経理担当テストユーザーのパスワード
- `TEST_VIEWER_EMAIL`: 閲覧者テストユーザーのメール
- `TEST_VIEWER_PASSWORD`: 閲覧者テストユーザーのパスワード
- `TEST_ORGANIZATION_ID`: テスト組織のID

### 6. テストデータ管理

#### 6.1 テストユーザーの自動作成

E2Eテストは自動的にテストユーザーを作成・削除します：

```typescript
// apps/web/e2e/helpers/supabase-auth.ts
import { SupabaseAuth } from './helpers/supabase-auth';

// テスト前のセットアップ
await SupabaseAuth.setup(context, page, { role: 'admin' });

// テスト後のクリーンアップ
await SupabaseAuth.clear(context, page);
await SupabaseAuth.cleanupAllTestUsers();
```

#### 6.2 テストデータの作成

```typescript
// apps/web/e2e/helpers/test-data-manager.ts
import { setupTestEnvironment, cleanupTestEnvironment } from './helpers/test-data-manager';

// テスト環境のセットアップ
const { organizationId, accounts, periodId } = await setupTestEnvironment('admin');

// テスト後のクリーンアップ
await cleanupTestEnvironment(organizationId);
```

### 7. トラブルシューティング

#### 問題: 認証エラーが発生する

**解決策:**

1. 環境変数が正しく設定されているか確認
2. Supabaseプロジェクトが稼働しているか確認
3. Service Role Keyが正しいか確認

```bash
# 環境変数の確認
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY
```

#### 問題: テストユーザーが作成できない

**解決策:**

1. Service Role Keyに管理者権限があるか確認
2. Supabase Authの設定を確認（メール確認をオフにする）

```sql
-- Supabase SQL Editorで実行
SELECT * FROM auth.users WHERE email LIKE '%test%';
```

#### 問題: RLSポリシーでアクセスが拒否される

**解決策:**

1. RLSポリシーが正しく設定されているか確認
2. テスト用のより緩いポリシーを設定

```sql
-- デバッグ用：一時的にRLSを無効化（テスト環境のみ）
ALTER TABLE your_table DISABLE ROW LEVEL SECURITY;
```

#### 問題: CI/CDでテストが失敗する

**解決策:**

1. GitHub Secretsが正しく設定されているか確認
2. ワークフローファイルの環境変数を確認
3. Supabaseプロジェクトの稼働状態を確認

### 8. ベストプラクティス

#### 8.1 テストの独立性

- 各テストは他のテストに依存しない
- テストごとに新しいデータを作成
- テスト後は必ずクリーンアップ

#### 8.2 データの予測可能性

- 固定IDを使用（タイムスタンプ付き）
- テストデータは明示的に作成
- ランダムデータは避ける

#### 8.3 パフォーマンス

- 並列実行可能なテストは並列化
- 不要なウェイトは避ける
- データベース接続をプール化

#### 8.4 セキュリティ

- テスト環境と本番環境を完全に分離
- Service Role Keyは環境変数で管理
- テストユーザーのパスワードは強固に

### 9. 参考資料

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Playwright Testing Library](https://playwright.dev/docs/intro)
- [Next.js Testing Documentation](https://nextjs.org/docs/testing)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)

## まとめ

このセットアップにより、実際のSupabase認証を使用した信頼性の高いE2Eテストが実行可能になります。テスト専用環境を使用することで、本番環境に影響を与えることなく、実際の動作を確認できます。

定期的にテスト環境のデータをクリーンアップし、テストの独立性と再現性を維持することが重要です。
