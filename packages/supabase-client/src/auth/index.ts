import { createClient } from '@supabase/supabase-js';

import type { Database } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

// Re-export auth types
export type { User, Session };

// Organization and role types
export interface UserOrganization {
  id: string;
  name: string;
  role: 'admin' | 'accountant' | 'viewer';
  isDefault?: boolean;
}

export interface AuthUser extends User {
  organizations?: UserOrganization[];
  currentOrganizationId?: string;
  currentRole?: string;
}

// Auth error types
export class AuthError extends Error {
  constructor(
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// Auth utility functions
export const authUtils = {
  /**
   * Sign in with email and password
   */
  async signIn(
    email: string,
    password: string,
    supabase: ReturnType<typeof createClient<Database>>
  ) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new AuthError(error.message, error.status?.toString());
    }

    // Get user's organizations from app metadata
    const organizations = data.user?.app_metadata?.organizations as UserOrganization[] | undefined;
    const currentOrganizationId = data.user?.app_metadata?.current_organization_id as
      | string
      | undefined;
    const currentRole = data.user?.app_metadata?.current_role as string | undefined;

    return {
      user: {
        ...data.user,
        organizations,
        currentOrganizationId,
        currentRole,
      } as AuthUser,
      session: data.session,
    };
  },

  /**
   * Sign up new user
   */
  async signUp(
    email: string,
    password: string,
    organizationName: string,
    supabase: ReturnType<typeof createClient<Database>>
  ) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          organization_name: organizationName,
        },
      },
    });

    if (error) {
      throw new AuthError(error.message, error.status?.toString());
    }

    return { user: data.user, session: data.session };
  },

  /**
   * Sign out current user
   */
  async signOut(supabase: ReturnType<typeof createClient<Database>>) {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new AuthError(error.message, error.status?.toString());
    }
  },

  /**
   * Reset password
   */
  async resetPassword(email: string, supabase: ReturnType<typeof createClient<Database>>) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    if (error) {
      throw new AuthError(error.message, error.status?.toString());
    }
  },

  /**
   * Update password
   */
  async updatePassword(newPassword: string, supabase: ReturnType<typeof createClient<Database>>) {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      throw new AuthError(error.message, error.status?.toString());
    }
  },

  /**
   * Get current session
   */
  async getSession(supabase: ReturnType<typeof createClient<Database>>) {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      throw new AuthError(error.message, error.status?.toString());
    }

    return data.session;
  },

  /**
   * Get current user
   */
  async getCurrentUser(
    supabase: ReturnType<typeof createClient<Database>>
  ): Promise<AuthUser | null> {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      if (error.message.includes('not authenticated')) {
        return null;
      }
      throw new AuthError(error.message, error.status?.toString());
    }

    if (!data.user) return null;

    // Get user's organizations from app metadata
    const organizations = data.user.app_metadata?.organizations as UserOrganization[] | undefined;
    const currentOrganizationId = data.user.app_metadata?.current_organization_id as
      | string
      | undefined;
    const currentRole = data.user.app_metadata?.current_role as string | undefined;

    return {
      ...data.user,
      organizations,
      currentOrganizationId,
      currentRole,
    };
  },

  /**
   * Switch organization for current user
   */
  async switchOrganization(
    organizationId: string,
    supabase: ReturnType<typeof createClient<Database>>
  ) {
    // Call RPC function to update user's current organization
    const { data, error } = await supabase.rpc('switch_user_organization', {
      new_organization_id: organizationId,
    });

    if (error) {
      throw new AuthError(error.message, error.code);
    }

    // Refresh session to get updated JWT with new organization
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      throw new AuthError(refreshError.message, refreshError.status?.toString());
    }

    return data;
  },

  /**
   * Check if user has permission for a specific action
   */
  hasPermission(user: AuthUser | null, requiredRole: 'admin' | 'accountant' | 'viewer'): boolean {
    if (!user || !user.currentRole) return false;

    const roleHierarchy = {
      admin: 3,
      accountant: 2,
      viewer: 1,
    };

    const userRoleLevel = roleHierarchy[user.currentRole as keyof typeof roleHierarchy] || 0;
    const requiredRoleLevel = roleHierarchy[requiredRole] || 0;

    return userRoleLevel >= requiredRoleLevel;
  },

  /**
   * Verify email with OTP
   */
  async verifyEmail(
    email: string,
    token: string,
    supabase: ReturnType<typeof createClient<Database>>
  ) {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });

    if (error) {
      throw new AuthError(error.message, error.status?.toString());
    }
  },
};
