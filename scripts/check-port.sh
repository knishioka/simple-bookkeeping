#!/bin/bash

# ポート競合チェックスクリプト
# 使用方法: ./scripts/check-port.sh [PORT] [APP_NAME]
# 例: ./scripts/check-port.sh 3000 "Simple Bookkeeping"

PORT=${1:-3000}
APP_NAME=${2:-"Simple Bookkeeping"}

echo "🔍 Checking port $PORT for $APP_NAME..."
echo ""

# ポートが使用されているか確認
if lsof -i :$PORT | grep -q LISTEN; then
  # プロセス情報を取得
  PID=$(lsof -i :$PORT | grep LISTEN | awk '{print $2}')
  PROCESS_NAME=$(ps -p $PID -o comm= 2>/dev/null)
  
  echo "📍 Port $PORT is in use by process $PID ($PROCESS_NAME)"
  
  # アプリケーションを確認
  if curl -s http://localhost:$PORT | grep -q "$APP_NAME"; then
    echo "✅ $APP_NAME is running correctly on port $PORT"
    echo ""
    echo "💡 To restart the server:"
    echo "   pkill -f 'next dev' && pnpm --filter @simple-bookkeeping/web dev"
  else
    # 別のアプリが動いている可能性
    TITLE=$(curl -s http://localhost:$PORT | grep -o "<title>[^<]*</title>" | sed 's/<[^>]*>//g')
    echo "⚠️  Another application is running on port $PORT"
    if [ ! -z "$TITLE" ]; then
      echo "    Application: $TITLE"
    fi
    echo ""
    echo "🔧 To fix this issue:"
    echo "   1. Stop the current process: kill -9 $PID"
    echo "   2. Or stop all Next.js processes: pkill -f 'next dev'"
    echo "   3. Then start $APP_NAME: pnpm --filter @simple-bookkeeping/web dev"
  fi
else
  echo "ℹ️  Port $PORT is free"
  echo ""
  echo "🚀 You can start $APP_NAME with:"
  echo "   pnpm --filter @simple-bookkeeping/web dev"
fi

echo ""
echo "📝 Additional commands:"
echo "   • Check all Next.js processes: ps aux | grep next"
echo "   • Check port usage: lsof -i :$PORT"
echo "   • Kill specific PID: kill -9 <PID>"

