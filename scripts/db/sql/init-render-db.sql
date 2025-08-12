-- Render データベース初期化SQL
-- 使用方法: psql <EXTERNAL_DATABASE_URL> -f scripts/init-render-db.sql

-- 既存データの確認（デバッグ用）
SELECT COUNT(*) as user_count FROM users;

-- トランザクション開始
BEGIN;

-- 1. 管理者ユーザーの作成
-- パスワード: admin123 (bcrypt hash)
INSERT INTO users (id, email, password_hash, name, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'admin@example.com',
  '$2a$10$X4kv7j5ZcG39WgogSl16yupuXLaJL0eqrMnkEe/XrYhPpFGKBmXbC',
  '管理者',
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING
RETURNING id, email, name;

-- 2. デフォルト組織の作成
INSERT INTO organizations (id, name, code, email, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'サンプル会社',
  'SAMPLE',
  'info@sample.co.jp',
  NOW(),
  NOW()
) ON CONFLICT (code) DO NOTHING
RETURNING id, name, code;

-- 3. ユーザーと組織の関連付け
-- 注意: user_idとorganization_idは上記のINSERT文から取得する必要があります
WITH user_data AS (
  SELECT id FROM users WHERE email = 'admin@example.com' LIMIT 1
),
org_data AS (
  SELECT id FROM organizations WHERE code = 'SAMPLE' LIMIT 1
)
INSERT INTO user_organizations (id, user_id, organization_id, role, is_default, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  user_data.id,
  org_data.id,
  'ADMIN',
  true,
  NOW(),
  NOW()
FROM user_data, org_data
WHERE NOT EXISTS (
  SELECT 1 FROM user_organizations uo
  WHERE uo.user_id = user_data.id AND uo.organization_id = org_data.id
);

-- 4. 会計期間の作成
WITH org_data AS (
  SELECT id FROM organizations WHERE code = 'SAMPLE' LIMIT 1
)
INSERT INTO accounting_periods (id, name, start_date, end_date, is_active, organization_id, created_at, updated_at)
SELECT
  gen_random_uuid(),
  EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '年度',
  DATE_TRUNC('year', CURRENT_DATE),
  DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year' - INTERVAL '1 day',
  true,
  org_data.id,
  NOW(),
  NOW()
FROM org_data
WHERE NOT EXISTS (
  SELECT 1 FROM accounting_periods ap
  WHERE ap.organization_id = org_data.id AND ap.is_active = true
);

-- 5. 基本的な勘定科目の作成
WITH org_data AS (
  SELECT id FROM organizations WHERE code = 'SAMPLE' LIMIT 1
)
INSERT INTO accounts (id, code, name, account_type, is_system, organization_id, created_at, updated_at)
SELECT * FROM (
  VALUES
    -- 資産
    (gen_random_uuid(), '1000', '流動資産', 'ASSET', true, (SELECT id FROM org_data), NOW(), NOW()),
    (gen_random_uuid(), '1110', '現金', 'ASSET', true, (SELECT id FROM org_data), NOW(), NOW()),
    (gen_random_uuid(), '1130', '普通預金', 'ASSET', true, (SELECT id FROM org_data), NOW(), NOW()),
    (gen_random_uuid(), '1140', '売掛金', 'ASSET', true, (SELECT id FROM org_data), NOW(), NOW()),
    
    -- 負債
    (gen_random_uuid(), '2000', '流動負債', 'LIABILITY', true, (SELECT id FROM org_data), NOW(), NOW()),
    (gen_random_uuid(), '2110', '買掛金', 'LIABILITY', true, (SELECT id FROM org_data), NOW(), NOW()),
    (gen_random_uuid(), '2120', '未払金', 'LIABILITY', true, (SELECT id FROM org_data), NOW(), NOW()),
    
    -- 純資産
    (gen_random_uuid(), '3000', '純資産', 'EQUITY', true, (SELECT id FROM org_data), NOW(), NOW()),
    (gen_random_uuid(), '3110', '元入金', 'EQUITY', true, (SELECT id FROM org_data), NOW(), NOW()),
    
    -- 収益
    (gen_random_uuid(), '4000', '売上高', 'REVENUE', true, (SELECT id FROM org_data), NOW(), NOW()),
    (gen_random_uuid(), '4110', '商品売上高', 'REVENUE', true, (SELECT id FROM org_data), NOW(), NOW()),
    
    -- 費用
    (gen_random_uuid(), '5000', '売上原価', 'EXPENSE', true, (SELECT id FROM org_data), NOW(), NOW()),
    (gen_random_uuid(), '5110', '仕入高', 'EXPENSE', true, (SELECT id FROM org_data), NOW(), NOW()),
    (gen_random_uuid(), '6000', '販売費及び一般管理費', 'EXPENSE', true, (SELECT id FROM org_data), NOW(), NOW()),
    (gen_random_uuid(), '6200', '地代家賃', 'EXPENSE', true, (SELECT id FROM org_data), NOW(), NOW())
) AS t(id, code, name, account_type, is_system, organization_id, created_at, updated_at)
WHERE NOT EXISTS (
  SELECT 1 FROM accounts WHERE code = t.code AND organization_id = t.organization_id
);

-- トランザクションコミット
COMMIT;

-- 結果の確認
SELECT 'ユーザー数:' as label, COUNT(*) as count FROM users
UNION ALL
SELECT '組織数:', COUNT(*) FROM organizations
UNION ALL
SELECT 'ユーザー組織関連数:', COUNT(*) FROM user_organizations
UNION ALL
SELECT '会計期間数:', COUNT(*) FROM accounting_periods
UNION ALL
SELECT '勘定科目数:', COUNT(*) FROM accounts;

-- ログイン情報の表示
SELECT E'\n初期セットアップが完了しました！\nログイン情報:\n- Email: admin@example.com\n- Password: admin123' as message;