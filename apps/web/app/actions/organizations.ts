'use server';

import { z } from 'zod';

import { createClient, createServiceClient } from '@/lib/supabase/server';

const organizationUpdateSchema = z.object({
  name: z.string().min(1, '組織名は必須です'),
  taxId: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('有効なメールアドレスを入力してください').optional().or(z.literal('')),
});

type OrganizationUpdateData = z.infer<typeof organizationUpdateSchema>;

interface Organization {
  id: string;
  name: string;
  code: string;
  taxId?: string;
  address?: string;
  phone?: string;
  email?: string;
  _count?: {
    userOrganizations: number;
    accounts: number;
    journalEntries: number;
  };
}

interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function getCurrentOrganization(): Promise<ActionResult<Organization>> {
  try {
    const supabase = await createClient();

    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: '認証が必要です' };
    }

    // TODO: Implement actual organization fetching from Supabase
    // For now, return mock data to maintain compatibility
    const mockOrganization: Organization = {
      id: 'org-1',
      name: 'サンプル組織',
      code: 'ORG001',
      taxId: '',
      address: '',
      phone: '',
      email: '',
      _count: {
        userOrganizations: 1,
        accounts: 0,
        journalEntries: 0,
      },
    };

    return { success: true, data: mockOrganization };
  } catch (error) {
    console.error('Failed to fetch organization:', error);
    return { success: false, error: '組織情報の取得に失敗しました' };
  }
}

export async function updateOrganization(
  organizationId: string,
  data: OrganizationUpdateData
): Promise<ActionResult<Organization>> {
  try {
    const supabase = await createClient();

    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: '認証が必要です' };
    }

    // Validate input
    const validatedData = organizationUpdateSchema.parse(data);

    // TODO: Implement actual organization update in Supabase
    // For now, return mock data to maintain compatibility
    const updatedOrganization: Organization = {
      id: organizationId,
      name: validatedData.name,
      code: 'ORG001',
      taxId: validatedData.taxId,
      address: validatedData.address,
      phone: validatedData.phone,
      email: validatedData.email,
      _count: {
        userOrganizations: 1,
        accounts: 0,
        journalEntries: 0,
      },
    };

    return { success: true, data: updatedOrganization };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message || '入力値が不正です' };
    }
    console.error('Failed to update organization:', error);
    return { success: false, error: '組織情報の更新に失敗しました' };
  }
}

interface Member {
  id: string;
  email: string;
  name?: string;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
  joinedAt: string;
}

export async function getOrganizationMembers(
  _organizationId: string
): Promise<ActionResult<Member[]>> {
  try {
    const supabase = await createClient();

    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: '認証が必要です' };
    }

    // TODO: Implement actual member fetching from Supabase
    // For now, return empty array to maintain compatibility
    return { success: true, data: [] };
  } catch (error) {
    console.error('Failed to fetch organization members:', error);
    return { success: false, error: 'メンバー情報の取得に失敗しました' };
  }
}

export async function inviteOrganizationMember(
  _organizationId: string,
  _email: string,
  _role: 'ADMIN' | 'MEMBER' | 'VIEWER'
): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: '認証が必要です' };
    }

    // TODO: Implement actual member invitation in Supabase
    // For now, return success to maintain compatibility
    return { success: true };
  } catch (error) {
    console.error('Failed to invite member:', error);
    return { success: false, error: 'メンバーの招待に失敗しました' };
  }
}

export async function updateOrganizationMember(
  _organizationId: string,
  _userId: string,
  _role: 'ADMIN' | 'MEMBER' | 'VIEWER'
): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: '認証が必要です' };
    }

    // TODO: Implement actual member role update in Supabase
    // For now, return success to maintain compatibility
    return { success: true };
  } catch (error) {
    console.error('Failed to update member role:', error);
    return { success: false, error: 'メンバーロールの更新に失敗しました' };
  }
}

export async function removeOrganizationMember(
  _organizationId: string,
  _userId: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: '認証が必要です' };
    }

    // TODO: Implement actual member removal in Supabase
    // For now, return success to maintain compatibility
    return { success: true };
  } catch (error) {
    console.error('Failed to remove member:', error);
    return { success: false, error: 'メンバーの削除に失敗しました' };
  }
}

/**
 * Get user's organizations using Service Role Key
 * This bypasses RLS to avoid authentication issues with new Secret Key
 */
export interface OrganizationWithRole {
  id: string;
  name: string;
  code: string;
  role: 'admin' | 'accountant' | 'viewer';
  isDefault: boolean;
}

interface UserOrganization {
  organization_id: string;
  role: 'admin' | 'accountant' | 'viewer';
  is_default: boolean;
  organization: {
    id: string;
    name: string;
    code: string;
  };
}

export async function getUserOrganizations(
  userId: string
): Promise<ActionResult<OrganizationWithRole[]>> {
  try {
    // Use Service Role Key to bypass RLS
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('user_organizations')
      .select(
        `
        organization_id,
        role,
        is_default,
        organization:organizations (
          id,
          name,
          code
        )
      `
      )
      .eq('user_id', userId);

    if (error) {
      console.error('[getUserOrganizations] Error:', error);
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return { success: true, data: [] };
    }

    const organizations: OrganizationWithRole[] = (data as unknown as UserOrganization[]).map(
      (uo) => ({
        id: uo.organization.id,
        name: uo.organization.name,
        code: uo.organization.code,
        role: uo.role,
        isDefault: uo.is_default,
      })
    );

    return { success: true, data: organizations };
  } catch (error) {
    console.error('[getUserOrganizations] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get user's default organization using Service Role Key
 * This bypasses RLS and is used by middleware for authentication flow
 * Issue #553: Moved from middleware.ts to reduce attack surface
 */
export interface DefaultOrganization {
  organization_id: string;
  role: 'admin' | 'accountant' | 'viewer';
}

export async function getDefaultUserOrganization(
  userId: string
): Promise<ActionResult<DefaultOrganization>> {
  try {
    // Use Service Role Key to bypass RLS
    // This is critical for middleware authentication flow
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('user_organizations')
      .select('organization_id, role')
      .eq('user_id', userId)
      .eq('is_default', true)
      .single<DefaultOrganization>();

    if (error) {
      console.error('[getDefaultUserOrganization] Database error:', error);
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: 'Default organization not found' };
    }

    return { success: true, data };
  } catch (error) {
    console.error('[getDefaultUserOrganization] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
