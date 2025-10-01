/**
 * Users Data Access Layer
 * Handles user profile and authentication-related database operations
 */

import type { DALResult } from './base';
import type { Database } from '@simple-bookkeeping/database';

import { BaseDAL } from './base';

import { validatePasswordStrength } from '@/lib/password-strength';

type Profile = Database['public']['Tables']['profiles']['Row'];
type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

/**
 * User profile with additional auth data
 */
export interface UserProfile extends Profile {
  email?: string;
  emailVerified?: boolean;
  lastSignInAt?: string;
}

/**
 * Company member with company info from database query
 */
interface CompanyMemberWithCompany {
  company_id: string;
  role: string;
  joined_at: string;
  is_active: boolean;
  companies: {
    id: string;
    name: string;
  } | null;
}

/**
 * Audit log entry
 */
interface AuditLogEntry {
  id: string;
  user_id: string;
  action: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

/**
 * User company membership
 */
export interface UserCompanyMembership {
  companyId: string;
  companyName: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joinedAt: string;
  isActive: boolean;
}

/**
 * Users Data Access Layer
 */
export class UsersDAL extends BaseDAL<Profile> {
  constructor() {
    super({
      tableName: 'profiles',
      enableCache: true,
      cacheTimeout: 600000, // 10 minutes
    });
  }

  /**
   * Get current user's profile with auth data
   */
  async getCurrentUserProfile(): Promise<DALResult<UserProfile>> {
    return this.executeQuery<UserProfile>(async () => {
      const user = await this.getCurrentUser();
      const supabase = await this.getSupabase();

      // Get profile data
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError) return { data: null, error: profileError };

      // Enrich with auth data
      const typedProfile = profile as unknown as Profile;
      const enrichedProfile: UserProfile = {
        ...typedProfile,
        email: user.email,
        emailVerified: !!user.email_confirmed_at,
        lastSignInAt: user.last_sign_in_at,
      };

      return { data: enrichedProfile, error: null };
    });
  }

  /**
   * Update current user's profile
   */
  async updateCurrentUserProfile(data: ProfileUpdate): Promise<DALResult<Profile>> {
    const user = await this.getCurrentUser();
    return this.update(user.id, data);
  }

  /**
   * Get user's company memberships
   */
  async getUserCompanies(): Promise<DALResult<UserCompanyMembership[]>> {
    return this.executeQuery<UserCompanyMembership[]>(async () => {
      const user = await this.getCurrentUser();
      const supabase = await this.getSupabase();

      const { data, error } = await supabase
        .from('company_members')
        .select(
          `
            company_id,
            role,
            joined_at,
            is_active,
            companies (
              id,
              name
            )
          `
        )
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (error) return { data: null, error };

      const typedData = data as unknown as CompanyMemberWithCompany[];
      const memberships: UserCompanyMembership[] = (typedData || []).map((member) => ({
        companyId: member.company_id,
        companyName: member.companies?.name || '',
        role: member.role as UserCompanyMembership['role'],
        joinedAt: member.joined_at,
        isActive: member.is_active,
      }));

      return { data: memberships, error: null };
    });
  }

  /**
   * Check if user has permission for a company
   */
  async hasCompanyAccess(
    companyId: string,
    requiredRoles: Array<'owner' | 'admin' | 'member' | 'viewer'> = [
      'owner',
      'admin',
      'member',
      'viewer',
    ]
  ): Promise<boolean> {
    try {
      const user = await this.getCurrentUser();
      const supabase = await this.getSupabase();

      const { data, error } = await supabase
        .from('company_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('company_id', companyId)
        .eq('is_active', true)
        .single();

      if (error || !data) return false;

      const typedData = data as unknown as { role: string };
      return requiredRoles.includes(typedData.role as UserCompanyMembership['role']);
    } catch {
      return false;
    }
  }

  /**
   * Update user's password with strength validation
   */
  async updatePassword(currentPassword: string, newPassword: string): Promise<DALResult<boolean>> {
    try {
      const user = await this.getCurrentUser();
      const supabase = await this.getSupabase();

      if (!user.email) {
        return {
          data: false,
          error: new Error('User email is required'),
          success: false,
        };
      }

      // Validate current password
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError || !signInData.user) {
        return {
          data: false,
          error: new Error('Current password is incorrect'),
          success: false,
        };
      }

      // Validate new password strength
      const strengthResult = validatePasswordStrength(newPassword, [
        user.email || '',
        user.user_metadata?.full_name || '',
      ]);

      if (!strengthResult.isValid) {
        return {
          data: false,
          error: new Error(strengthResult.errors[0] || 'Password does not meet requirements'),
          success: false,
        };
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        return {
          data: false,
          error: new Error(updateError.message),
          success: false,
        };
      }

      return {
        data: true,
        error: null,
        success: true,
      };
    } catch (error) {
      return {
        data: false,
        error: error instanceof Error ? error : new Error('Failed to update password'),
        success: false,
      };
    }
  }

  /**
   * Delete user account (soft delete)
   */
  async deleteAccount(password: string): Promise<DALResult<boolean>> {
    try {
      const user = await this.getCurrentUser();
      const supabase = await this.getSupabase();

      if (!user.email) {
        return {
          data: false,
          error: new Error('User email is required'),
          success: false,
        };
      }

      // Verify password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });

      if (signInError) {
        return {
          data: false,
          error: new Error('Password verification failed'),
          success: false,
        };
      }

      // Soft delete profile
      const updateData = {
        deleted_at: new Date().toISOString(),
        is_active: false,
      } as Record<string, unknown>;
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData as never)
        .eq('user_id', user.id);

      if (updateError) {
        return {
          data: false,
          error: new Error('Failed to delete account'),
          success: false,
        };
      }

      // Sign out user
      await supabase.auth.signOut();

      return {
        data: true,
        error: null,
        success: true,
      };
    } catch (error) {
      return {
        data: false,
        error: error instanceof Error ? error : new Error('Failed to delete account'),
        success: false,
      };
    }
  }

  /**
   * Check if email is already in use
   */
  async isEmailInUse(email: string): Promise<boolean> {
    // This is intentionally vague to prevent user enumeration
    // In production, you might want to send an email instead of returning a boolean
    const supabase = await this.getSupabase();
    const { data } = await supabase
      .from('auth.users')
      .select('id')
      .eq('email', email.toLowerCase())
      .limit(1);

    return (data?.length ?? 0) > 0;
  }

  /**
   * Get user's activity log
   */
  async getUserActivityLog(limit: number = 50): Promise<DALResult<AuditLogEntry[]>> {
    return this.executeQuery<AuditLogEntry[]>(async () => {
      const user = await this.getCurrentUser();
      const supabase = await this.getSupabase();

      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      return { data: data || [], error };
    });
  }

  /**
   * Update user preferences
   */
  async updatePreferences(preferences: Record<string, unknown>): Promise<DALResult<Profile>> {
    const user = await this.getCurrentUser();

    return this.executeQuery<Profile>(async () => {
      const supabase = await this.getSupabase();
      const updateData = {
        preferences,
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>;
      const { data, error } = await supabase
        .from('profiles')
        .update(updateData as never)
        .eq('user_id', user.id)
        .select()
        .single();

      return { data, error };
    });
  }
}

// Export singleton instance
export const usersDAL = new UsersDAL();

export default UsersDAL;
