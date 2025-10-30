-- Fix RLS policies for user signup (Safe version with IF NOT EXISTS)
-- Issue: New users cannot create organizations or user records due to restrictive RLS policies

-- Drop existing restrictive policies (only if they exist)
DROP POLICY IF EXISTS "Organizations: Only admins can insert" ON organizations;
DROP POLICY IF EXISTS "Users: Only admins can insert users" ON users;
DROP POLICY IF EXISTS "User orgs: Admins can manage relationships" ON user_organizations;

-- Organizations: Allow authenticated users and service role to create organizations during signup
-- Drop the old policy if it exists, then create new one
DROP POLICY IF EXISTS "Organizations: Authenticated users can create organizations" ON organizations;
CREATE POLICY "Organizations: Authenticated users can create organizations"
    ON organizations FOR INSERT
    TO authenticated, service_role
    WITH CHECK (true);

-- Users: Allow authenticated and service_role users to create their own user record
-- Drop the old policy if it exists, then create new one
DROP POLICY IF EXISTS "Users: Authenticated users can create their own profile" ON users;
CREATE POLICY "Users: Authenticated users can create their own profile"
    ON users FOR INSERT
    TO authenticated, service_role
    WITH CHECK (id = auth.uid() OR auth.role() = 'service_role');

-- User organizations: Allow authenticated users to create relationships for themselves
DROP POLICY IF EXISTS "User orgs: Users can create their own relationships" ON user_organizations;
CREATE POLICY "User orgs: Users can create their own relationships"
    ON user_organizations FOR INSERT
    TO authenticated, service_role
    WITH CHECK (user_id = auth.uid() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "User orgs: Admins can manage all relationships" ON user_organizations;
CREATE POLICY "User orgs: Admins can manage all relationships"
    ON user_organizations FOR UPDATE
    TO authenticated
    USING (
        public.has_role('admin'::user_role, organization_id) OR
        user_id = auth.uid()
    )
    WITH CHECK (
        public.has_role('admin'::user_role, organization_id) OR
        user_id = auth.uid()
    );

DROP POLICY IF EXISTS "User orgs: Admins can delete relationships" ON user_organizations;
CREATE POLICY "User orgs: Admins can delete relationships"
    ON user_organizations FOR DELETE
    TO authenticated
    USING (public.has_role('admin'::user_role, organization_id));
