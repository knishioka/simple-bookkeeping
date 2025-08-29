-- Realtime Configuration
-- リアルタイム更新のためのPublication設定

-- デフォルトのpublicationが存在しない場合は作成
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END
$$;

-- リアルタイム更新を有効にするテーブルを追加
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS journal_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS journal_entry_lines;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS accounting_periods;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS organizations;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS file_metadata;

-- 通知用のトリガー関数
CREATE OR REPLACE FUNCTION notify_journal_entry_changes()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'journal_entry_changes',
    json_build_object(
      'operation', TG_OP,
      'organization_id', COALESCE(NEW.organization_id, OLD.organization_id),
      'record', COALESCE(NEW, OLD)
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 仕訳入力の変更通知トリガー
DROP TRIGGER IF EXISTS journal_entry_changes_trigger ON journal_entries;
CREATE TRIGGER journal_entry_changes_trigger
AFTER INSERT OR UPDATE OR DELETE ON journal_entries
FOR EACH ROW EXECUTE FUNCTION notify_journal_entry_changes();

-- ダッシュボード用の集計ビュー（リアルタイム更新対応）
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT
  je.organization_id,
  DATE_TRUNC('month', je.entry_date) as month,
  COUNT(DISTINCT je.id) as transaction_count,
  SUM(CASE 
    WHEN a.account_type = 'revenue' THEN jel.credit_amount - jel.debit_amount
    ELSE 0
  END) as total_revenue,
  SUM(CASE 
    WHEN a.account_type = 'expense' THEN jel.debit_amount - jel.credit_amount
    ELSE 0
  END) as total_expenses,
  SUM(CASE 
    WHEN a.account_type = 'revenue' THEN jel.credit_amount - jel.debit_amount
    WHEN a.account_type = 'expense' THEN -(jel.debit_amount - jel.credit_amount)
    ELSE 0
  END) as net_income
FROM journal_entries je
JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
JOIN accounts a ON jel.account_id = a.id
WHERE je.status = 'approved'
GROUP BY je.organization_id, DATE_TRUNC('month', je.entry_date);

-- プレゼンス管理用のテーブル
CREATE TABLE IF NOT EXISTS user_presence (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  channel_name TEXT NOT NULL,
  status TEXT DEFAULT 'online',
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for user_presence
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view presence in their organization"
ON user_presence FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_organizations
    WHERE user_id = auth.uid()
    AND organization_id = user_presence.organization_id
  )
);

CREATE POLICY "Users can update their own presence"
ON user_presence FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- インデックス
CREATE INDEX idx_user_presence_organization ON user_presence(organization_id);
CREATE INDEX idx_user_presence_user ON user_presence(user_id);
CREATE INDEX idx_user_presence_last_seen ON user_presence(last_seen);

-- 古いプレゼンスデータを自動削除する関数
CREATE OR REPLACE FUNCTION cleanup_old_presence()
RETURNS void AS $$
BEGIN
  DELETE FROM user_presence
  WHERE last_seen < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- 定期的なクリーンアップ（pg_cronが有効な場合）
-- SELECT cron.schedule('cleanup-presence', '*/15 * * * *', 'SELECT cleanup_old_presence();');

