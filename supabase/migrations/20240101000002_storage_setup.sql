-- Storage Buckets Setup
-- 領収書、レポート、添付ファイル用のストレージバケットを作成

-- 領収書バケット
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false, -- プライベートバケット
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- レポートバケット
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reports',
  'reports',
  false, -- プライベートバケット
  52428800, -- 50MB
  ARRAY['application/pdf', 'text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
) ON CONFLICT (id) DO NOTHING;

-- 添付ファイルバケット
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments',
  'attachments',
  false, -- プライベートバケット
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain', 'text/csv']
) ON CONFLICT (id) DO NOTHING;

-- RLS Policies for Storage

-- 領収書バケットのポリシー
CREATE POLICY "Users can upload their own receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'receipts' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their organization receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'receipts' AND
  EXISTS (
    SELECT 1 FROM user_organizations
    WHERE user_id = auth.uid()
    AND organization_id = (storage.foldername(name))[1]::uuid
  )
);

CREATE POLICY "Users can update their own receipts"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'receipts' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'receipts' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- レポートバケットのポリシー
CREATE POLICY "Users can upload reports for their organization"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'reports' AND
  EXISTS (
    SELECT 1 FROM user_organizations
    WHERE user_id = auth.uid()
    AND organization_id = (storage.foldername(name))[1]::uuid
    AND role IN ('admin', 'accountant')
  )
);

CREATE POLICY "Users can view their organization reports"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'reports' AND
  EXISTS (
    SELECT 1 FROM user_organizations
    WHERE user_id = auth.uid()
    AND organization_id = (storage.foldername(name))[1]::uuid
  )
);

-- 添付ファイルバケットのポリシー
CREATE POLICY "Users can manage attachments for their organization"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'attachments' AND
  EXISTS (
    SELECT 1 FROM user_organizations
    WHERE user_id = auth.uid()
    AND organization_id = (storage.foldername(name))[1]::uuid
  )
)
WITH CHECK (
  bucket_id = 'attachments' AND
  EXISTS (
    SELECT 1 FROM user_organizations
    WHERE user_id = auth.uid()
    AND organization_id = (storage.foldername(name))[1]::uuid
    AND role IN ('admin', 'accountant')
  )
);

-- ファイルメタデータテーブル
CREATE TABLE IF NOT EXISTS file_metadata (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  bucket_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  related_entity_type TEXT, -- 'journal_entry', 'account', etc.
  related_entity_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for file_metadata
ALTER TABLE file_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view files in their organization"
ON file_metadata FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_organizations
    WHERE user_id = auth.uid()
    AND organization_id = file_metadata.organization_id
  )
);

CREATE POLICY "Users can upload files to their organization"
ON file_metadata FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_organizations
    WHERE user_id = auth.uid()
    AND organization_id = file_metadata.organization_id
    AND role IN ('admin', 'accountant')
  )
);

-- インデックス
CREATE INDEX idx_file_metadata_organization ON file_metadata(organization_id);
CREATE INDEX idx_file_metadata_related_entity ON file_metadata(related_entity_type, related_entity_id);
CREATE INDEX idx_file_metadata_uploaded_by ON file_metadata(uploaded_by);

