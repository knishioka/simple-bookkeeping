'use server';

import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

import { withRateLimit, RATE_LIMIT_CONFIGS } from './utils/rate-limiter';

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

/**
 * Get current organization
 * Rate limited: 100 requests per minute
 */
export const getCurrentOrganization = withRateLimit(
  async function getCurrentOrganizationImpl(): Promise<ActionResult<Organization>> {
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
  },
  RATE_LIMIT_CONFIGS.READ
);

/**
 * Update organization
 * Rate limited: 30 requests per minute
 */
export const updateOrganization = withRateLimit(async function updateOrganizationImpl(
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
}, RATE_LIMIT_CONFIGS.UPDATE);

interface Member {
  id: string;
  email: string;
  name?: string;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
  joinedAt: string;
}

/**
 * Get organization members
 * Rate limited: 100 requests per minute
 */
export const getOrganizationMembers = withRateLimit(async function getOrganizationMembersImpl(
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
}, RATE_LIMIT_CONFIGS.READ);

/**
 * Invite organization member
 * Rate limited: 20 requests per minute
 */
export const inviteOrganizationMember = withRateLimit(async function inviteOrganizationMemberImpl(
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
}, RATE_LIMIT_CONFIGS.CREATE);

/**
 * Update organization member role
 * Rate limited: 30 requests per minute
 */
export const updateOrganizationMember = withRateLimit(async function updateOrganizationMemberImpl(
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
}, RATE_LIMIT_CONFIGS.UPDATE);

/**
 * Remove organization member
 * Rate limited: 5 requests per minute
 */
export const removeOrganizationMember = withRateLimit(async function removeOrganizationMemberImpl(
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
}, RATE_LIMIT_CONFIGS.DELETE);
