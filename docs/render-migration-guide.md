# Render.com 移行ガイド

## 📋 移行概要

このドキュメントでは、Simple BookkeepingプロジェクトをRender.comにデプロイする手順を説明します。

### システム構成

- **フロントエンド**: Vercel（変更なし）
- **APIサーバー**: Render.com Web Service
- **データベース**: Render.com PostgreSQL

## 🚀 移行手順

### 1. 事前準備

#### Renderアカウント作成

1. [Render.com](https://render.com) でアカウント作成
2. GitHubアカウントと連携

#### Render CLI インストール（完了済み）

```bash
curl -fsSL https://raw.githubusercontent.com/render-oss/cli/refs/heads/main/bin/install.sh | sh
render login
```

### 2. GitHubリポジトリの準備

#### コミット前の確認

```bash
# 不要ファイルが削除されていることを確認
git status

# コミット
git add .
git commit -m "feat: Render.com対応 - 不要ファイル削除と設定追加"
git push origin main
```

### 3. Renderでのプロジェクト作成

#### 方法1: Render Dashboard（推奨）

1. [Render Dashboard](https://dashboard.render.com) にアクセス
2. "New +" → "Blueprint" をクリック
3. GitHubリポジトリを選択
4. `render.yaml` が自動的に検出される

#### 方法2: Render CLI

```bash
# 非対話モードで実行
render blueprint launch -o json
```

### 4. 環境変数の設定

Render Dashboardで以下の環境変数を確認・設定：

| 変数名                 | 値                                                           | 説明                         |
| ---------------------- | ------------------------------------------------------------ | ---------------------------- |
| NODE_ENV               | production                                                   | 実行環境                     |
| DATABASE_URL           | （自動設定）                                                 | PostgreSQL接続文字列         |
| JWT_SECRET             | （自動生成）                                                 | JWT署名用シークレット        |
| JWT_REFRESH_SECRET     | （自動生成）                                                 | リフレッシュトークン用       |
| JWT_EXPIRES_IN         | 7d                                                           | アクセストークン有効期限     |
| JWT_REFRESH_EXPIRES_IN | 30d                                                          | リフレッシュトークン有効期限 |
| CORS_ORIGIN            | https://simple-bookkeeping-kens-projects-924cd1a9.vercel.app | Vercel URL                   |

### 5. データベースマイグレーション

#### 初回デプロイ後に実行

```bash
# Render CLIでデータベースに接続
render db shell simple-bookkeeping-db

# または、Render DashboardのShellから実行
cd packages/database
pnpm prisma migrate deploy
pnpm prisma db seed
```

### 6. Vercel環境変数の更新

デプロイ完了後、RenderのAPIサーバーURLを取得してVercelに設定：

```bash
# 既存のAPI_URL削除
vercel env rm API_URL

# 新しいAPI_URLを設定（例）
echo "https://simple-bookkeeping-api.onrender.com" | vercel env add API_URL production
echo "https://simple-bookkeeping-api.onrender.com" | vercel env add API_URL preview
```

### 7. 動作確認

1. **APIヘルスチェック**

   ```bash
   curl https://simple-bookkeeping-api.onrender.com/api/v1/health
   ```

2. **フロントエンドアクセス**

   - https://simple-bookkeeping-kens-projects-924cd1a9.vercel.app
   - ログイン画面でテストユーザーでログイン

3. **テストユーザー情報**
   - Email: `test@example.com`
   - Password: `Test1234!`

## 🔧 トラブルシューティング

### ビルドエラー

- `render logs` コマンドでログ確認
- Node.jsバージョンの確認（18.x推奨）

### データベース接続エラー

- DATABASE_URL環境変数の確認
- Renderダッシュボードでデータベースステータス確認

### CORS エラー

- CORS_ORIGIN環境変数がVercelのURLと一致しているか確認
- APIサーバーのCORS設定を確認

## 📝 メンテナンス

### ログ確認

```bash
# デプロイメントログ
render logs --service simple-bookkeeping-api

# データベースログ
render logs --service simple-bookkeeping-db
```

### スケーリング

- Render Dashboardから手動でインスタンス数を調整
- または`render.yaml`を更新してgit push

### バックアップ

- Render PostgreSQLは自動バックアップ（有料プラン）
- 手動バックアップ: `pg_dump`コマンドを使用

## 🚨 重要な注意事項

1. **無料プラン制限**

   - 15分間アクセスがないとスリープ（初回アクセス時に起動遅延）
   - PostgreSQL 無料プランは90日後に削除される可能性

2. **本番運用時**
   - 有料プランへのアップグレードを検討
   - カスタムドメインの設定
   - 自動スケーリングの設定

## 📚 参考リンク

- [Render Documentation](https://render.com/docs)
- [Render CLI Documentation](https://render.com/docs/cli)
- [Render Blueprint Specification](https://render.com/docs/blueprint-spec)
