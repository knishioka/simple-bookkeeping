#!/bin/bash

# PoC環境セットアップスクリプト

echo "🚀 PoC環境のセットアップを開始します..."

# 1. 環境変数の確認
if [ ! -f .env.production ]; then
    echo "⚠️  .env.productionファイルを作成してください"
    echo "テンプレート:"
    cat << EOF
DATABASE_URL=postgresql://[USER]:[PASSWORD]@[HOST]:[PORT]/[DATABASE]
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[YOUR_ANON_KEY]
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
NEXT_PUBLIC_API_URL=https://[YOUR_VERCEL_URL]/api/v1
EOF
    exit 1
fi

# 2. 依存関係のインストール
echo "📦 依存関係をインストール中..."
pnpm install --frozen-lockfile

# 3. Prismaクライアントの生成
echo "🔧 Prismaクライアントを生成中..."
pnpm --filter @simple-bookkeeping/database db:generate

# 4. データベースマイグレーション
echo "🗄️  データベースマイグレーションを実行中..."
pnpm --filter @simple-bookkeeping/database db:push

# 5. 初期データの投入
echo "🌱 初期データを投入中..."
pnpm --filter @simple-bookkeeping/database db:seed

# 6. ビルドテスト
echo "🏗️  ビルドテストを実行中..."
pnpm build

echo "✅ セットアップが完了しました！"
echo ""
echo "次のステップ:"
echo "1. GitHubにpush"
echo "2. Vercelでプロジェクトをインポート"
echo "3. 環境変数を設定"
echo "4. デプロイ"