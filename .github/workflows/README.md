# GitHub Actions Workflows

## 概要

このプロジェクトでは、コード品質の維持と自動テストのために複数のGitHub Actionsワークフローを使用しています。

## ワークフロー一覧

### 1. CI (`ci.yml`)

メインのCIパイプライン。以下のジョブを実行：

- **Lint**: ESLintとPrettierによるコード品質チェック
- **Type Check**: TypeScriptの型チェック
- **Test**: 単体テストの実行
- **Build**: アプリケーションのビルド

### 2. E2E Tests (`e2e-tests.yml`)

End-to-Endテストの実行：

- PostgreSQLデータベースの起動
- アプリケーションのビルドと起動
- Playwrightによる自動化テストの実行
- テスト結果とパフォーマンスレポートの保存

## 環境変数

### 必須環境変数（Secrets）

以下の環境変数をGitHubリポジトリのSecretsに設定してください：

#### Supabase関連

- `NEXT_PUBLIC_SUPABASE_URL`: SupabaseプロジェクトのURL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabaseの匿名キー

#### テスト認証情報（オプション）

- `TEST_JWT_SECRET`: テスト用JWTシークレット
- `TEST_ADMIN_EMAIL`: 管理者テストユーザーのメール
- `TEST_ADMIN_PASSWORD`: 管理者テストユーザーのパスワード
- `TEST_ACCOUNTANT_EMAIL`: 経理担当者テストユーザーのメール
- `TEST_ACCOUNTANT_PASSWORD`: 経理担当者テストユーザーのパスワード
- `TEST_VIEWER_EMAIL`: 閲覧者テストユーザーのメール
- `TEST_VIEWER_PASSWORD`: 閲覧者テストユーザーのパスワード

### フォールバック値

Supabase環境変数が設定されていない場合、CIはプレースホルダー値を使用してビルドを続行します：

```yaml
NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co'
NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder-key'
```

これにより、Supabaseプロジェクトがまだ作成されていない段階でもCIが正常に動作します。

## ローカルでのテスト実行

### CIテストの実行

```bash
# Lintチェック
pnpm lint:strict

# 型チェック
pnpm typecheck

# 単体テスト
pnpm test

# ビルド
pnpm build
```

### E2Eテストの実行

```bash
# データベースの起動（Docker必須）
docker-compose up -d postgres

# E2Eテスト実行
pnpm test:e2e
```

## トラブルシューティング

### ビルドエラー

Supabase関連のビルドエラーが発生した場合：

1. 環境変数を設定

   ```bash
   export NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   export NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

2. パッケージの再ビルド
   ```bash
   pnpm build:packages
   ```

### テストエラー

テストが失敗する場合：

1. データベースが起動していることを確認
2. 環境変数が正しく設定されていることを確認
3. `pnpm install`で依存関係を最新化

## パフォーマンス最適化

- ジョブは並列実行される
- キャッシュを活用して依存関係のインストールを高速化
- 必要最小限のブラウザのみインストール（Chromium）

## セキュリティ

- シークレットは環境変数として安全に管理
- テスト用の認証情報はGitHub Secretsに保存
- プレースホルダー値はビルド専用で、実行時には使用されない
