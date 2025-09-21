# Express.js → Supabase移行状態確認

プロジェクトのExpress.jsからSupabase + Server Actionsへの移行状態を確認します。

## 使用方法

```
/migration-check [--detailed]
```

### オプション

- `--detailed`: 詳細な移行状態を表示

## 説明

このコマンドは、Simple BookkeepingプロジェクトのExpress.jsからSupabaseへの移行状態を包括的にチェックし、残作業や潜在的な問題を特定します。

## チェック内容

### 1. 移行完了状態の確認

```bash
echo "🔄 Express.js → Supabase 移行状態チェック"
echo "==========================================="

# Express.js APIディレクトリの存在確認
if [ -d "apps/api" ]; then
  echo "❌ apps/api/ ディレクトリがまだ存在します（削除が必要）"
else
  echo "✅ Express.js APIディレクトリは削除済み"
fi

# Server Actionsの存在確認
if [ -d "apps/web/app/actions" ]; then
  actions_count=$(find apps/web/app/actions -name "*.ts" -o -name "*.tsx" | wc -l)
  echo "✅ Server Actions: $actions_count ファイル"
else
  echo "⚠️ Server Actionsディレクトリが見つかりません"
fi

# Supabase設定の確認
if [ -f "apps/web/src/lib/supabase.ts" ] || [ -f "apps/web/lib/supabase.ts" ]; then
  echo "✅ Supabaseクライアント設定: 存在"
else
  echo "❌ Supabaseクライアント設定が見つかりません"
fi
```

### 2. 残存するExpress.js参照の検出

```bash
echo -e "\n📝 Express.js参照の検出"
echo "------------------------"

# コード内のExpress.js参照
echo "コード内の参照:"
grep -r "express" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist \
  apps packages 2>/dev/null | head -10 || echo "✅ Express参照なし"

# API_URLやJWT関連の環境変数参照
echo -e "\n環境変数の参照:"
grep -r "API_URL\|JWT_SECRET\|API_PORT" --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=.next \
  apps packages 2>/dev/null | head -10 || echo "✅ 旧環境変数参照なし"

# package.jsonの依存関係
echo -e "\nExpress関連の依存関係:"
grep -E "(express|jsonwebtoken|bcrypt)" package.json packages/*/package.json apps/*/package.json 2>/dev/null || echo "✅ Express依存関係なし"
```

### 3. Supabase実装状態の確認

```bash
echo -e "\n🚀 Supabase実装状態"
echo "-------------------"

# Supabase Auth使用箇所
echo "認証実装:"
grep -r "supabase.auth" --include="*.ts" --include="*.tsx" \
  apps/web 2>/dev/null | wc -l | xargs echo "Supabase Auth使用箇所:"

# Supabaseクエリ使用箇所
echo "データベースアクセス:"
grep -r "supabase.from(" --include="*.ts" --include="*.tsx" \
  apps/web 2>/dev/null | wc -l | xargs echo "Supabaseクエリ使用箇所:"

# RLSポリシーの確認（ローカルSupabaseが起動している場合）
if curl -s http://localhost:54321/rest/v1/ > /dev/null 2>&1; then
  echo -e "\nRLS状態:"
  psql postgresql://postgres:postgres@localhost:54322/postgres -c "
    SELECT tablename, COUNT(*) as policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
    GROUP BY tablename;
  " 2>/dev/null || echo "RLS確認できません（Supabase未起動）"
fi
```

### 4. 移行進捗サマリー

```bash
echo -e "\n📊 移行進捗サマリー"
echo "==================="

completed=0
pending=0
total=8

# チェック項目
checks=(
  "Express.js APIディレクトリ削除:$([ ! -d "apps/api" ] && echo "✅" || echo "❌")"
  "Server Actions実装:$([ -d "apps/web/app/actions" ] && echo "✅" || echo "❌")"
  "Supabaseクライアント設定:$([ -f "apps/web/lib/supabase.ts" ] && echo "✅" || echo "❌")"
  "Express依存関係削除:$(! grep -q "express" package.json 2>/dev/null && echo "✅" || echo "❌")"
  "JWT認証削除:$(! grep -q "JWT_SECRET" .env* 2>/dev/null && echo "✅" || echo "⚠️")"
  "Supabase Auth実装:$(grep -q "supabase.auth" apps/web/**/*.ts* 2>/dev/null && echo "✅" || echo "⚠️")"
  "環境変数更新:$(grep -q "NEXT_PUBLIC_SUPABASE_URL" .env* 2>/dev/null && echo "✅" || echo "❌")"
  "ドキュメント更新:$(grep -q "Supabase" CLAUDE.md 2>/dev/null && echo "✅" || echo "❌")"
)

for check in "${checks[@]}"; do
  echo "• $check"
  if [[ $check == *"✅"* ]]; then
    ((completed++))
  elif [[ $check == *"❌"* ]] || [[ $check == *"⚠️"* ]]; then
    ((pending++))
  fi
done

progress=$((completed * 100 / total))
echo -e "\n進捗: $completed/$total 完了 ($progress%)"

# プログレスバー
echo -n "["
for i in {1..20}; do
  if [ $i -le $((progress / 5)) ]; then
    echo -n "="
  else
    echo -n " "
  fi
done
echo "] $progress%"
```

### 5. 推奨アクション

```bash
echo -e "\n📋 推奨アクション"
echo "================"

actions_needed=()

# Express.js関連
if [ -d "apps/api" ]; then
  actions_needed+=("1. apps/api/ディレクトリを削除: rm -rf apps/api")
fi

# 環境変数
if grep -q "API_URL\|JWT_SECRET" .env* 2>/dev/null; then
  actions_needed+=("2. .envファイルから旧環境変数を削除")
fi

# package.json
if grep -q "express\|jsonwebtoken" package.json 2>/dev/null; then
  actions_needed+=("3. Express関連の依存関係を削除: pnpm remove express jsonwebtoken")
fi

# Supabase
if ! curl -s http://localhost:54321/rest/v1/ > /dev/null 2>&1; then
  actions_needed+=("4. Supabaseを起動: pnpm supabase:start")
fi

if [ ${#actions_needed[@]} -eq 0 ]; then
  echo "🎉 移行が完了しています！追加のアクションは不要です。"
else
  for action in "${actions_needed[@]}"; do
    echo "$action"
  done
fi
```

## 詳細モード出力（--detailed）

```bash
# ファイル別の詳細分析
echo -e "\n📁 ファイル別詳細分析"
echo "====================="

# 各ディレクトリの移行状態
for dir in apps/web packages/*; do
  if [ -d "$dir" ]; then
    echo -e "\n$dir:"

    # Express参照
    express_refs=$(grep -r "express\|Express" --include="*.ts" --include="*.tsx" "$dir" 2>/dev/null | wc -l)
    echo "  Express参照: $express_refs 箇所"

    # Supabase参照
    supabase_refs=$(grep -r "supabase" --include="*.ts" --include="*.tsx" "$dir" 2>/dev/null | wc -l)
    echo "  Supabase参照: $supabase_refs 箇所"

    # Server Actions
    if [[ "$dir" == "apps/web" ]]; then
      server_actions=$(find "$dir/app/actions" -name "*.ts" 2>/dev/null | wc -l)
      echo "  Server Actions: $server_actions ファイル"
    fi
  fi
done

# スキーマ移行状態
echo -e "\n🗄️ データベーススキーマ移行"
if [ -f "packages/database/prisma/schema.prisma" ]; then
  echo "Prismaスキーマ: 存在"
  models=$(grep "^model " packages/database/prisma/schema.prisma | wc -l)
  echo "  モデル数: $models"
fi

if [ -d "supabase/migrations" ]; then
  migrations=$(ls supabase/migrations/*.sql 2>/dev/null | wc -l)
  echo "Supabaseマイグレーション: $migrations ファイル"
fi
```

## 出力例

```
🔄 Express.js → Supabase 移行状態チェック
===========================================

✅ Express.js APIディレクトリは削除済み
✅ Server Actions: 12 ファイル
✅ Supabaseクライアント設定: 存在

📝 Express.js参照の検出
------------------------
コード内の参照:
✅ Express参照なし

環境変数の参照:
✅ 旧環境変数参照なし

Express関連の依存関係:
✅ Express依存関係なし

🚀 Supabase実装状態
-------------------
認証実装:
Supabase Auth使用箇所: 8
データベースアクセス:
Supabaseクエリ使用箇所: 15

📊 移行進捗サマリー
===================
• Express.js APIディレクトリ削除: ✅
• Server Actions実装: ✅
• Supabaseクライアント設定: ✅
• Express依存関係削除: ✅
• JWT認証削除: ✅
• Supabase Auth実装: ✅
• 環境変数更新: ✅
• ドキュメント更新: ✅

進捗: 8/8 完了 (100%)
[====================] 100%

📋 推奨アクション
================
🎉 移行が完了しています！追加のアクションは不要です。
```

## 関連コマンド

- `/supabase-setup` - Supabase環境のセットアップ
- `/supabase-debug` - Supabaseデバッグ情報の表示
- `/resolve-gh-issue` - GitHub Issueの解決
