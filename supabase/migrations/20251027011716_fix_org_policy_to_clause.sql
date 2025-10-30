-- Fix organizations RLS policy to include TO clause
-- Issue: Service role was not explicitly allowed to insert organizations

DROP POLICY IF EXISTS "Organizations: Authenticated users can create organizations" ON organizations;
CREATE POLICY "Organizations: Authenticated users can create organizations"
    ON organizations FOR INSERT
    TO authenticated, service_role
    WITH CHECK (true);
