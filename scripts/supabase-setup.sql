-- Supabase用の追加設定
-- Row Level Security (RLS) の有効化

-- 各テーブルのRLSを有効化
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JournalEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JournalEntryLine" ENABLE ROW LEVEL SECURITY;

-- 基本的なポリシーの作成（認証ユーザーのみアクセス可能）
CREATE POLICY "Users can view own data" ON "User"
    FOR SELECT USING (auth.uid()::text = id);

CREATE POLICY "Users can view their organization" ON "Organization"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM "User"
            WHERE "User".id = auth.uid()::text
            AND "User"."organizationId" = "Organization".id
        )
    );

-- 必要に応じて追加のポリシーを設定