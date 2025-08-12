#!/bin/bash

# ============================================================================
# start-dev.sh - Development Server Startup Script
# ============================================================================
# Purpose: Starts both web and API development servers concurrently with
#          port conflict checking and graceful shutdown handling
# Usage: pnpm dev (or direct execution)
# Requirements: .env file for configuration, WEB_PORT and API_PORT variables
# ============================================================================

# 環境変数の読み込み
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# デフォルト値の設定
WEB_PORT=${WEB_PORT:-3000}
API_PORT=${API_PORT:-3001}

echo "🚀 Simple Bookkeeping 開発環境を起動します"
echo "================================"
echo "Web Port: $WEB_PORT"
echo "API Port: $API_PORT"
echo "================================"

# ポートチェック
echo ""
node scripts/check-ports.js
echo ""

# ポート競合がある場合は確認
read -p "続行しますか？ (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "起動をキャンセルしました"
  exit 1
fi

# サーバー起動
echo "📦 サーバーを起動中..."

# Web サーバー起動（バックグラウンド）
echo "Starting Web server on port $WEB_PORT..."
WEB_PORT=$WEB_PORT pnpm --filter @simple-bookkeeping/web dev &
WEB_PID=$!

# API サーバー起動（バックグラウンド）
echo "Starting API server on port $API_PORT..."
pnpm --filter @simple-bookkeeping/api dev &
API_PID=$!

# 終了処理
cleanup() {
  echo ""
  echo "🛑 サーバーを停止中..."
  kill $WEB_PID $API_PID 2>/dev/null
  exit 0
}

trap cleanup INT TERM

# プロセスの監視
echo ""
echo "✅ 両方のサーバーが起動しました"
echo "Web: http://localhost:$WEB_PORT"
echo "API: http://localhost:$API_PORT"
echo ""
echo "停止するには Ctrl+C を押してください"

# プロセスの終了を待つ
wait