# Row Level Security (RLS) Policies Documentation

## Overview

This document outlines all Row Level Security (RLS) policies implemented in the Supabase database for the Simple Bookkeeping application. RLS ensures that users can only access data they are authorized to see.

## RLS Implementation Status

### ✅ Tables with RLS Enabled

| Table               | RLS Status | Policy Count | Last Verified |
| ------------------- | ---------- | ------------ | ------------- |
| profiles            | ✅ Enabled | 4            | 2025-01-01    |
| accounts            | ✅ Enabled | 5            | 2025-01-01    |
| journal_entries     | ✅ Enabled | 5            | 2025-01-01    |
| journal_entry_items | ✅ Enabled | 5            | 2025-01-01    |
| fiscal_years        | ✅ Enabled | 5            | 2025-01-01    |
| companies           | ✅ Enabled | 5            | 2025-01-01    |
| company_members     | ✅ Enabled | 4            | 2025-01-01    |

### ⚠️ Tables Requiring Review

None - All tables have RLS enabled.

## Policy Definitions

### 1. profiles Table

**Purpose**: User profile information

```sql
-- SELECT: Users can only view their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: Users can create their own profile
CREATE POLICY "Users can create own profile" ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: Users cannot delete profiles (soft delete only)
CREATE POLICY "No profile deletion" ON profiles
  FOR DELETE
  USING (false);
```

### 2. accounts Table

**Purpose**: Chart of accounts for each company

```sql
-- SELECT: Users can view accounts for their companies
CREATE POLICY "Users can view company accounts" ON accounts
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid()
      AND (role = 'owner' OR role = 'admin' OR role = 'member')
    )
  );

-- INSERT: Only owners and admins can create accounts
CREATE POLICY "Admins can create accounts" ON accounts
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid()
      AND (role = 'owner' OR role = 'admin')
    )
  );

-- UPDATE: Only owners and admins can update accounts
CREATE POLICY "Admins can update accounts" ON accounts
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid()
      AND (role = 'owner' OR role = 'admin')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid()
      AND (role = 'owner' OR role = 'admin')
    )
  );

-- DELETE: Only owners can delete accounts
CREATE POLICY "Owners can delete accounts" ON accounts
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid()
      AND role = 'owner'
    )
  );

-- Prevent changing company_id
CREATE POLICY "Cannot change company_id" ON accounts
  FOR UPDATE
  USING (true)
  WITH CHECK (company_id = (SELECT company_id FROM accounts WHERE id = accounts.id));
```

### 3. journal_entries Table

**Purpose**: Journal entry headers

```sql
-- SELECT: Users can view entries for their companies
CREATE POLICY "Users can view company entries" ON journal_entries
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid()
    )
  );

-- INSERT: Members can create entries
CREATE POLICY "Members can create entries" ON journal_entries
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid()
    )
  );

-- UPDATE: Members can update their own entries, admins can update all
CREATE POLICY "Members can update entries" ON journal_entries
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid()
      AND (
        role IN ('owner', 'admin')
        OR (role = 'member' AND created_by = auth.uid())
      )
    )
  );

-- DELETE: Only admins can delete entries
CREATE POLICY "Admins can delete entries" ON journal_entries
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Audit trail: Track who created/updated
CREATE POLICY "Track entry creator" ON journal_entries
  FOR INSERT
  WITH CHECK (created_by = auth.uid());
```

### 4. companies Table

**Purpose**: Company information

```sql
-- SELECT: Users can view companies they belong to
CREATE POLICY "Users can view their companies" ON companies
  FOR SELECT
  USING (
    id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid()
    )
  );

-- INSERT: Any authenticated user can create a company
CREATE POLICY "Users can create companies" ON companies
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: Only owners can update company info
CREATE POLICY "Owners can update company" ON companies
  FOR UPDATE
  USING (
    id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid()
      AND role = 'owner'
    )
  );

-- DELETE: Only owners can delete companies
CREATE POLICY "Owners can delete company" ON companies
  FOR DELETE
  USING (
    id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid()
      AND role = 'owner'
    )
  );

-- Prevent unauthorized status changes
CREATE POLICY "Status change protection" ON companies
  FOR UPDATE
  USING (true)
  WITH CHECK (
    status IN ('active', 'suspended', 'closed')
    AND (
      status = 'active'
      OR id IN (
        SELECT company_id FROM company_members
        WHERE user_id = auth.uid()
        AND role = 'owner'
      )
    )
  );
```

### 5. company_members Table

**Purpose**: Company membership and roles

```sql
-- SELECT: Users can view members of their companies
CREATE POLICY "View company members" ON company_members
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_members cm
      WHERE cm.user_id = auth.uid()
    )
  );

-- INSERT: Only owners and admins can add members
CREATE POLICY "Admins can add members" ON company_members
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- UPDATE: Only owners can change roles
CREATE POLICY "Owners can change roles" ON company_members
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid()
      AND role = 'owner'
    )
  );

-- DELETE: Owners can remove members, members can remove themselves
CREATE POLICY "Member removal" ON company_members
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid()
      AND role = 'owner'
    )
  );
```

## Security Best Practices

### 1. auth.uid() Usage

- Always use `auth.uid()` to get the current user's ID
- Never trust client-provided user IDs
- Verify `auth.uid() IS NOT NULL` for authenticated-only operations

### 2. Company Membership Verification

```sql
-- Standard pattern for company access
company_id IN (
  SELECT company_id FROM company_members
  WHERE user_id = auth.uid()
  AND status = 'active' -- Optional: Check member status
)
```

### 3. Role-Based Access Control

```sql
-- Role hierarchy: owner > admin > member > viewer
role IN ('owner', 'admin') -- For administrative actions
role IN ('owner', 'admin', 'member') -- For data modification
role IS NOT NULL -- For read-only access
```

### 4. Preventing Data Leaks

- Use `WITH CHECK` clauses to validate INSERT/UPDATE operations
- Prevent modification of foreign keys that could leak data
- Implement audit trails with `created_by` and `updated_by` fields

### 5. Testing RLS Policies

```sql
-- Test as a specific user
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "user-uuid-here"}';

-- Run your queries
SELECT * FROM accounts;

-- Reset
RESET role;
RESET request.jwt.claims;
```

## Verification Script

Use this script to verify all RLS policies are properly configured:

```sql
-- Check RLS status for all tables
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Count policies per table
SELECT
  schemaname,
  tablename,
  COUNT(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- View all policies in detail
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

## Common Issues and Solutions

### Issue 1: Users can't access their own data

**Solution**: Check that `auth.uid()` is properly set and the user has a valid JWT token.

### Issue 2: RLS policies blocking all access

**Solution**: Verify that at least one policy allows the operation. Use `OR` conditions for multiple access paths.

### Issue 3: Performance degradation

**Solution**: Create indexes on columns used in RLS policies:

```sql
CREATE INDEX idx_company_members_user_id ON company_members(user_id);
CREATE INDEX idx_company_members_company_id ON company_members(company_id);
```

### Issue 4: Policy conflicts

**Solution**: Use explicit policy names and review the policy evaluation order. Permissive policies use OR logic, restrictive policies use AND logic.

## Monitoring and Auditing

### 1. Monitor Failed Access Attempts

```sql
-- Log failed RLS checks (requires custom logging)
CREATE OR REPLACE FUNCTION log_rls_failure()
RETURNS trigger AS $$
BEGIN
  INSERT INTO audit_log (
    table_name,
    user_id,
    action,
    denied_at
  ) VALUES (
    TG_TABLE_NAME,
    auth.uid(),
    TG_OP,
    NOW()
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. Regular Policy Review

- Review policies quarterly
- Test policies after schema changes
- Update policies when adding new features
- Document policy changes in migration files

## Migration Template

When creating new tables with RLS:

```sql
-- Create table
CREATE TABLE new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  user_id UUID REFERENCES auth.users(id),
  -- other columns
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view" ON new_table
  FOR SELECT
  USING (/* your condition */);

CREATE POLICY "Users can insert" ON new_table
  FOR INSERT
  WITH CHECK (/* your condition */);

CREATE POLICY "Users can update" ON new_table
  FOR UPDATE
  USING (/* your condition */)
  WITH CHECK (/* your condition */);

CREATE POLICY "Users can delete" ON new_table
  FOR DELETE
  USING (/* your condition */);

-- Create indexes for performance
CREATE INDEX idx_new_table_company_id ON new_table(company_id);
CREATE INDEX idx_new_table_user_id ON new_table(user_id);
```

## Compliance Notes

- All PII (Personally Identifiable Information) must be protected by RLS
- Financial data requires company membership verification
- Audit logs should be write-only (no UPDATE/DELETE policies)
- Comply with data residency requirements using RLS with geographic filters

---

Last Updated: 2025-01-01
Next Review: 2025-04-01
