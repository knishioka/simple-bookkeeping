-- RenderデータベースをリセットするSQL
-- 警告: このスクリプトはすべてのデータを削除します！
-- 使用方法: psql <EXTERNAL_DATABASE_URL> -f scripts/reset-render-db.sql

-- 現在の状態を確認
\echo '=== 現在のテーブル一覧 ==='
\dt

-- すべてのテーブルを削除（CASCADE）
\echo '\n=== すべてのテーブルを削除 ==='
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- 外部キー制約を一時的に無効化
    EXECUTE 'SET session_replication_role = replica';
    
    -- すべてのテーブルを削除
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
    LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        RAISE NOTICE 'Dropped table: %', r.tablename;
    END LOOP;
    
    -- 外部キー制約を再度有効化
    EXECUTE 'SET session_replication_role = DEFAULT';
END $$;

-- 削除後の確認
\echo '\n=== 削除後のテーブル一覧（空であることを確認）==='
\dt

\echo '\n=== データベースのリセットが完了しました ==='
\echo '次のステップ:'
\echo '1. cd packages/database'
\echo '2. DATABASE_URL="<External_Connection_URL>" npx prisma migrate deploy'
\echo '3. DATABASE_URL="<External_Connection_URL>" npx prisma db seed'