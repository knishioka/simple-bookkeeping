'use server';

import { createClient } from '@/lib/supabase/server';

/**
 * 現在のユーザーの組織IDを取得
 * Server Actions内で使用するためのヘルパー関数
 */
export async function getCurrentOrganizationId(): Promise<string | null> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    // app_metadataから現在の組織IDを取得
    const currentOrganizationId = user.app_metadata?.current_organization_id;

    if (!currentOrganizationId) {
      // metadataに組織IDがない場合は、最初の組織を取得
      const { data: userOrgs } = await supabase
        .from('user_organizations')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      return userOrgs?.organization_id || null;
    }

    return currentOrganizationId;
  } catch (error) {
    console.error('Error getting current organization:', error);
    return null;
  }
}

/**
 * ユーザーの組織情報を取得
 */
export async function getUserOrganization() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    const organizationId = await getCurrentOrganizationId();

    if (!organizationId) {
      return null;
    }

    const { data: organization } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single();

    const { data: userOrg } = await supabase
      .from('user_organizations')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .single();

    return {
      ...organization,
      userRole: userOrg?.role,
    };
  } catch (error) {
    console.error('Error getting user organization:', error);
    return null;
  }
}
