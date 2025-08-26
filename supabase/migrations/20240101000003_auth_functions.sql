-- Auth-related functions and triggers

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_org_id UUID;
  org_name TEXT;
BEGIN
  -- Get organization name from metadata or use default
  org_name := COALESCE(NEW.raw_user_meta_data->>'organization_name', NEW.email);
  
  -- Create new organization for the user
  INSERT INTO public.organizations (name, created_at, updated_at)
  VALUES (org_name, NOW(), NOW())
  RETURNING id INTO new_org_id;
  
  -- Create user record in public schema
  INSERT INTO public.users (
    id,
    email,
    name,
    role,
    is_active,
    organization_id,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'admin', -- First user is always admin of their organization
    true,
    new_org_id,
    NOW(),
    NOW()
  );
  
  -- Update user metadata with organization info
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || 
    jsonb_build_object(
      'organizations', jsonb_build_array(
        jsonb_build_object(
          'id', new_org_id,
          'name', org_name,
          'role', 'admin',
          'isDefault', true
        )
      ),
      'current_organization_id', new_org_id,
      'current_role', 'admin'
    )
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to handle new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to switch user's organization
CREATE OR REPLACE FUNCTION public.switch_user_organization(
  new_organization_id UUID
)
RETURNS jsonb AS $$
DECLARE
  user_organizations jsonb;
  org_exists boolean;
  new_role text;
  current_user_id UUID;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Check if user has access to the organization
  SELECT COUNT(*) > 0 INTO org_exists
  FROM public.users u
  WHERE u.id = current_user_id
    AND u.organization_id = new_organization_id
    AND u.is_active = true;
  
  IF NOT org_exists THEN
    RAISE EXCEPTION 'User does not have access to this organization';
  END IF;
  
  -- Get user's role in the new organization
  SELECT u.role INTO new_role
  FROM public.users u
  WHERE u.id = current_user_id
    AND u.organization_id = new_organization_id;
  
  -- Update user's app metadata
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || 
    jsonb_build_object(
      'current_organization_id', new_organization_id,
      'current_role', new_role
    )
  WHERE id = current_user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'organization_id', new_organization_id,
    'role', new_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add user to organization
CREATE OR REPLACE FUNCTION public.add_user_to_organization(
  user_email TEXT,
  organization_id UUID,
  user_role TEXT DEFAULT 'viewer'
)
RETURNS jsonb AS $$
DECLARE
  target_user_id UUID;
  user_organizations jsonb;
  new_org jsonb;
  org_name TEXT;
BEGIN
  -- Check if current user has admin rights
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND organization_id = add_user_to_organization.organization_id
      AND role = 'admin'
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Only admins can add users to organization';
  END IF;
  
  -- Get user ID from email
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = user_email;
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Get organization name
  SELECT name INTO org_name
  FROM public.organizations
  WHERE id = add_user_to_organization.organization_id;
  
  -- Add user to organization in public schema
  INSERT INTO public.users (
    id,
    email,
    name,
    role,
    is_active,
    organization_id,
    created_at,
    updated_at
  )
  VALUES (
    target_user_id,
    user_email,
    split_part(user_email, '@', 1),
    user_role,
    true,
    add_user_to_organization.organization_id,
    NOW(),
    NOW()
  )
  ON CONFLICT (id, organization_id) 
  DO UPDATE SET
    role = EXCLUDED.role,
    is_active = true,
    updated_at = NOW();
  
  -- Get current organizations from user metadata
  SELECT COALESCE(raw_app_meta_data->'organizations', '[]'::jsonb)
  INTO user_organizations
  FROM auth.users
  WHERE id = target_user_id;
  
  -- Create new organization entry
  new_org := jsonb_build_object(
    'id', add_user_to_organization.organization_id,
    'name', org_name,
    'role', user_role,
    'isDefault', false
  );
  
  -- Add new organization to user's organizations list
  user_organizations := user_organizations || new_org;
  
  -- Update user metadata
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || 
    jsonb_build_object('organizations', user_organizations)
  WHERE id = target_user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'user_id', target_user_id,
    'organization_id', add_user_to_organization.organization_id,
    'role', user_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update user role in organization
CREATE OR REPLACE FUNCTION public.update_user_role(
  target_user_id UUID,
  organization_id UUID,
  new_role TEXT
)
RETURNS jsonb AS $$
BEGIN
  -- Check if current user has admin rights
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND organization_id = update_user_role.organization_id
      AND role = 'admin'
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Only admins can update user roles';
  END IF;
  
  -- Update user role
  UPDATE public.users
  SET role = new_role,
      updated_at = NOW()
  WHERE id = target_user_id
    AND organization_id = update_user_role.organization_id;
  
  -- Update user metadata if this is their current organization
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || 
    jsonb_build_object('current_role', new_role)
  WHERE id = target_user_id
    AND raw_app_meta_data->>'current_organization_id' = organization_id::text;
  
  RETURN jsonb_build_object(
    'success', true,
    'user_id', target_user_id,
    'role', new_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove user from organization
CREATE OR REPLACE FUNCTION public.remove_user_from_organization(
  target_user_id UUID,
  organization_id UUID
)
RETURNS jsonb AS $$
DECLARE
  user_organizations jsonb;
BEGIN
  -- Check if current user has admin rights
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND organization_id = remove_user_from_organization.organization_id
      AND role = 'admin'
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Only admins can remove users from organization';
  END IF;
  
  -- Soft delete user from organization
  UPDATE public.users
  SET is_active = false,
      updated_at = NOW()
  WHERE id = target_user_id
    AND organization_id = remove_user_from_organization.organization_id;
  
  -- Remove organization from user metadata
  SELECT raw_app_meta_data->'organizations'
  INTO user_organizations
  FROM auth.users
  WHERE id = target_user_id;
  
  -- Filter out the removed organization
  user_organizations := (
    SELECT jsonb_agg(org)
    FROM jsonb_array_elements(user_organizations) org
    WHERE org->>'id' != organization_id::text
  );
  
  -- Update user metadata
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || 
    jsonb_build_object('organizations', COALESCE(user_organizations, '[]'::jsonb))
  WHERE id = target_user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'user_id', target_user_id,
    'organization_id', remove_user_from_organization.organization_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's organizations
CREATE OR REPLACE FUNCTION public.get_user_organizations(
  user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT,
  user_role TEXT,
  is_active BOOLEAN,
  is_current BOOLEAN
) AS $$
DECLARE
  target_user_id UUID;
  current_org_id TEXT;
BEGIN
  -- Use provided user_id or current user
  target_user_id := COALESCE(user_id, auth.uid());
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Get current organization ID from metadata
  SELECT raw_app_meta_data->>'current_organization_id'
  INTO current_org_id
  FROM auth.users
  WHERE id = target_user_id;
  
  RETURN QUERY
  SELECT 
    o.id AS organization_id,
    o.name AS organization_name,
    u.role AS user_role,
    u.is_active,
    (o.id::text = current_org_id) AS is_current
  FROM public.users u
  JOIN public.organizations o ON o.id = u.organization_id
  WHERE u.id = target_user_id
    AND u.is_active = true
  ORDER BY o.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.switch_user_organization(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_user_to_organization(TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_role(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_user_from_organization(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_organizations(UUID) TO authenticated;
