-- 失敗したマイグレーションを修正するSQL
-- 使用方法: psql <EXTERNAL_DATABASE_URL> -f scripts/fix-failed-migration.sql

-- 現在のマイグレーション状態を確認
\echo '=== 現在のマイグレーション状態 ==='
SELECT 
  migration_name,
  started_at,
  finished_at,
  CASE 
    WHEN finished_at IS NULL THEN 'FAILED'
    ELSE 'SUCCESS'
  END as status
FROM _prisma_migrations
ORDER BY started_at DESC
LIMIT 10;

-- 失敗したマイグレーションの詳細を表示
\echo '\n=== 失敗したマイグレーションの詳細 ==='
SELECT 
  migration_name,
  started_at,
  logs
FROM _prisma_migrations
WHERE finished_at IS NULL;

-- 失敗したマイグレーションを成功扱いにする
-- 注意: これは既にテーブル構造が正しい場合のみ実行してください
\echo '\n=== 失敗したマイグレーションを修正 ==='
UPDATE _prisma_migrations
SET 
  finished_at = NOW(),
  logs = NULL
WHERE migration_name = '20241224005500_add_description_and_organization_type_to_accounts'
  AND finished_at IS NULL;

-- 修正後の状態を確認
\echo '\n=== 修正後のマイグレーション状態 ==='
SELECT 
  migration_name,
  started_at,
  finished_at,
  CASE 
    WHEN finished_at IS NULL THEN 'FAILED'
    ELSE 'SUCCESS'
  END as status
FROM _prisma_migrations
WHERE migration_name LIKE '%20241224%'
ORDER BY started_at DESC;