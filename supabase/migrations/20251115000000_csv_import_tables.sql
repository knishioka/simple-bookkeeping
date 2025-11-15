-- Create CSV Import Tables and RLS Policies

-- Create enum for import status
CREATE TYPE import_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Create import_history table
CREATE TABLE public.import_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  csv_format TEXT,
  total_rows INTEGER DEFAULT 0,
  imported_rows INTEGER DEFAULT 0,
  failed_rows INTEGER DEFAULT 0,
  status import_status DEFAULT 'pending',
  error_message TEXT,
  file_data JSONB, -- Store parsed CSV data temporarily
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create import_rules table
CREATE TABLE public.import_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  description_pattern TEXT NOT NULL,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  contra_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  confidence DECIMAL(3, 2) DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create csv_templates table
CREATE TABLE public.csv_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_name TEXT NOT NULL,
  template_name TEXT NOT NULL UNIQUE,
  column_mappings JSONB NOT NULL,
  date_format TEXT NOT NULL DEFAULT 'YYYY-MM-DD',
  amount_column TEXT NOT NULL,
  description_column TEXT NOT NULL,
  type_column TEXT,
  balance_column TEXT,
  skip_rows INTEGER DEFAULT 0,
  encoding TEXT DEFAULT 'UTF-8',
  delimiter TEXT DEFAULT ',',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_import_history_organization_id ON public.import_history(organization_id);
CREATE INDEX idx_import_history_user_id ON public.import_history(user_id);
CREATE INDEX idx_import_history_status ON public.import_history(status);
CREATE INDEX idx_import_history_created_at ON public.import_history(created_at DESC);

CREATE INDEX idx_import_rules_organization_id ON public.import_rules(organization_id);
CREATE INDEX idx_import_rules_description_pattern ON public.import_rules(description_pattern);
CREATE INDEX idx_import_rules_account_id ON public.import_rules(account_id);
CREATE INDEX idx_import_rules_is_active ON public.import_rules(is_active);

CREATE INDEX idx_csv_templates_bank_name ON public.csv_templates(bank_name);
CREATE INDEX idx_csv_templates_template_name ON public.csv_templates(template_name);
CREATE INDEX idx_csv_templates_is_active ON public.csv_templates(is_active);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_import_history_updated_at BEFORE UPDATE ON public.import_history
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_import_rules_updated_at BEFORE UPDATE ON public.import_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_csv_templates_updated_at BEFORE UPDATE ON public.csv_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies for import_history table
ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization's import history"
  ON public.import_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE user_organizations.user_id = auth.uid()
        AND user_organizations.organization_id = import_history.organization_id
    )
  );

CREATE POLICY "Users can insert import history for their organization"
  ON public.import_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE user_organizations.user_id = auth.uid()
        AND user_organizations.organization_id = import_history.organization_id
    )
  );

CREATE POLICY "Users can update their own import history"
  ON public.import_history FOR UPDATE
  USING (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE user_organizations.user_id = auth.uid()
        AND user_organizations.organization_id = import_history.organization_id
    )
  );

CREATE POLICY "Users can delete their own import history"
  ON public.import_history FOR DELETE
  USING (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE user_organizations.user_id = auth.uid()
        AND user_organizations.organization_id = import_history.organization_id
    )
  );

-- RLS Policies for import_rules table
ALTER TABLE public.import_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization's import rules"
  ON public.import_rules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE user_organizations.user_id = auth.uid()
        AND user_organizations.organization_id = import_rules.organization_id
    )
  );

CREATE POLICY "Admin users can insert import rules for their organization"
  ON public.import_rules FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE user_organizations.user_id = auth.uid()
        AND user_organizations.organization_id = import_rules.organization_id
        AND user_organizations.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admin users can update import rules for their organization"
  ON public.import_rules FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE user_organizations.user_id = auth.uid()
        AND user_organizations.organization_id = import_rules.organization_id
        AND user_organizations.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admin users can delete import rules for their organization"
  ON public.import_rules FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE user_organizations.user_id = auth.uid()
        AND user_organizations.organization_id = import_rules.organization_id
        AND user_organizations.role IN ('owner', 'admin')
    )
  );

-- RLS Policies for csv_templates table (read-only for all authenticated users)
ALTER TABLE public.csv_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view CSV templates"
  ON public.csv_templates FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Insert default CSV templates
INSERT INTO public.csv_templates (bank_name, template_name, column_mappings, date_format, amount_column, description_column, type_column, encoding) VALUES
-- 楽天銀行
('楽天銀行', 'rakuten_bank',
  '{"date": "取引日", "description": "摘要", "amount": "金額", "balance": "残高", "type": "入出金区分"}',
  'YYYY/MM/DD', '金額', '摘要', '入出金区分', 'Shift-JIS'),

-- 三菱UFJ銀行
('三菱UFJ銀行', 'mufg_bank',
  '{"date": "日付", "description": "摘要", "amount": "金額", "balance": "残高", "deposit": "入金額", "withdrawal": "出金額"}',
  'YYYY/MM/DD', '金額', '摘要', NULL, 'Shift-JIS'),

-- みずほ銀行
('みずほ銀行', 'mizuho_bank',
  '{"date": "取引日", "description": "お取引内容", "amount": "金額", "balance": "残高", "deposit": "入金", "withdrawal": "出金"}',
  'YYYY/MM/DD', '金額', 'お取引内容', NULL, 'Shift-JIS'),

-- 三井住友銀行
('三井住友銀行', 'smbc_bank',
  '{"date": "日付", "description": "内容", "amount": "金額", "balance": "残高", "deposit": "入金", "withdrawal": "出金"}',
  'YYYY/MM/DD', '金額', '内容', NULL, 'Shift-JIS'),

-- ゆうちょ銀行
('ゆうちょ銀行', 'jp_bank',
  '{"date": "取扱日", "description": "摘要", "amount": "金額", "balance": "残高", "deposit": "預入金額", "withdrawal": "払出金額"}',
  'YYYY/MM/DD', '金額', '摘要', NULL, 'Shift-JIS'),

-- 住信SBIネット銀行
('住信SBIネット銀行', 'sbi_bank',
  '{"date": "日付", "description": "内容", "amount": "金額", "balance": "残高", "type": "入出金"}',
  'YYYY/MM/DD', '金額', '内容', '入出金', 'UTF-8'),

-- 楽天カード
('楽天カード', 'rakuten_card',
  '{"date": "利用日", "description": "利用店名・商品名", "amount": "利用金額", "payment_method": "支払方法", "count": "支払回数"}',
  'YYYY/MM/DD', '利用金額', '利用店名・商品名', NULL, 'Shift-JIS'),

-- 三井住友カード
('三井住友カード', 'smbc_card',
  '{"date": "利用日", "description": "利用先", "amount": "利用金額", "payment_method": "支払区分"}',
  'YYYY/MM/DD', '利用金額', '利用先', NULL, 'Shift-JIS'),

-- Generic CSV format
('汎用', 'generic',
  '{"date": "date", "description": "description", "amount": "amount", "type": "type", "debit": "debit", "credit": "credit"}',
  'YYYY-MM-DD', 'amount', 'description', 'type', 'UTF-8');

-- Add comments for documentation
COMMENT ON TABLE public.import_history IS 'CSV import history and status tracking';
COMMENT ON TABLE public.import_rules IS 'Mapping rules for automatic account assignment';
COMMENT ON TABLE public.csv_templates IS 'Bank-specific CSV format templates';

COMMENT ON COLUMN public.import_history.status IS 'Current status of the import operation';
COMMENT ON COLUMN public.import_history.file_data IS 'Temporary storage of parsed CSV data during processing';
COMMENT ON COLUMN public.import_rules.description_pattern IS 'Regex or keyword pattern to match transaction descriptions';
COMMENT ON COLUMN public.import_rules.confidence IS 'Confidence score for this rule (0-1)';
COMMENT ON COLUMN public.csv_templates.column_mappings IS 'JSON mapping of CSV column names to internal field names';
