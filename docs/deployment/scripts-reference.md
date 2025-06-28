# デプロイメントスクリプトリファレンス

このドキュメントでは、プロジェクトで使用可能なデプロイメント関連スクリプトについて説明します。

## スクリプト一覧

### 状態確認スクリプト

#### `render-api-status.sh`

Render APIを使用してデプロイメントステータスを確認します。

```bash
./scripts/render-api-status.sh
```

**必要な環境変数**: `RENDER_API_KEY`

**機能**:

- 最新のデプロイメント状態
- サービス情報
- ヘルスチェック
- デプロイメント統計

#### `vercel-api-status.sh`

Vercel APIを使用してデプロイメントステータスを確認します。

```bash
./scripts/vercel-api-status.sh
```

**必要な環境変数**: `VERCEL_TOKEN`

**機能**:

- デプロイメント一覧
- Production/Preview の状態
- ビルド状況
- ヘルスチェック

#### `check-deployments.sh`

RenderとVercel両方のデプロイメント状態を確認します。

```bash
./scripts/check-deployments.sh
```

### ログ取得スクリプト

#### `render-logs.sh`

Renderのログを取得・表示します。

```bash
# 使用方法
./scripts/render-logs.sh [mode] [options]

# モード
runtime  - ランタイムログ（デフォルト）
build    - ビルドログ
errors   - エラーログのみ
stream   - リアルタイムストリーミング
search   - キーワード検索
stats    - ログ統計

# 例
./scripts/render-logs.sh runtime --limit 50
./scripts/render-logs.sh search "error" --since 1h
./scripts/render-logs.sh stream
```

#### `vercel-logs.sh`

Vercelのログを取得・表示します。

```bash
# 使用方法
./scripts/vercel-logs.sh [type]

# タイプ
build    - ビルドログ（デフォルト）
runtime  - ランタイムログ
all      - すべてのログ

# 例
./scripts/vercel-logs.sh build
./scripts/vercel-logs.sh runtime
```

### データベース関連スクリプト

#### `init-db.sh`

データベースの初期化とマイグレーションを実行します。

```bash
./scripts/init-db.sh
```

**機能**:

- Prismaクライアント生成
- マイグレーション実行
- 初期データ投入（seed）

#### `insert-accounts.sql`

標準勘定科目（207個）をデータベースに挿入するSQLスクリプト。

```bash
# Renderデータベースに直接実行
psql $DATABASE_URL < scripts/insert-accounts.sql
```

### ユーティリティスクリプト

#### `load-config.sh`

設定ファイルまたは環境変数から値を読み込みます。

```bash
source scripts/load-config.sh

# 使用例
SERVICE_ID=$(get_config "render.services.api.id" "RENDER_API_SERVICE_ID")
```

## 環境変数

### 必須の環境変数

```bash
# Render API アクセス用
RENDER_API_KEY=rnd_xxxxxxxxxxxxxxxxxxxx

# Vercel API アクセス用
VERCEL_TOKEN=xxxxxxxxxxxxxxxxxxxx

# データベース接続
DATABASE_URL=postgresql://user:pass@host/db
```

### オプションの環境変数

```bash
# カスタム設定ファイルパス
RENDER_SERVICES_CONFIG=.render/services.json
VERCEL_PROJECT_CONFIG=.vercel/project.json

# ログ取得の設定
LOG_LIMIT=100
LOG_FORMAT=json
```

## 設定ファイル

### `.render/services.json`

Renderサービスの設定を保存します。

```json
{
  "services": {
    "api": {
      "id": "srv-xxxxx",
      "name": "simple-bookkeeping-api",
      "type": "web",
      "url": "https://simple-bookkeeping-api.onrender.com"
    }
  },
  "databases": {
    "postgres": {
      "id": "dpg-xxxxx",
      "name": "simple-bookkeeping-db"
    }
  }
}
```

## トラブルシューティング

### スクリプトが実行できない

```bash
# 実行権限を付与
chmod +x scripts/*.sh
```

### 環境変数が見つからない

```bash
# direnvを使用している場合
direnv allow

# または直接エクスポート
export RENDER_API_KEY="your-key"
export VERCEL_TOKEN="your-token"
```

### APIレート制限

- Render API: 100リクエスト/分
- Vercel API: 使用プランによる

レート制限に達した場合は、時間をおいて再実行してください。

## ベストプラクティス

1. **環境変数の管理**
   - `.env.local`に機密情報を保存
   - direnvを使用して自動読み込み

2. **定期的な確認**
   - デプロイ後は必ずステータスを確認
   - エラーログを定期的にチェック

3. **スクリプトの組み合わせ**

   ```bash
   # デプロイ後の確認フロー
   ./scripts/check-deployments.sh
   ./scripts/render-logs.sh errors --since 10m
   ./scripts/vercel-logs.sh runtime
   ```

4. **自動化**
   - CI/CDパイプラインにスクリプトを組み込み
   - デプロイ後の自動ヘルスチェック
