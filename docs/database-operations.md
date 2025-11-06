# Database Operations Guide

Claude Codeから本番・ローカルのデータベースを操作するためのガイドです。

## 📋 目次

- [利用可能なコマンド](#利用可能なコマンド)
- [基本的な使い方](#基本的な使い方)
- [よく使うクエリ](#よく使うクエリ)
- [安全性とベストプラクティス](#安全性とベストプラクティス)
- [トラブルシューティング](#トラブルシューティング)

---

## 利用可能なコマンド

### npm Scripts（推奨）

```bash
# テーブル一覧を取得
pnpm db:tables          # ローカル環境
pnpm db:tables:prod     # 本番環境

# カスタムクエリを実行
pnpm db:query "SELECT * FROM organizations LIMIT 5;"           # ローカル
pnpm db:query:prod "SELECT * FROM organizations LIMIT 5;"     # 本番
```

### 直接スクリプト実行

```bash
# ヘルプを表示
bash scripts/db-query.sh --help

# ローカル環境でクエリ実行
bash scripts/db-query.sh --env local "SELECT current_database();"

# 本番環境でクエリ実行（確認プロンプトあり）
bash scripts/db-query.sh --env prod "SELECT COUNT(*) FROM organizations;"

# 本番環境でクエリ実行（確認スキップ）
bash scripts/db-query.sh --env prod --yes "SELECT COUNT(*) FROM organizations;"

# SQLファイルから実行
bash scripts/db-query.sh --env prod --file queries/report.sql

# JSON形式で出力
bash scripts/db-query.sh --env prod --yes --format json "SELECT * FROM organizations LIMIT 5;"
```

---

## 基本的な使い方

### 1. 環境の確認

現在の環境設定を確認：

```bash
scripts/env-manager.sh current
```

### 2. テーブル構造の確認

```bash
# すべてのテーブルとビューを一覧表示
pnpm db:tables:prod
```

**出力例:**

```
     table_name      | table_type
---------------------+------------
 account_balances    | VIEW
 accounting_periods  | BASE TABLE
 accounts            | BASE TABLE
 audit_logs          | BASE TABLE
 dashboard_stats     | VIEW
 file_metadata       | BASE TABLE
 journal_entries     | BASE TABLE
 journal_entry_lines | BASE TABLE
 organizations       | BASE TABLE
 partners            | BASE TABLE
 trial_balance       | VIEW
 user_organizations  | BASE TABLE
 user_presence       | BASE TABLE
 users               | BASE TABLE
```

### 3. データの確認

```bash
# 組織一覧を取得
pnpm db:query:prod "SELECT id, name, code, created_at FROM organizations ORDER BY created_at DESC LIMIT 10;"

# ユーザー数を確認
pnpm db:query:prod "SELECT COUNT(*) as user_count FROM users;"

# 仕訳エントリの件数確認
pnpm db:query:prod "SELECT status, COUNT(*) as count FROM journal_entries GROUP BY status;"
```

---

## よく使うクエリ

### データベース情報

```sql
-- 現在の接続情報
SELECT current_database(), current_user, version();

-- テーブル一覧
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- テーブルごとの行数（publicスキーマのみ）
SELECT
    schemaname,
    relname as tablename,
    n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

-- データベースサイズ
SELECT
    pg_size_pretty(pg_database_size(current_database())) as database_size;
```

### 組織とユーザー

```sql
-- 組織一覧
SELECT id, name, code, is_active, created_at
FROM organizations
ORDER BY created_at DESC
LIMIT 10;

-- ユーザー一覧（組織との関連含む）
SELECT
    u.id,
    u.email,
    u.full_name,
    COUNT(uo.organization_id) as org_count
FROM users u
LEFT JOIN user_organizations uo ON u.id = uo.user_id
GROUP BY u.id, u.email, u.full_name
ORDER BY u.created_at DESC;

-- 組織別ユーザー数
SELECT
    o.name as organization,
    COUNT(uo.user_id) as user_count
FROM organizations o
LEFT JOIN user_organizations uo ON o.id = uo.organization_id
GROUP BY o.id, o.name
ORDER BY user_count DESC;
```

### 会計データ

```sql
-- 勘定科目一覧
SELECT
    code,
    name,
    account_type,
    is_active
FROM accounts
WHERE is_active = true
ORDER BY code;

-- 仕訳エントリの状態別集計
SELECT
    status,
    COUNT(*) as count,
    MIN(entry_date) as oldest_date,
    MAX(entry_date) as newest_date
FROM journal_entries
GROUP BY status;

-- 最新の仕訳エントリ
SELECT
    je.id,
    je.entry_date,
    je.description,
    je.status,
    COUNT(jel.id) as line_count,
    SUM(jel.amount) as total_amount
FROM journal_entries je
LEFT JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
GROUP BY je.id
ORDER BY je.entry_date DESC
LIMIT 10;
```

### ストレージとファイル

```sql
-- アップロードファイル一覧
SELECT
    bucket_name,
    file_name,
    file_size,
    mime_type,
    created_at
FROM file_metadata
ORDER BY created_at DESC
LIMIT 20;

-- バケット別ファイル数とサイズ
SELECT
    bucket_name,
    COUNT(*) as file_count,
    pg_size_pretty(SUM(file_size)) as total_size
FROM file_metadata
GROUP BY bucket_name;
```

---

## 安全性とベストプラクティス

### ✅ 推奨事項

1. **読み取り専用クエリを優先**
   - `SELECT` クエリは安全に実行可能
   - データ分析や調査に活用

2. **本番環境での書き込みは慎重に**
   - `INSERT`, `UPDATE`, `DELETE` は必ず確認プロンプトを確認
   - バックアップを事前に取得
   - トランザクションを使用（可能な場合）

3. **LIMIT句を使用**
   - 大量データの取得を避ける
   - 常に `LIMIT` を指定（例: `LIMIT 100`）

4. **確認プロンプトの活用**

   ```bash
   # 本番環境では確認プロンプトが表示される
   bash scripts/db-query.sh --env prod "SELECT COUNT(*) FROM users;"

   # Claude Codeからの自動実行では --yes を使用
   bash scripts/db-query.sh --env prod --yes "SELECT COUNT(*) FROM users;"
   ```

### ⚠️ 注意事項

1. **本番環境での変更は避ける**
   - データ修正は必ずSupabase Dashboard経由で行う
   - 緊急時のみCLI経由で実行

2. **パスワードの保護**
   - `env/secrets/supabase.prod.env` は `.gitignore` に含まれている
   - パスワードは絶対にコミットしない
   - ログ出力時はパスワードをマスク（自動的に `***` に置換）

3. **接続数の制限**
   - Connection Pooler (port 6543) を使用
   - 同時接続数に注意

---

## トラブルシューティング

### 接続エラー

**問題:** `connection refused` エラー

```bash
psql: error: connection to server at "localhost" (::1), port 54322 failed
```

**解決策:**

1. ローカル環境の場合、Supabaseが起動しているか確認

   ```bash
   pnpm supabase:status
   ```

2. 本番環境の場合、環境変数が正しく設定されているか確認
   ```bash
   scripts/env-manager.sh current
   ```

### 認証エラー

**問題:** `password authentication failed`

**解決策:**

1. `env/secrets/supabase.prod.env` のパスワードを確認
2. Supabase Dashboard から最新のパスワードを取得
3. 環境変数をリロード
   ```bash
   direnv reload
   ```

### タイムアウトエラー

**問題:** クエリがタイムアウトする

**解決策:**

1. クエリを最適化（インデックスの活用、`LIMIT`の追加）
2. タイムアウト時間を延長
   ```bash
   bash scripts/db-query.sh --env prod --yes "SELECT ..." --timeout 60000
   ```

### 環境変数が読み込まれない

**問題:** `DATABASE_URL` が見つからない

**解決策:**

1. `.env.local` のシンボリックリンクを確認

   ```bash
   readlink .env.local
   ```

2. 環境プロファイルを切り替え

   ```bash
   scripts/env-manager.sh switch prod
   ```

3. direnvを再読み込み
   ```bash
   direnv allow .
   direnv reload
   ```

---

## データベーススキーマ

### テーブル構造

**主要テーブル:**

| テーブル名            | 説明                 | 主要カラム                                 |
| --------------------- | -------------------- | ------------------------------------------ |
| `organizations`       | 組織（会社）情報     | id, name, code, tax_id                     |
| `users`               | ユーザー情報         | id, email, full_name, auth_user_id         |
| `user_organizations`  | ユーザーと組織の関連 | user_id, organization_id, role             |
| `accounting_periods`  | 会計期間             | id, organization_id, start_date, end_date  |
| `accounts`            | 勘定科目             | id, code, name, account_type               |
| `partners`            | 取引先               | id, name, partner_type, tax_id             |
| `journal_entries`     | 仕訳エントリ         | id, entry_date, description, status        |
| `journal_entry_lines` | 仕訳明細             | id, journal_entry_id, account_id, amount   |
| `audit_logs`          | 監査ログ             | id, table_name, action, old_data, new_data |
| `file_metadata`       | ファイルメタデータ   | id, bucket_name, file_path, file_name      |

**ビュー:**

| ビュー名           | 説明                   |
| ------------------ | ---------------------- |
| `account_balances` | 勘定科目別残高         |
| `trial_balance`    | 試算表                 |
| `dashboard_stats`  | ダッシュボード統計情報 |

---

## 参考資料

- [Supabaseガイドライン](./ai-guide/supabase-guidelines.md)
- [環境変数管理](./ENVIRONMENT_VARIABLES.md)
- [direnvセットアップ](./direnv-setup.md)
- [npmスクリプトガイド](./npm-scripts-guide.md)

---

**Version:** 1.0
**Last Updated:** 2025-01-06
**Project:** simple-bookkeeping
