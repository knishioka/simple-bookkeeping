#!/bin/bash

# デモ環境初期化スクリプト
# Docker Compose起動時にデモデータを自動投入

set -e

echo "🚀 デモ環境の初期化を開始します..."

# APIサーバーの起動を待機
wait_for_api() {
    echo "📡 APIサーバーの起動を待機中..."
    for i in {1..60}; do
        if curl -f -s http://localhost:${API_PORT:-3001}/health > /dev/null 2>&1; then
            echo "✅ APIサーバーが起動しました"
            return 0
        fi
        echo "⏳ 待機中... ($i/60)"
        sleep 2
    done
    echo "❌ APIサーバーの起動がタイムアウトしました"
    return 1
}

# データベースの初期化
init_database() {
    echo "🗄️ データベースの初期化中..."
    
    # Prisma クライアントの生成
    cd /app
    npx prisma generate --schema=packages/database/prisma/schema.prisma
    
    # マイグレーション実行
    npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma
    
    echo "✅ データベースの初期化が完了しました"
}

# デモデータの投入
seed_demo_data() {
    echo "🌱 デモデータを投入中..."
    
    cd /app/packages/database
    npm run db:seed
    
    echo "✅ デモデータの投入が完了しました"
}

# デモユーザーの作成
create_demo_user() {
    echo "👤 デモユーザーを作成中..."
    
    # APIエンドポイントを使ってデモユーザーを作成
    curl -X POST http://localhost:${API_PORT:-3001}/api/v1/auth/register \
         -H "Content-Type: application/json" \
         -d '{
           "email": "demo@simple-bookkeeping.com",
           "password": "demo123",
           "name": "デモユーザー",
           "organizationName": "デモ会社"
         }' || echo "⚠️ ユーザー作成をスキップ（既に存在する可能性）"
    
    echo "✅ デモユーザーの作成が完了しました"
}

# 追加のサンプルデータ投入
create_sample_transactions() {
    echo "📊 サンプル取引データを作成中..."
    
    # JWTトークンを取得
    TOKEN=$(curl -X POST http://localhost:${API_PORT:-3001}/api/v1/auth/login \
                 -H "Content-Type: application/json" \
                 -d '{
                   "email": "demo@simple-bookkeeping.com",
                   "password": "demo123"
                 }' | jq -r '.token' 2>/dev/null || echo "")
    
    if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
        # サンプル仕訳データの投入
        curl -X POST http://localhost:${API_PORT:-3001}/api/v1/journal-entries \
             -H "Content-Type: application/json" \
             -H "Authorization: Bearer $TOKEN" \
             -d '{
               "date": "2024-01-15",
               "description": "売上計上（デモ）",
               "lines": [
                 {
                   "accountId": "cash-account-id",
                   "debitAmount": 100000,
                   "creditAmount": 0
                 },
                 {
                   "accountId": "sales-account-id", 
                   "debitAmount": 0,
                   "creditAmount": 100000
                 }
               ]
             }' || echo "⚠️ サンプル取引の作成をスキップ"
        
        echo "✅ サンプル取引データの作成が完了しました"
    else
        echo "⚠️ 認証トークンの取得に失敗、サンプル取引の作成をスキップ"
    fi
}

# メイン処理
main() {
    echo "======================================"
    echo "🎭 Simple Bookkeeping Demo Environment"
    echo "======================================"
    
    # APIサーバーの起動待機
    if wait_for_api; then
        # データベース初期化
        init_database
        
        # デモデータ投入
        seed_demo_data
        
        # デモユーザー作成
        create_demo_user
        
        # サンプル取引作成
        create_sample_transactions
        
        echo ""
        echo "🎉 デモ環境の初期化が完了しました！"
        echo "======================================"
        echo "🌐 Web: http://localhost:${WEB_PORT:-3000}"
        echo "🔗 API: http://localhost:${API_PORT:-3001}"
        echo "👤 デモユーザー: demo@simple-bookkeeping.com"
        echo "🔑 パスワード: demo123"
        echo "======================================"
    else
        echo "❌ デモ環境の初期化に失敗しました"
        exit 1
    fi
}

# スクリプトが直接実行された場合のみメイン処理を実行
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi