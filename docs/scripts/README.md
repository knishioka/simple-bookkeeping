# 📜 Scripts Documentation

このディレクトリには、Simple Bookkeepingプロジェクトのスクリプトに関する包括的なドキュメントが含まれています。

## 📁 ディレクトリ構造

```
scripts/
├── db/
│   └── sql/           # SQL関連ファイル
├── lib/               # 共有ライブラリ
│   └── config.sh      # 共通設定
├── *.sh               # シェルスクリプト
├── *.js               # Node.jsスクリプト
└── *.ts               # TypeScriptスクリプト
```

## 🚀 クイックリファレンス

### よく使うコマンド

```bash
# 開発環境
pnpm dev                # Web・API両方の開発サーバー起動
pnpm db:init            # データベース初期化

# デプロイメント監視
pnpm deploy:check       # デプロイメント状態確認
pnpm logs:prod          # 本番ログ確認（ビルド/ランタイム）

# 品質チェック
pnpm precommit:check    # コミット前の軽量チェック
pnpm prepush:check      # プッシュ前の完全チェック
pnpm env:validate       # 環境変数検証
```

## 📋 スクリプト詳細リファレンス

### 🏗️ ビルド・検証スクリプト

#### check-build.sh

- **用途**: Pre-commit時の軽量TypeScript型チェック
- **実行方法**: `pnpm precommit:check` または Gitのpre-commitフックで自動実行
- **特徴**: 変更されたパッケージのみチェックするため高速
- **使用場面**: コミット前の簡易チェック

#### check-full-build.sh

- **用途**: Pre-push時の完全ビルドチェック
- **実行方法**: `pnpm prepush:check` または Gitのpre-pushフックで自動実行
- **特徴**: 本番環境と同じビルド設定で検証
- **使用場面**: pushやデプロイ前の包括的検証

### 🚀 デプロイメント管理スクリプト

#### check-deployments.sh

- **用途**: Vercel（Web）のデプロイ状況確認
- **実行方法**: `pnpm deploy:check`
- **必要環境変数**: `VERCEL_TOKEN`
- **出力**: 最新デプロイメント状態、ビルド状況、健全性

#### vercel-tools.sh

- **用途**: Vercel CLI のラッパー。ステータス確認やログ取得などを一元管理
- **実行方法**:
  - `pnpm vercel:status` → `./scripts/vercel-tools.sh status`
  - `pnpm vercel:logs runtime` → `./scripts/vercel-tools.sh logs runtime`
  - `pnpm vercel:deployments` → `./scripts/vercel-tools.sh deployments`
  - `pnpm vercel:api` → `./scripts/vercel-tools.sh api-status`
- **必要環境変数**: `.env.local` 経由で読み込まれる Vercel プロジェクト情報（`VERCEL_PROJECT_NAME`, `VERCEL_PRODUCTION_URL` など）

#### logs:prod

- **用途**: 本番環境（Vercel）の最新ログをワンコマンドで取得
- **実行方法**: `pnpm logs:prod`
- **仕組み**: `.env.local` から `VERCEL_PRODUCTION_URL` を読み込み、`vercel logs` を実行
- **例**: `pnpm logs:prod | grep ERROR`

### 🗄️ データベース管理スクリプト

#### init-db.sh

- **用途**: データベースの完全初期化（Prisma生成、マイグレーション、シード）
- **実行方法**: `pnpm db:init`
- **処理内容**:
  1. Prismaクライアント生成
  2. マイグレーション実行
  3. シードデータ投入
- **使用場面**: 新規環境セットアップ、開発環境リセット

#### db/sql/ ディレクトリ

SQLファイルが整理されています：

- `fix-failed-migration.sql`: マイグレーション失敗時の修復
- `insert-accounts.sql`: 勘定科目データ

### 🧪 開発・テストスクリプト

#### start-dev.sh

- **用途**: Web・API両方の開発サーバー起動
- **実行方法**: `pnpm dev` または直接実行
- **機能**:
  - ポート競合チェック
  - 並列サーバー起動
  - グレースフルシャットダウン
- **必要設定**: `env/secrets/common.env`（`WEB_PORT`, `API_PORT` など）

#### test-runner.sh（E2Eユーティリティ）

- **用途**: E2E テストの実行モードを一元管理
- **実行方法**:
  - ローカル: `./scripts/test-runner.sh e2e [options]`
  - Docker: `./scripts/test-runner.sh e2e-docker [options]`
- **主なオプション**:
  - `--headless`: ヘッドレスモード（デフォルト）
  - `--browser <name>`: ブラウザ指定
  - `--test <pattern>`: テストファイルパターン
- **例**: `./scripts/test-runner.sh e2e --browser chromium --test auth`

#### e2e-basic-test.js

- **用途**: 軽量E2Eテストスクリプト
- **実行方法**: 直接Node.jsで実行
- **特徴**: 基本的な機能の簡易チェック

#### check-ports.js / check-ports.sh

- **用途**: ポート競合検出ユーティリティ
- **実行方法**: `pnpm dev:ports`
- **チェック対象**: 3000（Web）、3001（API）ポート

#### create-test-user.js

- **用途**: テスト用ユーザー作成
- **実行方法**: 直接Node.jsで実行
- **使用場面**: E2Eテスト環境のセットアップ

### 🔧 環境・設定スクリプト

#### validate-env.ts

- **用途**: 環境変数の包括的検証
- **実行方法**:
  - `pnpm env:validate` - 基本検証
  - `pnpm env:validate:api` - API環境検証
  - `pnpm env:validate:web` - Web環境検証
  - `pnpm env:validate:strict` - 厳格モード検証
- **特徴**: TypeScript実装、型安全な環境変数チェック

#### setup-local.sh

- **用途**: ローカル開発環境の初期セットアップ
- **実行方法**: 手動実行（新規開発者向け）
- **処理内容**: 依存関係インストール、環境変数設定、DB初期化

### 📚 共有ライブラリ

#### lib/config.sh

- **用途**: スクリプト間で共有される設定・ユーティリティ関数
- **内容**:
  - カラー出力定義
  - 共通エラーハンドリング
  - 環境変数読み込み

## 📋 package.jsonとの連携

以下のスクリプトはpackage.jsonから直接実行可能です：

| npmスクリプト     | 実行されるスクリプト         | 説明                |
| ----------------- | ---------------------------- | ------------------- |
| `dev`             | `start-dev.sh`               | 開発サーバー起動    |
| `dev:ports`       | `check-ports.js`             | ポートチェック      |
| `db:init`         | `init-db.sh`                 | DB初期化            |
| `test:e2e`        | `test-runner.sh e2e`         | E2Eテスト           |
| `test:e2e:docker` | `test-runner.sh e2e-docker`  | DockerでのE2Eテスト |
| `env:validate`    | `validate-env.ts`            | 環境変数検証        |
| `deploy:check`    | `check-deployments.sh`       | デプロイ状況確認    |
| `vercel:status`   | `vercel-tools.sh`            | Vercel状態確認      |
| `vercel:logs`     | `vercel-tools.sh`            | Vercelログ取得      |
| `logs:prod`       | `vercel logs`（npmラッパー） | 本番ログ取得        |
| `precommit:check` | `check-build.sh`             | コミット前チェック  |
| `prepush:check`   | `check-full-build.sh`        | プッシュ前チェック  |

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
pnpm vercel:logs errors --lines 100

# リアルタイムログ監視
pnpm vercel:logs stream

# デプロイメント状態の詳細確認
pnpm vercel:status
```

## 🔐 必要な環境変数

多くのデプロイメント管理スクリプトは以下の環境変数が必要です：

- `VERCEL_TOKEN`: Vercel APIアクセス用
- `DATABASE_URL`: データベース接続URL
- `NODE_ENV`: 環境指定（development/production）
- `WEB_PORT`: Webサーバーポート（デフォルト: 3000）
- `API_PORT`: APIサーバーポート（デフォルト: 3001）

詳細は `env/README.md` を参照してください。

## 📝 注意事項

1. **スクリプトの実行権限**: 必要に応じて`chmod +x scripts/*.sh`で実行権限を付与
2. **環境依存**: 一部のスクリプトは特定の環境（Docker、Node.js等）が必要
3. **API制限**: 外部APIを使用するスクリプトはレート制限に注意
4. **セキュリティ**: 環境変数やAPIキーは適切に管理すること
5. **プラットフォーム**: 一部のスクリプトはmacOS/Linux環境を前提としています

## 🆘 サポート

スクリプトに関する質問や問題は、GitHubのIssueで報告してください。
