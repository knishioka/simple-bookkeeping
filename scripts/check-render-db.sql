-- Renderデータベースの状態確認SQL
-- 使用方法: psql <EXTERNAL_DATABASE_URL> -f scripts/check-render-db.sql

-- データベースのテーブル一覧を確認
\echo '=== テーブル一覧 ==='
\dt

-- Prismaマイグレーション履歴を確認
\echo '\n=== マイグレーション履歴 ==='
SELECT * FROM _prisma_migrations ORDER BY started_at DESC LIMIT 10;

-- 各テーブルの存在確認
\echo '\n=== 各テーブルの行数 ==='
SELECT 
  schemaname,
  tablename,
  n_live_tup as row_count
FROM pg_stat_user_tables
ORDER BY tablename;