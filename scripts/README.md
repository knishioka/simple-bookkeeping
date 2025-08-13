# Scripts Documentation

## 概要

このディレクトリには、Simple Bookkeepingプロジェクトの開発・運用を支援する各種スクリプトが含まれています。
各スクリプトは特定の目的を持ち、開発フローの自動化と効率化を実現します。

## 📁 ディレクトリ構造

```
scripts/
├── db/                     # データベース関連SQLスクリプト
│   └── sql/               # SQLファイル
├── lib/                   # 共通ライブラリ
│   └── config.sh         # 共通設定
├── *.sh                   # シェルスクリプト
├── *.js                   # Node.jsスクリプト
└── *.ts                   # TypeScriptスクリプト
```

## 🚀 スクリプト一覧

### デプロイメント監視

| スクリプト             | 用途                                                | 使用例                             |
| ---------------------- | --------------------------------------------------- | ---------------------------------- |
| `check-deployments.sh` | Vercel/Renderの両プラットフォームのデプロイ状態確認 | `./scripts/check-deployments.sh`   |
| `render-logs.sh`       | Renderサービスのログ取得（runtime/build/errors）    | `./scripts/render-logs.sh runtime` |
| `vercel-logs.sh`       | Vercelデプロイメントのログ取得                      | `./scripts/vercel-logs.sh build`   |
| `render-api-status.sh` | Render APIを使用したサービス状態確認                | `./scripts/render-api-status.sh`   |
| `vercel-api-status.sh` | Vercel APIを使用したデプロイメント状態確認          | `./scripts/vercel-api-status.sh`   |

### データベース管理

| スクリプト             | 用途                                                                   | 使用例                           |
| ---------------------- | ---------------------------------------------------------------------- | -------------------------------- |
| `init-db.sh`           | ローカルDBの初期化（Prismaクライアント生成、マイグレーション、シード） | `./scripts/init-db.sh`           |
| `migrate-render-db.sh` | Render環境のDBマイグレーション実行                                     | `./scripts/migrate-render-db.sh` |
| `seed-render-db.sh`    | Render環境のDBへのシードデータ投入                                     | `./scripts/seed-render-db.sh`    |

### ビルド・品質チェック

| スクリプト            | 用途                                                      | 使用例                          |
| --------------------- | --------------------------------------------------------- | ------------------------------- |
| `check-full-build.sh` | Vercel/Render両方の完全ビルドチェック（pre-pushフック用） | `./scripts/check-full-build.sh` |
| `check-build.sh`      | ビルド可能性の確認                                        | `./scripts/check-build.sh`      |

### 開発環境セットアップ

| スクリプト       | 用途                               | 使用例                        |
| ---------------- | ---------------------------------- | ----------------------------- |
| `setup-local.sh` | ローカル開発環境の初期セットアップ | `./scripts/setup-local.sh`    |
| `start-dev.sh`   | 開発サーバーの起動                 | `./scripts/start-dev.sh`      |
| `check-ports.js` | 使用ポートの確認（3000/3001）      | `node scripts/check-ports.js` |

### テスト関連

| スクリプト            | 用途                   | 使用例                             |
| --------------------- | ---------------------- | ---------------------------------- |
| `e2e-test.sh`         | E2Eテストの実行        | `./scripts/e2e-test.sh`            |
| `e2e-basic-test.js`   | 基本的なE2Eテスト実行  | `node scripts/e2e-basic-test.js`   |
| `create-test-user.js` | テスト用ユーザーの作成 | `node scripts/create-test-user.js` |

### 環境設定

| スクリプト          | 用途                     | 使用例                        |
| ------------------- | ------------------------ | ----------------------------- |
| `validate-env.ts`   | 環境変数の妥当性検証     | `tsx scripts/validate-env.ts` |
| `render-env-set.sh` | Render環境の環境変数設定 | `./scripts/render-env-set.sh` |

### その他のユーティリティ

| スクリプト               | 用途                                 | 使用例                             |
| ------------------------ | ------------------------------------ | ---------------------------------- |
| `update-to-singapore.sh` | Renderリージョンをシンガポールに更新 | `./scripts/update-to-singapore.sh` |

## 🔧 環境変数

各スクリプトで必要な環境変数：

| 環境変数         | 説明                               | 必須スクリプト           |
| ---------------- | ---------------------------------- | ------------------------ |
| `DATABASE_URL`   | PostgreSQL接続文字列               | DB関連スクリプト全般     |
| `RENDER_API_KEY` | Render APIアクセスキー             | `render-*.sh`            |
| `VERCEL_TOKEN`   | Vercel認証トークン                 | `vercel-*.sh`            |
| `NODE_ENV`       | 実行環境（development/production） | ビルド・テストスクリプト |

### 環境変数の設定方法

```bash
# .env.localファイルに記載
RENDER_API_KEY=rnd_xxxxxxxxxxxx
VERCEL_TOKEN=xxxxxxxxxxxx
DATABASE_URL=postgresql://user:password@localhost:5432/simple_bookkeeping

# または環境変数として直接設定
export RENDER_API_KEY=rnd_xxxxxxxxxxxx
```

## 📝 使用例

### デプロイメント状態の確認

```bash
# 両プラットフォームの状態を一度に確認
./scripts/check-deployments.sh

# Renderのランタイムログを確認
./scripts/render-logs.sh runtime

# Vercelのビルドログを確認
./scripts/vercel-logs.sh build
```

### データベースの初期化

```bash
# ローカル環境のDB初期化
./scripts/init-db.sh

# Render環境のDBマイグレーション
./scripts/migrate-render-db.sh
```

### ビルドチェック

```bash
# push前の完全ビルドチェック
./scripts/check-full-build.sh

# 簡易ビルドチェック
./scripts/check-build.sh
```

## 🏗️ SQLスクリプト（db/sql/）

| ファイル                   | 用途                           |
| -------------------------- | ------------------------------ |
| `check-render-db.sql`      | Render DBの接続確認用SQL       |
| `fix-failed-migration.sql` | 失敗したマイグレーションの修復 |
| `init-render-db.sql`       | Render DBの初期化              |
| `insert-accounts.sql`      | 勘定科目マスタデータの挿入     |
| `reset-render-db.sql`      | Render DBのリセット（開発用）  |

## ⚠️ 注意事項

### セキュリティ

- APIキーやトークンは絶対にコミットしない
- 環境変数は`.env.local`または環境変数として管理
- 本番環境での実行時は特に注意

### 実行権限

```bash
# スクリプトに実行権限を付与
chmod +x scripts/*.sh
```

### エラーハンドリング

- 全てのシェルスクリプトは`set -e`で即座にエラー終了
- 適切なエラーメッセージとステータスコードを返す
- ログ出力で問題の特定を容易に

## 🔄 メンテナンス

### 新規スクリプト追加時

1. スクリプトファイルを作成
2. ヘッダーコメントで目的・使用方法を明記
3. このREADMEに追加
4. 実行権限を付与
5. 必要に応じてpackage.jsonにnpmスクリプトを追加

### 既存スクリプトの更新時

1. 変更内容をコミットメッセージに明記
2. 破壊的変更の場合は影響範囲を確認
3. READMEの該当箇所を更新

## 📚 関連ドキュメント

- [npm scripts guide](../docs/npm-scripts-guide.md) - npmスクリプトの詳細
- [Deployment guide](../docs/deployment/) - デプロイメント手順
- [Environment variables](../docs/ENVIRONMENT_VARIABLES.md) - 環境変数の詳細
- [Docker setup](../docs/docker-setup.md) - Docker環境構築

## 🆘 トラブルシューティング

### よくある問題

#### スクリプトが実行できない

```bash
# 実行権限を付与
chmod +x scripts/script-name.sh
```

#### 環境変数が認識されない

```bash
# 環境変数を確認
echo $RENDER_API_KEY

# .env.localから読み込み
source .env.local
```

#### ポートが使用中

```bash
# ポートを使用しているプロセスを確認
lsof -i :3000
lsof -i :3001

# プロセスを終了
kill -9 <PID>
```

詳細は[トラブルシューティングガイド](../docs/deployment/troubleshooting.md)を参照してください。
