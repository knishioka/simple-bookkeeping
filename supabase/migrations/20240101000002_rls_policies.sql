-- Enable Row Level Security on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to get user's organization_id
CREATE OR REPLACE FUNCTION auth.organization_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT organization_id 
        FROM users 
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get user's role
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS user_role AS $$
BEGIN
    RETURN (
        SELECT role 
        FROM users 
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Organizations policies
CREATE POLICY "Users can view their own organization" 
    ON organizations FOR SELECT
    USING (id = auth.organization_id());

CREATE POLICY "Admins can update their organization" 
    ON organizations FOR UPDATE
    USING (id = auth.organization_id() AND auth.user_role() = 'admin');

-- Users policies
CREATE POLICY "Users can view users in their organization" 
    ON users FOR SELECT
    USING (organization_id = auth.organization_id());

CREATE POLICY "Admins can insert users in their organization" 
    ON users FOR INSERT
    WITH CHECK (organization_id = auth.organization_id() AND auth.user_role() = 'admin');

CREATE POLICY "Admins can update users in their organization" 
    ON users FOR UPDATE
    USING (organization_id = auth.organization_id() AND auth.user_role() = 'admin');

CREATE POLICY "Admins can delete users in their organization" 
    ON users FOR DELETE
    USING (organization_id = auth.organization_id() AND auth.user_role() = 'admin');

-- Accounting periods policies
CREATE POLICY "Users can view periods in their organization" 
    ON accounting_periods FOR SELECT
    USING (organization_id = auth.organization_id());

CREATE POLICY "Admins and accountants can insert periods" 
    ON accounting_periods FOR INSERT
    WITH CHECK (
        organization_id = auth.organization_id() 
        AND auth.user_role() IN ('admin', 'accountant')
    );

CREATE POLICY "Admins and accountants can update periods" 
    ON accounting_periods FOR UPDATE
    USING (
        organization_id = auth.organization_id() 
        AND auth.user_role() IN ('admin', 'accountant')
    );

CREATE POLICY "Admins can delete periods" 
    ON accounting_periods FOR DELETE
    USING (
        organization_id = auth.organization_id() 
        AND auth.user_role() = 'admin'
    );

-- Accounts policies
CREATE POLICY "Users can view accounts in their organization" 
    ON accounts FOR SELECT
    USING (organization_id = auth.organization_id());

CREATE POLICY "Admins and accountants can insert accounts" 
    ON accounts FOR INSERT
    WITH CHECK (
        organization_id = auth.organization_id() 
        AND auth.user_role() IN ('admin', 'accountant')
    );

CREATE POLICY "Admins and accountants can update accounts" 
    ON accounts FOR UPDATE
    USING (
        organization_id = auth.organization_id() 
        AND auth.user_role() IN ('admin', 'accountant')
    );

CREATE POLICY "Admins can delete accounts" 
    ON accounts FOR DELETE
    USING (
        organization_id = auth.organization_id() 
        AND auth.user_role() = 'admin'
    );

-- Partners policies
CREATE POLICY "Users can view partners in their organization" 
    ON partners FOR SELECT
    USING (organization_id = auth.organization_id());

CREATE POLICY "Admins and accountants can insert partners" 
    ON partners FOR INSERT
    WITH CHECK (
        organization_id = auth.organization_id() 
        AND auth.user_role() IN ('admin', 'accountant')
    );

CREATE POLICY "Admins and accountants can update partners" 
    ON partners FOR UPDATE
    USING (
        organization_id = auth.organization_id() 
        AND auth.user_role() IN ('admin', 'accountant')
    );

CREATE POLICY "Admins can delete partners" 
    ON partners FOR DELETE
    USING (
        organization_id = auth.organization_id() 
        AND auth.user_role() = 'admin'
    );

-- Journal entries policies
CREATE POLICY "Users can view journal entries in their organization" 
    ON journal_entries FOR SELECT
    USING (organization_id = auth.organization_id());

CREATE POLICY "Admins and accountants can insert journal entries" 
    ON journal_entries FOR INSERT
    WITH CHECK (
        organization_id = auth.organization_id() 
        AND auth.user_role() IN ('admin', 'accountant')
        AND created_by = auth.uid()
    );

CREATE POLICY "Admins and accountants can update their draft entries" 
    ON journal_entries FOR UPDATE
    USING (
        organization_id = auth.organization_id() 
        AND auth.user_role() IN ('admin', 'accountant')
        AND (status = 'draft' OR auth.user_role() = 'admin')
    );

CREATE POLICY "Admins can delete draft entries" 
    ON journal_entries FOR DELETE
    USING (
        organization_id = auth.organization_id() 
        AND auth.user_role() = 'admin'
        AND status = 'draft'
    );

-- Journal entry lines policies
CREATE POLICY "Users can view entry lines for entries they can see" 
    ON journal_entry_lines FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM journal_entries je
            WHERE je.id = journal_entry_lines.journal_entry_id
            AND je.organization_id = auth.organization_id()
        )
    );

CREATE POLICY "Users can insert lines for entries they can edit" 
    ON journal_entry_lines FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM journal_entries je
            WHERE je.id = journal_entry_lines.journal_entry_id
            AND je.organization_id = auth.organization_id()
            AND auth.user_role() IN ('admin', 'accountant')
            AND (je.status = 'draft' OR auth.user_role() = 'admin')
        )
    );

CREATE POLICY "Users can update lines for entries they can edit" 
    ON journal_entry_lines FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM journal_entries je
            WHERE je.id = journal_entry_lines.journal_entry_id
            AND je.organization_id = auth.organization_id()
            AND auth.user_role() IN ('admin', 'accountant')
            AND (je.status = 'draft' OR auth.user_role() = 'admin')
        )
    );

CREATE POLICY "Users can delete lines for entries they can edit" 
    ON journal_entry_lines FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM journal_entries je
            WHERE je.id = journal_entry_lines.journal_entry_id
            AND je.organization_id = auth.organization_id()
            AND auth.user_role() IN ('admin', 'accountant')
            AND (je.status = 'draft' OR auth.user_role() = 'admin')
        )
    );

-- Audit logs policies (read-only for all users in organization)
CREATE POLICY "Users can view audit logs in their organization" 
    ON audit_logs FOR SELECT
    USING (organization_id = auth.organization_id());

-- Only system can insert audit logs (through service role or functions)
CREATE POLICY "System can insert audit logs" 
    ON audit_logs FOR INSERT
    WITH CHECK (true);

