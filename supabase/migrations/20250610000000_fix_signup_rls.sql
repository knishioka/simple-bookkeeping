-- Fix RLS policies for user signup
-- Issue: New users cannot create organizations or user records due to restrictive RLS policies

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Organizations: Only admins can insert" ON organizations;
DROP POLICY IF EXISTS "Users: Only admins can insert users" ON users;

-- Organizations: Allow authenticated users to create organizations during signup
CREATE POLICY "Organizations: Authenticated users can create organizations"
    ON organizations FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Users: Allow authenticated users to create their own user record
CREATE POLICY "Users: Authenticated users can create their own profile"
    ON users FOR INSERT
    TO authenticated
    WITH CHECK (id = auth.uid());

-- User organizations: Allow authenticated users to create relationships for themselves
DROP POLICY IF EXISTS "User orgs: Admins can manage relationships" ON user_organizations;

CREATE POLICY "User orgs: Users can create their own relationships"
    ON user_organizations FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

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

CREATE POLICY "User orgs: Admins can delete relationships"
    ON user_organizations FOR DELETE
    TO authenticated
    USING (public.has_role('admin'::user_role, organization_id));
