# Database Commands - Quick Reference

Claude Code用のデータベース操作コマンド集。頻繁に使うコマンドをすぐに参照できます。

## 🚀 最もよく使うコマンド

### テーブル一覧

```bash
# ローカル環境
pnpm db:tables

# 本番環境
pnpm db:tables:prod
```

### データ件数確認

```bash
# 組織数
pnpm db:query:prod "SELECT COUNT(*) FROM organizations;"

# ユーザー数
pnpm db:query:prod "SELECT COUNT(*) FROM users;"

# 仕訳エントリ数
pnpm db:query:prod "SELECT COUNT(*) FROM journal_entries;"
```

### 最新データ取得

```bash
# 最新10組織
pnpm db:query:prod "SELECT id, name, code, created_at FROM organizations ORDER BY created_at DESC LIMIT 10;"

# 最新10ユーザー
pnpm db:query:prod "SELECT id, email, full_name, created_at FROM users ORDER BY created_at DESC LIMIT 10;"

# 最新10仕訳エントリ
pnpm db:query:prod "SELECT id, entry_date, description, status FROM journal_entries ORDER BY entry_date DESC LIMIT 10;"
```

## 📊 よく使うクエリ

### データベース情報

```bash
# 現在の接続情報
pnpm db:query:prod "SELECT current_database(), current_user, version();"

# データベースサイズ
pnpm db:query:prod "SELECT pg_size_pretty(pg_database_size(current_database()));"

# テーブルごとの行数（publicスキーマ）
pnpm db:query:prod "SELECT schemaname, relname as tablename, n_live_tup as row_count FROM pg_stat_user_tables WHERE schemaname = 'public' ORDER BY n_live_tup DESC;"
```

### 集計クエリ

```bash
# 組織別ユーザー数
pnpm db:query:prod "SELECT o.name, COUNT(uo.user_id) as user_count FROM organizations o LEFT JOIN user_organizations uo ON o.id = uo.organization_id GROUP BY o.id, o.name ORDER BY user_count DESC;"

# 仕訳エントリのステータス別集計
pnpm db:query:prod "SELECT status, COUNT(*) as count FROM journal_entries GROUP BY status;"

# バケット別ファイル数
pnpm db:query:prod "SELECT bucket_name, COUNT(*) as file_count, pg_size_pretty(SUM(file_size)) as total_size FROM file_metadata GROUP BY bucket_name;"
```

## 🔧 詳細な操作

### スクリプト直接実行

```bash
# 本番環境（確認プロンプトあり）
bash scripts/db-query.sh --env prod "SELECT * FROM organizations LIMIT 5;"

# 本番環境（確認スキップ）
bash scripts/db-query.sh --env prod --yes "SELECT * FROM organizations LIMIT 5;"

# ローカル環境
bash scripts/db-query.sh --env local "SELECT * FROM organizations LIMIT 5;"

# JSON形式で出力
bash scripts/db-query.sh --env prod --yes --format json "SELECT * FROM organizations LIMIT 5;"

# SQLファイルから実行
bash scripts/db-query.sh --env prod --yes --file queries/report.sql
```

## 🛡️ 安全性ガイドライン

### ✅ 推奨事項

- **読み取り専用クエリを使用**: `SELECT` のみ
- **LIMIT句を必ず指定**: 大量データの取得を避ける
- **本番環境では慎重に**: データ変更はSupabase Dashboard経由

### ⚠️ 注意事項

```bash
# ❌ 避けるべき操作（本番環境）
# - INSERT, UPDATE, DELETE
# - DROP, TRUNCATE
# - ALTER TABLE

# ✅ 安全な操作（本番環境）
# - SELECT
# - COUNT, SUM, AVG などの集計関数
# - JOIN による複数テーブルの参照
```

## 📋 テーブル構成

### 主要テーブル

| テーブル名            | 説明                 | 主要カラム                                 |
| --------------------- | -------------------- | ------------------------------------------ |
| `organizations`       | 組織情報             | id, name, code, tax_id                     |
| `users`               | ユーザー情報         | id, email, full_name, auth_user_id         |
| `user_organizations`  | ユーザー-組織関連    | user_id, organization_id, role             |
| `accounting_periods`  | 会計期間             | id, organization_id, start_date, end_date  |
| `accounts`            | 勘定科目             | id, code, name, account_type               |
| `partners`            | 取引先               | id, name, partner_type, tax_id             |
| `journal_entries`     | 仕訳エントリ         | id, entry_date, description, status        |
| `journal_entry_lines` | 仕訳明細             | id, journal_entry_id, account_id, amount   |
| `audit_logs`          | 監査ログ             | id, table_name, action, old_data, new_data |
| `file_metadata`       | ファイルメタデータ   | id, bucket_name, file_path, file_name      |
| `user_presence`       | リアルタイム在席情報 | id, user_id, last_seen_at                  |

### ビュー

| ビュー名           | 説明               |
| ------------------ | ------------------ |
| `account_balances` | 勘定科目別残高     |
| `trial_balance`    | 試算表             |
| `dashboard_stats`  | ダッシュボード統計 |

## 🔗 関連ドキュメント

- [Database Operations Guide](../database-operations.md) - 詳細ガイド
- [npm Scripts Guide](../npm-scripts-guide.md) - すべてのnpmスクリプト
- [Supabase Guidelines](../ai-guide/supabase-guidelines.md) - Supabase操作

---

**Last Updated:** 2025-01-06
