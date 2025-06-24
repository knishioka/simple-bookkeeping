# CLI vs API 比較ガイド

## 📋 概要

RenderとVercelの操作において、CLIとAPIそれぞれの特徴と使い分けについてまとめました。

## 🔄 Render

### CLI vs API 機能比較

| 機能                   | CLI                       | API                                     | 推奨 |
| ---------------------- | ------------------------- | --------------------------------------- | ---- |
| デプロイメント状態確認 | ✅ `render deploys list`  | ✅ GET `/v1/services/{id}/deploys`      | API  |
| サービス情報取得       | ✅ `render services list` | ✅ GET `/v1/services/{id}`              | API  |
| 環境変数管理           | ❌ 未対応                 | ✅ GET/PUT `/v1/services/{id}/env-vars` | API  |
| ログ取得               | ✅ `render logs`          | ✅ GET `/v1/logs`                       | API  |
| PostgreSQL接続         | ⚠️ 制限あり               | ❌ 直接psql使用                         | psql |
| デプロイトリガー       | ✅ `render deploy`        | ✅ POST `/v1/services/{id}/deploys`     | API  |

### 実装済みスクリプト

```bash
# CLI版（制限あり）
pnpm render:status          # render CLIを使用

# API版（推奨）
pnpm render:api-status      # Render APIを使用
pnpm render:env list        # 環境変数一覧
pnpm render:env set KEY VALUE  # 環境変数設定
```

### API利点

- 環境変数の管理が可能
- より詳細な情報取得
- プログラマティックな操作
- 認証がシンプル（APIキー）

## 🚀 Vercel

### CLI vs API 機能比較

| 機能               | CLI                 | API                                  | 推奨 |
| ------------------ | ------------------- | ------------------------------------ | ---- |
| デプロイメント一覧 | ✅ `vercel ls`      | ✅ GET `/v6/deployments`             | API  |
| デプロイメント詳細 | ✅ `vercel inspect` | ✅ GET `/v9/deployments/{id}`        | API  |
| 環境変数管理       | ✅ `vercel env`     | ✅ GET/POST `/v10/projects/{id}/env` | 両方 |
| ビルドログ         | ✅ `vercel logs`    | ✅ GET `/v3/deployments/{id}/events` | API  |
| ランタイムログ     | ✅ `vercel logs`    | ❌ 未対応                            | CLI  |
| プロジェクト情報   | ✅ `vercel project` | ✅ GET `/v9/projects/{id}`           | API  |

### 実装済みスクリプト

```bash
# CLI版
pnpm vercel:status          # vercel CLIを使用

# API版（推奨）
pnpm vercel:api-status      # Vercel APIを使用
pnpm vercel:env list        # 環境変数一覧
pnpm vercel:env set KEY VALUE production  # 環境変数設定
```

### API利点

- 詳細なフィルタリング可能
- バッチ処理が可能
- CI/CD統合が容易
- より多くのメタデータ取得

## 🔑 認証設定

### Render API

```bash
# APIキーを取得
# https://dashboard.render.com/u/settings

# 環境変数に設定
export RENDER_API_KEY="rnd_xxxxxxxxxxxxx"
```

### Vercel API

```bash
# トークンを取得
# https://vercel.com/account/tokens

# 環境変数に設定
export VERCEL_TOKEN="xxxxxxxxxxxxx"

# またはCLIの認証を利用（自動）
# ~/Library/Application Support/com.vercel.cli/auth.json
```

## 💡 使い分けガイドライン

### API推奨のケース

1. **自動化・CI/CD**
   - GitHub Actions
   - 定期的な状態チェック
   - バッチ処理

2. **詳細情報取得**
   - デプロイメント統計
   - 複数サービスの一括確認
   - カスタムレポート生成

3. **環境変数管理**
   - 一括更新
   - バックアップ・リストア
   - 環境間の同期

### CLI推奨のケース

1. **対話的操作**
   - ローカル開発
   - デバッグ
   - 一時的な確認

2. **特定機能**
   - Vercelのランタイムログ
   - 初期セットアップ（`vercel link`）
   - ローカルプレビュー（`vercel dev`）

## 📝 実装例

### デプロイメント監視（API版）

```bash
#!/bin/bash
# 両サービスの状態を一括確認

# Render
RENDER_STATUS=$(curl -s -H "Authorization: Bearer $RENDER_API_KEY" \
    "https://api.render.com/v1/services/$SERVICE_ID/deploys?limit=1" | \
    jq -r '.[0].status')

# Vercel
VERCEL_STATUS=$(curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
    "https://api.vercel.com/v6/deployments?projectId=$PROJECT_ID&limit=1" | \
    jq -r '.deployments[0].state')

echo "Render: $RENDER_STATUS"
echo "Vercel: $VERCEL_STATUS"
```

### 環境変数同期（API版）

```bash
# VercelからRenderに環境変数をコピー
pnpm vercel:env list | while read var; do
    KEY=$(echo $var | cut -d' ' -f1)
    VALUE=$(vercel env pull --yes | grep "^$KEY=" | cut -d'=' -f2-)
    pnpm render:env set "$KEY" "$VALUE"
done
```

## 🚨 注意事項

1. **APIレート制限**
   - Render: 明確な制限なし（良識的な使用）
   - Vercel: 100 requests/10 seconds

2. **セキュリティ**
   - APIキー/トークンは環境変数で管理
   - `.env.local`に保存（gitignore）
   - ログに出力しない

3. **エラーハンドリング**
   - 403: 認証エラー
   - 404: リソース不在
   - 429: レート制限
   - 500: サーバーエラー

## まとめ

- **Render**: APIの使用を推奨（CLIは機能制限あり）
- **Vercel**: 用途に応じてCLI/APIを使い分け
- **自動化**: 必ずAPIを使用
- **対話的操作**: CLIが便利
