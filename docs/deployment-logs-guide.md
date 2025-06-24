# デプロイメントログ取得ガイド

## 📋 概要

VercelとRenderのビルドログ・ランタイムログの取得方法と特徴をまとめました。

## 🔍 ログの種類と保存期間

### Render

| ログタイプ         | 保存期間          | 取得方法 | 用途                         |
| ------------------ | ----------------- | -------- | ---------------------------- |
| **ビルドログ**     | 30日（Free: 7日） | CLI/API  | デプロイ時のビルド過程       |
| **ランタイムログ** | 30日（Free: 7日） | CLI/API  | アプリケーション実行時のログ |
| **デプロイログ**   | 無期限            | CLI/API  | デプロイメントのステータス   |

### Vercel

| ログタイプ           | 保存期間 | 取得方法 | 用途                            |
| -------------------- | -------- | -------- | ------------------------------- |
| **ビルドログ**       | 無期限   | CLI/API  | デプロイ時のビルド出力          |
| **ランタイムログ**   | 1時間    | CLIのみ  | Function実行時のログ            |
| **Function呼び出し** | 7日      | CLI      | APIエンドポイントのアクセスログ |

## 🚀 ログ取得スクリプトの使い方

### Render ログ

```bash
# ランタイムログ（最新100件）
pnpm render:logs runtime

# ビルドログ（要API KEY）
export RENDER_API_KEY=rnd_xxxxx
pnpm render:logs build

# エラーログのみ
pnpm render:logs errors

# リアルタイムストリーミング
pnpm render:logs stream

# ログ検索
pnpm render:logs search "timeout"

# 統計情報
pnpm render:logs stats
```

### Vercel ログ

```bash
# ランタイムログ（最新1時間）
pnpm vercel:logs runtime

# ビルドログ（要TOKEN）
export VERCEL_TOKEN=xxxxx
pnpm vercel:logs build

# エラーログのみ
pnpm vercel:logs errors

# リアルタイムストリーミング
pnpm vercel:logs stream

# Function実行ログ
pnpm vercel:logs functions

# デプロイメント統計
pnpm vercel:logs stats
```

## 📊 ログ取得の詳細

### Render CLI コマンド

```bash
# 基本的なログ取得
render logs SERVICE_ID

# JSON形式で出力
render logs SERVICE_ID -o json

# フィルタリング
render logs SERVICE_ID --level error,warning --limit 200

# 時間範囲指定
render logs SERVICE_ID --start "2024-01-01T00:00:00Z" --end "2024-01-02T00:00:00Z"

# リアルタイムストリーミング
render logs SERVICE_ID --tail
```

### Render API エンドポイント

```bash
# ログ取得
GET https://api.render.com/v1/logs
Parameters:
  - serviceId: サービスID（必須）
  - startTime: 開始時刻
  - endTime: 終了時刻
  - limit: 取得件数（最大10,000）
  - level: info, warning, error
  - text: 検索文字列

# ビルドログ取得
GET https://api.render.com/v1/deploys/{deployId}/logs
```

### Vercel CLI コマンド

```bash
# ランタイムログ（最新のみ）
vercel logs DEPLOYMENT_URL

# JSON形式で出力
vercel logs DEPLOYMENT_URL --json

# 出力制限
vercel logs DEPLOYMENT_URL --limit 100
```

### Vercel API エンドポイント

```bash
# ビルドイベント取得（ビルドログ含む）
GET https://api.vercel.com/v3/deployments/{deploymentId}/events

# 注意: ランタイムログのAPIエンドポイントは存在しない
```

## 🔧 高度な使い方

### ログのフィルタリングと解析

```bash
# Renderでエラーの集計
pnpm render:logs runtime | grep ERROR | wc -l

# Vercelで遅いAPIエンドポイントの特定
pnpm vercel:logs functions | grep -E "[0-9]{4}ms" | sort -k5 -nr

# 特定の時間帯のログ抽出
pnpm render:logs runtime | grep "2024-01-24T10:"
```

### ログの保存と分析

```bash
# ログをファイルに保存
pnpm render:logs runtime > logs/render-$(date +%Y%m%d).log
pnpm vercel:logs build > logs/vercel-build-$(date +%Y%m%d).log

# エラーログの日次レポート
pnpm render:logs errors > logs/errors-$(date +%Y%m%d).log
```

### CI/CDでの活用

```yaml
# GitHub Actions例
- name: Check deployment logs
  env:
    RENDER_API_KEY: ${{ secrets.RENDER_API_KEY }}
  run: |
    pnpm render:logs build
    pnpm render:logs errors 1
```

## ⚠️ 制限事項と注意点

### Render

- **API制限**: 100リクエスト/分
- **ログサイズ**: 1行あたり最大100KB
- **処理能力**: 6,000行/分/インスタンス
- **クロスリージョン**: 不可（同一リージョンのみ）

### Vercel

- **ランタイムログ**: 1時間のみ保存
- **API制限**: 100リクエスト/10秒
- **ログサイズ**: 4KB/Function実行
- **ランタイムログAPI**: 存在しない（CLIのみ）

## 💡 ベストプラクティス

### 1. ログの永続化

**Render Log Streams**:

```yaml
# render.yaml
services:
  - type: web
    logStreamName: datadog-logs
    logStreamConfig:
      token: ${{ secrets.DATADOG_API_KEY }}
```

**Vercel Log Drains**:

```bash
vercel logs drain add https://logs.example.com/webhook
```

### 2. エラー監視

```bash
# 定期的なエラーチェック（cron）
*/5 * * * * /path/to/render-logs.sh errors 1 | grep -E "CRITICAL|ERROR" && notify-slack.sh
```

### 3. パフォーマンス監視

```bash
# Vercel Function のレスポンスタイム監視
pnpm vercel:logs functions | awk '{print $NF}' | grep -o '[0-9]+' | \
  awk '{sum+=$1; count++} END {print "Average:", sum/count, "ms"}'
```

## 🔍 トラブルシューティング

### "No logs found" エラー

- サービスIDが正しいか確認
- ログの保存期間を超えていないか確認
- 適切な権限（API KEY/TOKEN）があるか確認

### ログが表示されない

- アプリケーションが正しくログを出力しているか確認
- console.log（Node.js）が使われているか確認
- ログレベルの設定を確認

### リアルタイムログが遅延する

- ネットワークの遅延
- ログ処理のバッファリング（数秒の遅延は正常）

## 📝 まとめ

- **ビルドログ**: 両プラットフォームともAPIで取得可能
- **ランタイムログ**: RenderはAPI対応、VercelはCLIのみ
- **保存期間**: Renderは有料プランで延長、Vercelは1時間固定
- **永続化**: 外部サービスへの転送を推奨
