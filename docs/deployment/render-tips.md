# Render 使い方のコツとTips

## 📋 概要

Renderでのデプロイメントとデータベース管理のベストプラクティスをまとめたドキュメントです。

## 🚀 データベース操作のコツ

### 1. PostgreSQL直接接続

RenderのPostgreSQLに直接接続する最も簡単な方法：

```bash
# .render/services.json にデータベースIDを保存済みの場合
pnpm render:psql

# 手動で接続する場合（Dashboard → PostgreSQL → Connect → PSQL Command）
PGPASSWORD=<password> psql -h <host>.oregon-postgres.render.com -U <user> <database>
```

### 2. SQLファイルの実行

```bash
# SQLファイルを直接実行
pnpm render:psql < scripts/insert-accounts.sql

# または環境変数で接続
PGPASSWORD=<password> psql -h <host> -U <user> <database> < file.sql
```

### 3. クイッククエリの実行

```bash
# ワンライナーでクエリ実行
pnpm render:psql -c "SELECT COUNT(*) FROM accounts;"

# 複数行のクエリ
pnpm render:psql << 'EOF'
SELECT account_type, COUNT(*)
FROM accounts
GROUP BY account_type;
EOF
```

## 🔧 デプロイメントのコツ

### 1. ビルドエラーの対処

**TypeScript関連のエラー**

```json
// render.yaml の buildCommand で devDependencies を含める
"pnpm install --prod=false"
```

**Prismaクライアントエラー**

```bash
# buildCommand に必ず含める
cd packages/database && npx prisma generate
```

### 2. マイグレーションの自動実行

```yaml
# render.yaml
buildCommand: |
  pnpm install --prod=false && 
  cd packages/database && 
  npx prisma generate && 
  npx prisma migrate deploy
```

### 3. 環境変数の管理

```bash
# Render CLIを使用（無料版では制限あり）
render env set DATABASE_URL=<value>

# Dashboard経由が確実
# Service → Environment → Add Environment Variable
```

## 📊 モニタリングとデバッグ

### 1. ビルドログの確認

- Dashboard → Service → Events タブ
- 各デプロイメントの詳細ログを確認
- エラーメッセージを特定

### 2. APIヘルスチェック

```bash
# 簡易チェック
curl -I https://your-api.onrender.com/api/v1/

# 詳細チェック（pnpm script使用）
pnpm render:status
```

### 3. データベース状態の確認

```bash
# テーブル一覧
pnpm render:psql -c "\dt"

# レコード数確認
pnpm render:psql -c "SELECT tablename, n_live_tup FROM pg_stat_user_tables;"

# 接続情報確認
pnpm render:psql -c "SELECT current_database(), current_user;"
```

## 🚨 トラブルシューティング

### 1. 502 Bad Gateway エラー

**原因と対策：**

- サービスがスリープ中 → 15分待って再アクセス
- ビルド失敗 → ログを確認して修正
- メモリ不足 → コードを最適化

### 2. ビルド失敗の一般的な原因

1. **モノレポ構造の問題**

   ```yaml
   # render.yaml で作業ディレクトリを指定
   rootDir: .
   ```

2. **Node.js型定義エラー**

   ```json
   // tsconfig.json から削除
   "types": ["node"] // これを削除
   ```

3. **パスの問題**
   ```bash
   # 相対パスではなく絶対パスを使用
   cd packages/database # Good
   cd ./packages/database # Bad
   ```

### 3. 無料版の制限への対処

**15分スリープ問題**

- UptimeRobot等で定期的にping
- または有料プラン（$7/月）へ移行

**Shell制限**

- psqlコマンドで直接実行
- Dashboardから操作

**90日データベース削除**

- 定期的なバックアップスクリプト作成
- 警告メール（60日目）に注意

## 💡 ベストプラクティス

### 1. 開発フロー

```bash
# 1. ローカルで動作確認
pnpm build
pnpm test

# 2. デプロイ前チェック
git status
pnpm lint
pnpm typecheck

# 3. デプロイ
git push origin main

# 4. 状態確認
pnpm render:status
```

### 2. データベース操作

```bash
# バックアップを取る
pnpm render:psql -c "\copy accounts TO 'accounts_backup.csv' CSV HEADER"

# トランザクション内で実行
pnpm render:psql << 'EOF'
BEGIN;
-- 危険な操作
DELETE FROM accounts WHERE created_at < '2024-01-01';
-- 確認
SELECT COUNT(*) FROM accounts;
-- 問題なければコミット
COMMIT;
-- 問題があればロールバック
-- ROLLBACK;
EOF
```

### 3. シークレット管理

```bash
# 絶対にやってはいけないこと
- .envファイルのコミット
- render.yamlに直接記載
- ログに出力

# 正しい方法
- Dashboard → Environment Variables
- render secrets コマンド（有料版）
```

## 📝 便利なスクリプト集

### package.json に追加すると便利なスクリプト

```json
{
  "scripts": {
    // データベース関連
    "render:psql": "./scripts/render-psql.sh",
    "render:backup": "pnpm render:psql -c \"\\copy (SELECT * FROM accounts) TO 'backup.csv' CSV HEADER\"",
    "render:tables": "pnpm render:psql -c \"\\dt\"",

    // デプロイ関連
    "render:logs": "render logs --tail",
    "render:restart": "render services restart",

    // 状態確認
    "render:check": "pnpm render:status && curl -s https://your-api.onrender.com/api/v1/",
    "render:db-size": "pnpm render:psql -c \"SELECT pg_size_pretty(pg_database_size(current_database()));\""
  }
}
```

## 🔗 関連ドキュメント

- [Render公式ドキュメント](https://render.com/docs)
- [Render CLI](https://render.com/docs/cli)
- [PostgreSQL on Render](https://render.com/docs/databases)
- [Troubleshooting Guide](https://render.com/docs/troubleshooting-deploys)

## 📌 まとめ

Renderは無料版でも十分な機能を提供していますが、以下の点に注意：

1. **psqlコマンドの活用** - GUIがない分、コマンドに慣れる
2. **ビルドエラーの早期発見** - ローカルで十分テスト
3. **定期バックアップ** - 90日制限に備える
4. **環境変数の適切な管理** - Dashboardから設定

これらのTipsを活用することで、Renderでの開発・運用がスムーズになります。
