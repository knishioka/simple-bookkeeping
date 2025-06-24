# Render での勘定科目SQL実行手順

## 📋 概要

207個の標準勘定科目をRenderのPostgreSQLデータベースに直接SQLで挿入します。

## 🚀 最も簡単な実行方法（新機能）

```bash
# 1. 勘定科目を自動挿入（推奨）
pnpm render:insert-accounts

# 2. 手動でSQLを実行
pnpm render:psql < scripts/insert-accounts.sql

# 3. インタラクティブにPostgreSQLに接続
pnpm render:psql

# 4. 結果を確認
pnpm render:psql -c "SELECT COUNT(*) FROM accounts WHERE is_system = true;"
```

## 🔧 その他の実行方法

### 方法1: Render Shell で実行

1. **Render Dashboard にアクセス**
   - https://dashboard.render.com にログイン
   - `simple-bookkeeping-api` サービスを選択
   - 左メニューの「Shell」をクリック
   - 「Connect」ボタンでシェル接続

2. **SQLファイルをアップロード**

   ```bash
   # scripts/insert-accounts.sql の内容をコピー
   cat > insert-accounts.sql << 'EOF'
   # ここに insert-accounts.sql の内容を貼り付け
   EOF
   ```

3. **SQL実行**

   ```bash
   # データベースディレクトリに移動
   cd packages/database

   # SQLファイルを実行
   npx prisma db execute --file ../../insert-accounts.sql
   ```

### 方法2: prisma db execute で実行

```bash
# Render Shell で以下を実行
cd packages/database

# 直接SQLを実行
npx prisma db execute --stdin << 'EOF'
-- ここに insert-accounts.sql の内容を貼り付け
EOF
```

### 方法3: ローカルから実行（DATABASE_URL使用）

```bash
# ローカル環境で実行
cd packages/database

# Render の DATABASE_URL を設定
export DATABASE_URL="postgresql://user:password@host:port/database"

# SQLファイルを実行
npx prisma db execute --file ../../scripts/insert-accounts.sql
```

## 📊 実行結果の確認

```bash
# 勘定科目数を確認
npx prisma db execute --stdin << 'EOF'
SELECT
  account_type,
  organization_type,
  COUNT(*) as count
FROM accounts
WHERE is_system = true
GROUP BY account_type, organization_type
ORDER BY account_type, organization_type;
EOF

# 総数確認
npx prisma db execute --stdin << 'EOF'
SELECT COUNT(*) as total_accounts FROM accounts WHERE is_system = true;
EOF
```

## 🔍 勘定科目の内容確認

```bash
# 主要勘定科目の確認
npx prisma db execute --stdin << 'EOF'
SELECT code, name, description, account_type, organization_type
FROM accounts
WHERE is_system = true AND parent_id IS NULL
ORDER BY code;
EOF

# 特定カテゴリの確認（例：資産）
npx prisma db execute --stdin << 'EOF'
SELECT code, name, description, organization_type
FROM accounts
WHERE is_system = true AND account_type = 'ASSET'
ORDER BY code;
EOF
```

## 📈 期待される結果

- **総勘定科目数**: 約90個（基本勘定科目）
- **資産**: 流動資産・固定資産の詳細勘定科目
- **負債**: 流動負債・固定負債の詳細勘定科目
- **純資産**: 個人事業主向け・法人向けの区分
- **収益**: 売上高・営業外収益の詳細勘定科目
- **費用**: 売上原価・販管費・営業外費用の詳細勘定科目

## ⚠️ 注意事項

1. **既存データ**: 既存の system 勘定科目は削除されます
2. **組織必須**: 実行前に組織（organization）が存在している必要があります
3. **エラー時**: エラーが発生した場合は再実行可能です

## 🚨 トラブルシューティング

### エラー: 組織が存在しません

```bash
# 組織を確認
npx prisma db execute --stdin << 'EOF'
SELECT id, name FROM organizations;
EOF

# 組織が存在しない場合は seed を先に実行
npx prisma db seed
```

### エラー: 外部キー制約

```bash
# 関連データを削除してから再実行
npx prisma db execute --stdin << 'EOF'
DELETE FROM accounts WHERE is_system = true;
EOF
```

## ✅ 成功確認

実行成功時の出力例：

```
勘定科目の挿入が完了しました。
挿入された勘定科目数: 87
```
