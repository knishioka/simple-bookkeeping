-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to get user's organization IDs
CREATE OR REPLACE FUNCTION auth.user_organization_ids()
RETURNS UUID[]
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT ARRAY(
        SELECT organization_id 
        FROM user_organizations 
        WHERE user_id = auth.uid()
        
        UNION
        
        SELECT organization_id 
        FROM users 
        WHERE id = auth.uid()
    );
$$;

-- Helper function to get user's role in an organization
CREATE OR REPLACE FUNCTION auth.user_role_in_organization(org_id UUID)
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT 
        CASE 
            WHEN uo.role IS NOT NULL THEN uo.role
            ELSE u.role
        END
    FROM users u
    LEFT JOIN user_organizations uo ON u.id = uo.user_id AND uo.organization_id = org_id
    WHERE u.id = auth.uid()
    LIMIT 1;
$$;

-- Helper function to check if user has specific role
CREATE OR REPLACE FUNCTION auth.has_role(required_role user_role, org_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    user_role_value user_role;
BEGIN
    -- If org_id is provided, check role in that organization
    IF org_id IS NOT NULL THEN
        user_role_value := auth.user_role_in_organization(org_id);
    ELSE
        -- Otherwise, check user's default role
        SELECT role INTO user_role_value
        FROM users
        WHERE id = auth.uid();
    END IF;
    
    -- Role hierarchy: admin > accountant > viewer
    RETURN CASE required_role
        WHEN 'viewer' THEN user_role_value IN ('viewer', 'accountant', 'admin')
        WHEN 'accountant' THEN user_role_value IN ('accountant', 'admin')
        WHEN 'admin' THEN user_role_value = 'admin'
        ELSE FALSE
    END;
END;
$$;

-- Organizations policies
CREATE POLICY "Organizations: Users can view their own organizations"
    ON organizations FOR SELECT
    USING (id = ANY(auth.user_organization_ids()));

CREATE POLICY "Organizations: Only admins can insert"
    ON organizations FOR INSERT
    WITH CHECK (auth.has_role('admin'::user_role));

CREATE POLICY "Organizations: Only admins can update their organizations"
    ON organizations FOR UPDATE
    USING (id = ANY(auth.user_organization_ids()) AND auth.has_role('admin'::user_role, id))
    WITH CHECK (id = ANY(auth.user_organization_ids()) AND auth.has_role('admin'::user_role, id));

CREATE POLICY "Organizations: Only super admins can delete"
    ON organizations FOR DELETE
    USING (false); -- Prevent deletion through API

-- Users policies
CREATE POLICY "Users: Users can view users in their organization"
    ON users FOR SELECT
    USING (organization_id = ANY(auth.user_organization_ids()));

CREATE POLICY "Users: Users can view their own profile"
    ON users FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "Users: Only admins can insert users"
    ON users FOR INSERT
    WITH CHECK (auth.has_role('admin'::user_role, organization_id));

CREATE POLICY "Users: Users can update their own profile"
    ON users FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE POLICY "Users: Admins can update users in their organization"
    ON users FOR UPDATE
    USING (organization_id = ANY(auth.user_organization_ids()) AND auth.has_role('admin'::user_role, organization_id))
    WITH CHECK (organization_id = ANY(auth.user_organization_ids()) AND auth.has_role('admin'::user_role, organization_id));

-- User organizations policies
CREATE POLICY "User orgs: Users can view their own relationships"
    ON user_organizations FOR SELECT
    USING (user_id = auth.uid() OR organization_id = ANY(auth.user_organization_ids()));

CREATE POLICY "User orgs: Admins can manage relationships"
    ON user_organizations FOR ALL
    USING (auth.has_role('admin'::user_role, organization_id))
    WITH CHECK (auth.has_role('admin'::user_role, organization_id));

-- Accounting periods policies
CREATE POLICY "Periods: Users can view periods in their organization"
    ON accounting_periods FOR SELECT
    USING (organization_id = ANY(auth.user_organization_ids()));

CREATE POLICY "Periods: Accountants can insert periods"
    ON accounting_periods FOR INSERT
    WITH CHECK (organization_id = ANY(auth.user_organization_ids()) AND auth.has_role('accountant'::user_role, organization_id));

CREATE POLICY "Periods: Accountants can update periods"
    ON accounting_periods FOR UPDATE
    USING (organization_id = ANY(auth.user_organization_ids()) AND auth.has_role('accountant'::user_role, organization_id))
    WITH CHECK (organization_id = ANY(auth.user_organization_ids()) AND auth.has_role('accountant'::user_role, organization_id));

CREATE POLICY "Periods: Admins can delete periods"
    ON accounting_periods FOR DELETE
    USING (organization_id = ANY(auth.user_organization_ids()) AND auth.has_role('admin'::user_role, organization_id));

-- Accounts policies
CREATE POLICY "Accounts: Users can view accounts in their organization"
    ON accounts FOR SELECT
    USING (organization_id = ANY(auth.user_organization_ids()));

CREATE POLICY "Accounts: Accountants can insert accounts"
    ON accounts FOR INSERT
    WITH CHECK (organization_id = ANY(auth.user_organization_ids()) AND auth.has_role('accountant'::user_role, organization_id));

CREATE POLICY "Accounts: Accountants can update accounts"
    ON accounts FOR UPDATE
    USING (organization_id = ANY(auth.user_organization_ids()) AND auth.has_role('accountant'::user_role, organization_id))
    WITH CHECK (organization_id = ANY(auth.user_organization_ids()) AND auth.has_role('accountant'::user_role, organization_id));

CREATE POLICY "Accounts: Admins can delete accounts"
    ON accounts FOR DELETE
    USING (organization_id = ANY(auth.user_organization_ids()) AND auth.has_role('admin'::user_role, organization_id) AND is_system_account = false);

-- Partners policies
CREATE POLICY "Partners: Users can view partners in their organization"
    ON partners FOR SELECT
    USING (organization_id = ANY(auth.user_organization_ids()));

CREATE POLICY "Partners: Accountants can manage partners"
    ON partners FOR INSERT
    WITH CHECK (organization_id = ANY(auth.user_organization_ids()) AND auth.has_role('accountant'::user_role, organization_id));

CREATE POLICY "Partners: Accountants can update partners"
    ON partners FOR UPDATE
    USING (organization_id = ANY(auth.user_organization_ids()) AND auth.has_role('accountant'::user_role, organization_id))
    WITH CHECK (organization_id = ANY(auth.user_organization_ids()) AND auth.has_role('accountant'::user_role, organization_id));

CREATE POLICY "Partners: Admins can delete partners"
    ON partners FOR DELETE
    USING (organization_id = ANY(auth.user_organization_ids()) AND auth.has_role('admin'::user_role, organization_id));

-- Journal entries policies
CREATE POLICY "Journal: Users can view entries in their organization"
    ON journal_entries FOR SELECT
    USING (organization_id = ANY(auth.user_organization_ids()));

CREATE POLICY "Journal: Accountants can create entries"
    ON journal_entries FOR INSERT
    WITH CHECK (organization_id = ANY(auth.user_organization_ids()) AND auth.has_role('accountant'::user_role, organization_id));

CREATE POLICY "Journal: Accountants can update draft entries"
    ON journal_entries FOR UPDATE
    USING (
        organization_id = ANY(auth.user_organization_ids()) 
        AND auth.has_role('accountant'::user_role, organization_id)
        AND status = 'draft'
    )
    WITH CHECK (
        organization_id = ANY(auth.user_organization_ids()) 
        AND auth.has_role('accountant'::user_role, organization_id)
    );

CREATE POLICY "Journal: Admins can delete draft entries"
    ON journal_entries FOR DELETE
    USING (
        organization_id = ANY(auth.user_organization_ids()) 
        AND auth.has_role('admin'::user_role, organization_id)
        AND status = 'draft'
    );

-- Journal entry lines policies
CREATE POLICY "Lines: Users can view lines of accessible entries"
    ON journal_entry_lines FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM journal_entries je
            WHERE je.id = journal_entry_lines.journal_entry_id
            AND je.organization_id = ANY(auth.user_organization_ids())
        )
    );

CREATE POLICY "Lines: Accountants can manage lines"
    ON journal_entry_lines FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM journal_entries je
            WHERE je.id = journal_entry_lines.journal_entry_id
            AND je.organization_id = ANY(auth.user_organization_ids())
            AND auth.has_role('accountant'::user_role, je.organization_id)
            AND je.status = 'draft'
        )
    );

CREATE POLICY "Lines: Accountants can update lines of draft entries"
    ON journal_entry_lines FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM journal_entries je
            WHERE je.id = journal_entry_lines.journal_entry_id
            AND je.organization_id = ANY(auth.user_organization_ids())
            AND auth.has_role('accountant'::user_role, je.organization_id)
            AND je.status = 'draft'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM journal_entries je
            WHERE je.id = journal_entry_lines.journal_entry_id
            AND je.organization_id = ANY(auth.user_organization_ids())
            AND auth.has_role('accountant'::user_role, je.organization_id)
            AND je.status = 'draft'
        )
    );

CREATE POLICY "Lines: Admins can delete lines of draft entries"
    ON journal_entry_lines FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM journal_entries je
            WHERE je.id = journal_entry_lines.journal_entry_id
            AND je.organization_id = ANY(auth.user_organization_ids())
            AND auth.has_role('admin'::user_role, je.organization_id)
            AND je.status = 'draft'
        )
    );

-- Audit logs policies
CREATE POLICY "Audit: Users can view audit logs in their organization"
    ON audit_logs FOR SELECT
    USING (organization_id = ANY(auth.user_organization_ids()) AND auth.has_role('admin'::user_role, organization_id));

CREATE POLICY "Audit: System can insert audit logs"
    ON audit_logs FOR INSERT
    WITH CHECK (organization_id = ANY(auth.user_organization_ids()));

-- Audit logs should not be updated or deleted
-- No UPDATE or DELETE policies
