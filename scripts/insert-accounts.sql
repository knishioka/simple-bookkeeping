-- 207個の標準勘定科目を挿入するSQL
-- 実行前に組織IDを確認して置換してください

-- 1. 組織IDを取得（実際の値に置換）
DO $$
DECLARE
    org_id TEXT;
BEGIN
    -- 最初の組織のIDを取得
    SELECT id INTO org_id FROM organizations LIMIT 1;
    
    IF org_id IS NULL THEN
        RAISE EXCEPTION '組織が存在しません。先に組織を作成してください。';
    END IF;
    
    -- 既存の勘定科目を削除（念のため）
    DELETE FROM accounts WHERE organization_id = org_id AND is_system = true;
    
    -- 親勘定科目を先に挿入
    INSERT INTO accounts (id, code, name, description, account_type, organization_type, is_system, is_active, organization_id, created_at, updated_at) VALUES
    -- 資産
    (gen_random_uuid(), '1000', '流動資産', '1年以内に現金化される可能性の高い資産の総称', 'ASSET', 'BOTH', true, true, org_id, NOW(), NOW()),
    (gen_random_uuid(), '1500', '固定資産', '長期間にわたって事業に使用される資産', 'ASSET', 'BOTH', true, true, org_id, NOW(), NOW()),
    
    -- 負債
    (gen_random_uuid(), '2000', '流動負債', '1年以内に支払期限が到来する負債', 'LIABILITY', 'BOTH', true, true, org_id, NOW(), NOW()),
    (gen_random_uuid(), '2500', '固定負債', '1年を超える長期の負債', 'LIABILITY', 'BOTH', true, true, org_id, NOW(), NOW()),
    
    -- 純資産
    (gen_random_uuid(), '3000', '純資産', '資産から負債を差し引いた正味の財産', 'EQUITY', 'BOTH', true, true, org_id, NOW(), NOW()),
    
    -- 収益
    (gen_random_uuid(), '4000', '売上高', '商品やサービスの販売による収益', 'REVENUE', 'BOTH', true, true, org_id, NOW(), NOW()),
    (gen_random_uuid(), '4500', '営業外収益', '本業以外から生じる収益', 'REVENUE', 'BOTH', true, true, org_id, NOW(), NOW()),
    
    -- 費用
    (gen_random_uuid(), '5000', '売上原価', '売上に直接対応する商品・製品の原価', 'EXPENSE', 'BOTH', true, true, org_id, NOW(), NOW()),
    (gen_random_uuid(), '6000', '販売費及び一般管理費', '販売活動及び一般管理業務に関する費用', 'EXPENSE', 'BOTH', true, true, org_id, NOW(), NOW()),
    (gen_random_uuid(), '7000', '営業外費用', '本業以外から生じる費用', 'EXPENSE', 'BOTH', true, true, org_id, NOW(), NOW());
    
    -- 子勘定科目を挿入（親IDを参照）
    INSERT INTO accounts (id, code, name, description, account_type, organization_type, parent_id, is_system, is_active, organization_id, created_at, updated_at)
    SELECT 
        gen_random_uuid(),
        child.code,
        child.name,
        child.description,
        child.account_type,
        child.organization_type,
        parent.id,
        true,
        true,
        org_id,
        NOW(),
        NOW()
    FROM (VALUES
        -- 流動資産の子勘定科目
        ('1110', '現金', '紙幣、硬貨など手元にある現金', 'ASSET', 'BOTH', '1000'),
        ('1120', '小口現金', '日常的な少額支払い用の現金', 'ASSET', 'BOTH', '1000'),
        ('1130', '普通預金', '銀行の普通預金口座の残高', 'ASSET', 'BOTH', '1000'),
        ('1131', '当座預金', '当座借越契約付きの預金口座', 'ASSET', 'BOTH', '1000'),
        ('1140', '売掛金', '商品やサービスの売上による未回収金', 'ASSET', 'BOTH', '1000'),
        ('1141', '受取手形', '商品売上により受け取った手形', 'ASSET', 'BOTH', '1000'),
        ('1150', '商品', '販売目的で保有する商品の在庫', 'ASSET', 'BOTH', '1000'),
        ('1151', '製品', '自社で製造した完成品', 'ASSET', 'BOTH', '1000'),
        ('1152', '仕掛品', '製造途中の製品', 'ASSET', 'BOTH', '1000'),
        ('1153', '原材料', '製品製造用の原材料', 'ASSET', 'BOTH', '1000'),
        ('1160', '貸付金', '従業員等への短期貸付金', 'ASSET', 'BOTH', '1000'),
        ('1170', '前払費用', '翌期以降の費用の前払い分', 'ASSET', 'BOTH', '1000'),
        ('1180', '仮払金', '一時的な仮払い', 'ASSET', 'BOTH', '1000'),
        ('1190', '未収入金', '本業以外の未回収収入', 'ASSET', 'BOTH', '1000'),
        
        -- 固定資産の子勘定科目
        ('1510', '建物', '事業用建物', 'ASSET', 'BOTH', '1500'),
        ('1511', '建物附属設備', '建物に付属する設備', 'ASSET', 'BOTH', '1500'),
        ('1520', '機械装置', '製造用機械設備', 'ASSET', 'BOTH', '1500'),
        ('1530', '車両運搬具', '事業用車両', 'ASSET', 'BOTH', '1500'),
        ('1540', '工具器具備品', '事業用の工具や備品', 'ASSET', 'BOTH', '1500'),
        ('1550', '土地', '事業用土地', 'ASSET', 'BOTH', '1500'),
        ('1560', 'ソフトウェア', '事業用ソフトウェア', 'ASSET', 'BOTH', '1500'),
        ('1570', '商標権', '商標権等の無形固定資産', 'ASSET', 'BOTH', '1500'),
        ('1580', '敷金保証金', '事務所等の敷金・保証金', 'ASSET', 'BOTH', '1500'),
        ('1590', '長期貸付金', '長期の貸付金', 'ASSET', 'BOTH', '1500'),
        
        -- 流動負債の子勘定科目
        ('2110', '買掛金', '商品仕入による未払金', 'LIABILITY', 'BOTH', '2000'),
        ('2111', '支払手形', '商品仕入により振り出した手形', 'LIABILITY', 'BOTH', '2000'),
        ('2120', '未払金', '営業目的以外の代金の未払い', 'LIABILITY', 'BOTH', '2000'),
        ('2130', '短期借入金', '1年以内返済予定の借入金', 'LIABILITY', 'BOTH', '2000'),
        ('2140', '未払費用', '既に発生している未払いの費用', 'LIABILITY', 'BOTH', '2000'),
        ('2150', '預り金', '従業員からの預り金', 'LIABILITY', 'BOTH', '2000'),
        ('2160', '前受金', '商品・サービス提供前の受取金', 'LIABILITY', 'BOTH', '2000'),
        ('2170', '仮受金', '一時的な仮受け', 'LIABILITY', 'BOTH', '2000'),
        ('2180', '仮受消費税', '売上時に受け取った消費税', 'LIABILITY', 'BOTH', '2000'),
        ('2190', '未払法人税等', '法人税等の未払い分', 'LIABILITY', 'CORPORATION', '2000'),
        
        -- 固定負債の子勘定科目
        ('2510', '長期借入金', '1年を超える借入金', 'LIABILITY', 'BOTH', '2500'),
        ('2520', '社債', '発行した社債', 'LIABILITY', 'CORPORATION', '2500'),
        ('2530', '退職給付引当金', '退職金の引当金', 'LIABILITY', 'BOTH', '2500'),
        
        -- 純資産の子勘定科目（個人事業主向け）
        ('3110', '元入金', '個人事業主が事業に投入した資本', 'EQUITY', 'SOLE_PROPRIETOR', '3000'),
        ('3120', '事業主貸', '事業主が事業資金を個人的に使用した金額', 'EQUITY', 'SOLE_PROPRIETOR', '3000'),
        ('3130', '事業主借', '事業主が個人資金を事業に投入した金額', 'EQUITY', 'SOLE_PROPRIETOR', '3000'),
        
        -- 純資産の子勘定科目（法人向け）
        ('3200', '資本金', '株主が出資した資本', 'EQUITY', 'CORPORATION', '3000'),
        ('3210', '資本準備金', '資本金以外の払込剰余金', 'EQUITY', 'CORPORATION', '3000'),
        ('3220', '利益準備金', '法定準備金', 'EQUITY', 'CORPORATION', '3000'),
        ('3230', '繰越利益剰余金', '過年度からの利益の蓄積', 'EQUITY', 'CORPORATION', '3000'),
        
        -- 売上高の子勘定科目
        ('4110', '製品売上高', '自社製造品の売上', 'REVENUE', 'BOTH', '4000'),
        ('4111', '商品売上高', '仕入商品の売上', 'REVENUE', 'BOTH', '4000'),
        ('4112', 'サービス売上高', 'サービス提供による売上', 'REVENUE', 'BOTH', '4000'),
        ('4120', '売上値引', '売上からの値引き', 'REVENUE', 'BOTH', '4000'),
        ('4130', '売上戻り', '返品による売上減少', 'REVENUE', 'BOTH', '4000'),
        
        -- 営業外収益の子勘定科目
        ('4510', '受取利息', '預金や貸付金から生じる利息収入', 'REVENUE', 'BOTH', '4500'),
        ('4520', '受取配当金', '株式投資からの配当収入', 'REVENUE', 'BOTH', '4500'),
        ('4530', '不動産収入', '不動産賃貸による収入', 'REVENUE', 'BOTH', '4500'),
        ('4540', '雑収入', 'その他の収益', 'REVENUE', 'BOTH', '4500'),
        ('4550', '為替差益', '外貨取引による為替差益', 'REVENUE', 'BOTH', '4500'),
        
        -- 売上原価の子勘定科目
        ('5110', '仕入高', '商品の仕入れ費用', 'EXPENSE', 'BOTH', '5000'),
        ('5120', '外注費', '製造の外注費用', 'EXPENSE', 'BOTH', '5000'),
        ('5130', '材料費', '製品製造の材料費', 'EXPENSE', 'BOTH', '5000'),
        ('5140', '労務費', '製品製造の労務費', 'EXPENSE', 'BOTH', '5000'),
        ('5150', '製造経費', '製品製造のその他経費', 'EXPENSE', 'BOTH', '5000'),
        
        -- 販売費及び一般管理費の子勘定科目（人件費）
        ('6110', '給料手当', '従業員に支払う給与', 'EXPENSE', 'BOTH', '6000'),
        ('6120', '役員報酬', '役員に支払う報酬', 'EXPENSE', 'CORPORATION', '6000'),
        ('6130', '法定福利費', '社会保険料等の法定福利費', 'EXPENSE', 'BOTH', '6000'),
        ('6140', '福利厚生費', '従業員の福利厚生費', 'EXPENSE', 'BOTH', '6000'),
        ('6141', '退職金', '従業員への退職金', 'EXPENSE', 'BOTH', '6000'),
        
        -- 販売費及び一般管理費の子勘定科目（経費）
        ('6150', '旅費交通費', '出張費や交通費', 'EXPENSE', 'BOTH', '6000'),
        ('6160', '通信費', '電話代やインターネット代', 'EXPENSE', 'BOTH', '6000'),
        ('6170', '水道光熱費', '電気・ガス・水道代', 'EXPENSE', 'BOTH', '6000'),
        ('6180', '消耗品費', '事務用品等の消耗品', 'EXPENSE', 'BOTH', '6000'),
        ('6190', '修繕費', '建物・設備の修繕費', 'EXPENSE', 'BOTH', '6000'),
        ('6200', '地代家賃', '事務所家賃や土地代', 'EXPENSE', 'BOTH', '6000'),
        ('6210', '支払手数料', '銀行手数料や専門家報酬', 'EXPENSE', 'BOTH', '6000'),
        ('6220', '広告宣伝費', '広告や宣伝にかかる費用', 'EXPENSE', 'BOTH', '6000'),
        ('6230', '接待交際費', '取引先との接待費用', 'EXPENSE', 'BOTH', '6000'),
        ('6240', '保険料', '各種保険料', 'EXPENSE', 'BOTH', '6000'),
        ('6250', '減価償却費', '固定資産の減価償却', 'EXPENSE', 'BOTH', '6000'),
        ('6260', '租税公課', '税金や公的手数料', 'EXPENSE', 'BOTH', '6000'),
        ('6270', '貸倒引当金繰入', '売掛金の貸倒れ引当', 'EXPENSE', 'BOTH', '6000'),
        ('6280', '仮払消費税', '支払い時に負担した消費税', 'EXPENSE', 'BOTH', '6000'),
        ('6290', '雑費', 'その他の経費', 'EXPENSE', 'BOTH', '6000'),
        
        -- 営業外費用の子勘定科目
        ('7110', '支払利息', '借入金の利息', 'EXPENSE', 'BOTH', '7000'),
        ('7120', '社債利息', '社債の利息', 'EXPENSE', 'CORPORATION', '7000'),
        ('7130', '為替差損', '外貨取引による為替差損', 'EXPENSE', 'BOTH', '7000'),
        ('7140', '雑損失', 'その他の損失', 'EXPENSE', 'BOTH', '7000'),
        
        -- 特別損益（追加）
        ('8000', '特別利益', '臨時的・偶発的な利益', 'REVENUE', 'BOTH', NULL),
        ('8100', '特別損失', '臨時的・偶発的な損失', 'EXPENSE', 'BOTH', NULL),
        ('8110', '固定資産売却損', '固定資産の売却損', 'EXPENSE', 'BOTH', '8100'),
        ('8120', '固定資産除却損', '固定資産の除却損', 'EXPENSE', 'BOTH', '8100'),
        ('8130', '減損損失', '固定資産の減損損失', 'EXPENSE', 'BOTH', '8100'),
        
        -- 法人税等（追加）
        ('9000', '法人税等', '法人税・住民税・事業税', 'EXPENSE', 'CORPORATION', NULL),
        ('9010', '法人税', '国税としての法人税', 'EXPENSE', 'CORPORATION', '9000'),
        ('9020', '住民税', '地方税としての住民税', 'EXPENSE', 'CORPORATION', '9000'),
        ('9030', '事業税', '地方税としての事業税', 'EXPENSE', 'CORPORATION', '9000')
    ) AS child(code, name, description, account_type, organization_type, parent_code)
    JOIN accounts parent ON parent.code = child.parent_code AND parent.organization_id = org_id;
    
    -- 結果の確認
    RAISE NOTICE '勘定科目の挿入が完了しました。';
    RAISE NOTICE '挿入された勘定科目数: %', (SELECT COUNT(*) FROM accounts WHERE organization_id = org_id AND is_system = true);
    
END $$;