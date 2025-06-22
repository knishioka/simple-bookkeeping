#!/bin/bash
# Render post-deployment automation script

echo "🔧 Render デプロイ後セットアップスクリプト"
echo "=========================================="
echo ""

# Function to wait for user confirmation
wait_for_confirmation() {
    echo "上記の手順を完了したら、Enterキーを押してください..."
    read -r
}

# Step 1: Manual deployment
echo "📋 ステップ1: Render Dashboardでデプロイ"
echo "----------------------------------------"
echo "1. https://dashboard.render.com にアクセス"
echo "2. 「New +」→「Blueprint」をクリック"
echo "3. knishioka/simple-bookkeeping リポジトリを選択"
echo "4. 「Apply」をクリック"
echo ""
wait_for_confirmation

# Step 2: Get service names
echo "📋 ステップ2: サービス情報の取得"
echo "----------------------------------------"
echo "デプロイされたサービスを確認中..."
echo ""

# Try to list services
render services list -o json 2>/dev/null | jq -r '.[] | "\(.name) (\(.type)) - \(.status)"' || {
    echo "⚠️ サービス一覧を取得できませんでした。"
    echo "Render Dashboardで以下を確認してください："
    echo "- simple-bookkeeping-api (Web Service)"
    echo "- simple-bookkeeping-db (PostgreSQL)"
}

echo ""
echo "APIサービスのURLをコピーしてください："
echo "例: https://simple-bookkeeping-api-xxxx.onrender.com"
echo ""
read -p "API URL: " API_URL

# Step 3: Create database migration script
echo ""
echo "📋 ステップ3: データベースマイグレーション"
echo "----------------------------------------"
cat > /tmp/render-db-migrate.sh << 'EOF'
#!/bin/bash
cd packages/database
echo "🔄 Prismaクライアントを生成中..."
npx prisma generate
echo "🔄 マイグレーションを実行中..."
npx prisma migrate deploy
echo "🔄 シードデータを投入中..."
npx prisma db seed
echo "✅ データベースセットアップ完了"
EOF

echo "以下のコマンドをRender Shellで実行してください："
echo ""
echo "1. Render Dashboardで simple-bookkeeping-api サービスを開く"
echo "2. 「Shell」タブをクリック"
echo "3. 「Connect」をクリック"
echo "4. 以下のコマンドをコピー＆ペーストして実行："
echo ""
echo "----------------------------------------"
cat /tmp/render-db-migrate.sh
echo "----------------------------------------"
echo ""
wait_for_confirmation

# Step 4: Test API
echo "📋 ステップ4: API動作確認"
echo "----------------------------------------"
echo "APIの動作を確認中..."
echo ""

# Health check
echo "ヘルスチェック:"
curl -s "$API_URL/api/v1/health" || echo "❌ ヘルスチェック失敗"
echo ""

# API info
echo "API情報:"
curl -s "$API_URL/api/v1/" | jq . || echo "❌ API情報取得失敗"
echo ""

# Step 5: Update Vercel
echo "📋 ステップ5: Vercel環境変数の更新"
echo "----------------------------------------"
echo "以下のコマンドを実行してVercelを更新してください："
echo ""
echo "# 既存の環境変数を削除"
echo "vercel env rm API_URL production"
echo ""
echo "# 新しいAPI URLを設定"
echo "echo \"$API_URL\" | vercel env add API_URL production"
echo "echo \"$API_URL\" | vercel env add API_URL preview"
echo ""
echo "# Vercelを再デプロイ"
echo "vercel --prod"
echo ""

echo "✅ セットアップ手順を完了しました！"