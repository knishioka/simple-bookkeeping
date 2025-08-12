# Scripts Reference Guide

このドキュメントは、Simple Bookkeepingプロジェクトの全スクリプトの用途と使用方法をまとめたリファレンスガイドです。

## 📁 ディレクトリ構造

```
scripts/
├── db/
│   └── sql/           # SQL関連ファイル
├── lib/               # 共有ライブラリ
└── [各種スクリプト]    # 用途別スクリプト
```

## 🏗️ ビルド・検証スクリプト

### check-build.sh

- **用途**: Pre-commit時の軽量TypeScript型チェック
- **実行方法**: `pnpm precommit:check` または Gitのpre-commitフックで自動実行
- **特徴**: 変更されたパッケージのみチェックするため高速
- **使用場面**: コミット前の簡易チェック

### check-full-build.sh

- **用途**: Pre-push時の完全ビルドチェック（Vercel・Render両方）
- **実行方法**: `pnpm prepush:check` または Gitのpre-pushフックで自動実行
- **特徴**: 本番環境と同じビルド設定で検証
- **使用場面**: pushやデプロイ前の包括的検証

## 🚀 デプロイメント管理スクリプト

### check-deployments.sh

- **用途**: Render（API）とVercel（Web）の両プラットフォームのデプロイ状況確認
- **実行方法**: `pnpm deploy:check`
- **必要環境変数**: `RENDER_API_KEY`, `VERCEL_TOKEN`
- **出力**: 各プラットフォームの最新デプロイメント状態、ビルド状況、健全性

### render-api-status.sh

- **用途**: Render APIを使用した詳細なサービス状態監視
- **実行方法**: `pnpm render:status`
- **必要環境変数**: `RENDER_API_KEY`
- **機能**:
  - サービス詳細情報
  - 最近のデプロイメント履歴
  - ヘルスチェック状態
  - デプロイメント統計

### vercel-api-status.sh

- **用途**: Vercel APIを使用した詳細なデプロイメント状態監視
- **実行方法**: `pnpm vercel:status`
- **必要環境変数**: `VERCEL_TOKEN`または Vercel CLI認証
- **機能**:
  - デプロイメント履歴
  - ビルド状態
  - プロジェクト統計
  - エラー情報

### render-logs.sh

- **用途**: Renderのログ取得・管理
- **実行方法**: `pnpm render:logs <command> [options]`
- **コマンド**:
  - `runtime`: ランタイムログ
  - `build`: ビルドログ
  - `errors`: エラーログのみ
  - `stream`: リアルタイムストリーミング
  - `search <term>`: ログ検索
  - `stats`: ログ統計
- **例**: `pnpm render:logs errors --lines 50`

### vercel-logs.sh

- **用途**: Vercelのログ取得・管理
- **実行方法**: `pnpm vercel:logs <command> [options]`
- **コマンド**:
  - `runtime`: ランタイムログ
  - `build`: ビルドログ
  - `function`: Function実行ログ
  - `errors`: エラーログのみ
  - `stream`: リアルタイムストリーミング
  - `deployment <url>`: 特定デプロイメントのログ
- **例**: `pnpm vercel:logs build --lines 100`

## 🗄️ データベース管理スクリプト

### init-db.sh

- **用途**: データベースの完全初期化（Prisma生成、マイグレーション、シード）
- **実行方法**: `pnpm db:init`
- **処理内容**:
  1. Prismaクライアント生成
  2. マイグレーション実行
  3. シードデータ投入
- **使用場面**: 新規環境セットアップ、開発環境リセット

### migrate-render-db.sh

- **用途**: Render環境向けのデータベースマイグレーション
- **実行方法**: 手動実行
- **特徴**: Render固有の環境変数を使用

### seed-render-db.sh

- **用途**: Render環境のデータベースへのシードデータ投入
- **実行方法**: 手動実行
- **特徴**: 本番環境向けの初期データセットアップ

### db/sql/ディレクトリ

SQLファイルが整理されています：

- `check-render-db.sql`: DB健全性チェッククエリ
- `fix-failed-migration.sql`: マイグレーション失敗時の修復
- `init-render-db.sql`: Render DB初期化
- `insert-accounts.sql`: 勘定科目データ
- `reset-render-db.sql`: DBリセット用

## 🧪 開発・テストスクリプト

### start-dev.sh

- **用途**: Web・API両方の開発サーバー起動
- **実行方法**: `pnpm dev` または直接実行
- **機能**:
  - ポート競合チェック
  - 並列サーバー起動
  - グレースフルシャットダウン
- **必要設定**: `.env`ファイル（WEB_PORT, API_PORT）

### e2e-test.sh

- **用途**: Docker環境での隔離されたE2Eテスト実行
- **実行方法**: `pnpm test:e2e [options]`
- **オプション**:
  - `--headless`: ヘッドレスモード（デフォルト）
  - `--browser <name>`: ブラウザ指定
  - `--test <pattern>`: テストファイルパターン
- **例**: `pnpm test:e2e --browser chromium --test auth`

### e2e-basic-test.js

- **用途**: 軽量E2Eテストスクリプト
- **実行方法**: 直接Node.jsで実行
- **特徴**: 基本的な機能の簡易チェック

### check-ports.js

- **用途**: ポート競合検出ユーティリティ
- **実行方法**: `pnpm dev:ports`
- **チェック対象**: 3000（Web）、3001（API）ポート

### create-test-user.js

- **用途**: テスト用ユーザー作成
- **実行方法**: 直接Node.jsで実行
- **使用場面**: E2Eテスト環境のセットアップ

## 🔧 環境・設定スクリプト

### validate-env.ts

- **用途**: 環境変数の包括的検証
- **実行方法**:
  - `pnpm env:validate` - 基本検証
  - `pnpm env:validate:api` - API環境検証
  - `pnpm env:validate:web` - Web環境検証
  - `pnpm env:validate:strict` - 厳格モード検証
- **特徴**: TypeScript実装、型安全な環境変数チェック

### setup-local.sh

- **用途**: ローカル開発環境の初期セットアップ
- **実行方法**: 手動実行（新規開発者向け）
- **処理内容**: 依存関係インストール、環境変数設定、DB初期化

### render-env-set.sh

- **用途**: Render環境変数の一括設定
- **実行方法**: 手動実行
- **必要条件**: Render CLIのインストールと認証

### update-to-singapore.sh

- **用途**: Renderリージョン移行（シンガポール）
- **実行方法**: 手動実行（一度きりのマイグレーション）

## 📚 共有ライブラリ

### lib/config.sh

- **用途**: スクリプト間で共有される設定・ユーティリティ関数
- **内容**:
  - カラー出力定義
  - 共通エラーハンドリング
  - 環境変数読み込み

## 📋 package.jsonとの連携

以下のスクリプトはpackage.jsonから直接実行可能です：

| npmスクリプト     | 実行されるスクリプト   | 説明               |
| ----------------- | ---------------------- | ------------------ |
| `dev`             | `start-dev.sh`         | 開発サーバー起動   |
| `dev:ports`       | `check-ports.js`       | ポートチェック     |
| `db:init`         | `init-db.sh`           | DB初期化           |
| `test:e2e`        | `e2e-test.sh`          | E2Eテスト          |
| `env:validate`    | `validate-env.ts`      | 環境変数検証       |
| `deploy:check`    | `check-deployments.sh` | デプロイ状況確認   |
| `render:status`   | `render-api-status.sh` | Render状態確認     |
| `render:logs`     | `render-logs.sh`       | Renderログ取得     |
| `vercel:status`   | `vercel-api-status.sh` | Vercel状態確認     |
| `vercel:logs`     | `vercel-logs.sh`       | Vercelログ取得     |
| `precommit:check` | `check-build.sh`       | コミット前チェック |
| `prepush:check`   | `check-full-build.sh`  | プッシュ前チェック |

## 🔄 Git Hooksとの連携

### pre-commit hook

- `scripts/check-build.sh`を実行
- 変更されたTypeScriptファイルの型チェック

### pre-push hook

- protected branches（main/master/production）へのpush時:
  - セキュリティ監査
  - `scripts/check-full-build.sh`を実行（完全ビルドチェック）

## 💡 使用例

### 新規開発環境のセットアップ

```bash
# 1. リポジトリをクローン
git clone [repository-url]
cd simple-bookkeeping

# 2. 環境セットアップ
./scripts/setup-local.sh

# 3. 環境変数検証
pnpm env:validate

# 4. データベース初期化
pnpm db:init

# 5. 開発サーバー起動
pnpm dev
```

### デプロイ前の確認

```bash
# 1. 完全ビルドチェック
pnpm prepush:check

# 2. 環境変数の厳格検証
pnpm env:validate:strict

# 3. 現在のデプロイ状況確認
pnpm deploy:check
```

### トラブルシューティング

```bash
# エラーログの確認
pnpm render:logs errors --lines 100
pnpm vercel:logs errors --lines 100

# リアルタイムログ監視
pnpm render:logs stream
pnpm vercel:logs stream

# デプロイメント状態の詳細確認
pnpm render:status
pnpm vercel:status
```

## 🔐 必要な環境変数

多くのデプロイメント管理スクリプトは以下の環境変数が必要です：

- `RENDER_API_KEY`: Render APIアクセス用
- `VERCEL_TOKEN`: Vercel APIアクセス用
- `DATABASE_URL`: データベース接続URL
- `NODE_ENV`: 環境指定（development/production）

詳細は`.env.example`を参照してください。

## 📝 注意事項

1. **スクリプトの実行権限**: 必要に応じて`chmod +x scripts/*.sh`で実行権限を付与
2. **環境依存**: 一部のスクリプトは特定の環境（Docker、Node.js等）が必要
3. **API制限**: 外部APIを使用するスクリプトはレート制限に注意
4. **セキュリティ**: 環境変数やAPIキーは適切に管理すること

## 🆘 サポート

スクリプトに関する質問や問題は、GitHubのIssueで報告してください。
