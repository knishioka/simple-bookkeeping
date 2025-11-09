'use client';

import type { ActionResult } from '@/app/actions/types';
import type { User as SupabaseUser } from '@supabase/supabase-js';

import { useRouter } from 'next/navigation';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';

import { signIn, signOut, getCurrentUser } from '@/app/actions/auth';
import { createClient } from '@/lib/supabase/client';

interface Organization {
  id: string;
  name: string;
  code: string;
  role: 'admin' | 'accountant' | 'viewer';
  isDefault: boolean;
}

interface User {
  id: string;
  email: string;
  name: string;
  organizations: Organization[];
  currentOrganization?: Organization;
}

interface AuthUser {
  id: string;
  email: string;
  name?: string;
  organizationId?: string;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  currentOrganization: Organization | null;
  signIn: (email: string, password: string) => Promise<ActionResult<AuthUser>>;
  signOut: () => Promise<ActionResult<{ success: boolean }>>;
  // Backward compatibility aliases
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchOrganization: (organizationId: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);

  // Function to fetch and set user data
  const fetchUserData = useCallback(async (supabaseUser: SupabaseUser) => {
    // eslint-disable-next-line no-console
    console.info('[AuthContext] fetchUserData called for user:', supabaseUser.id);
    try {
      const supabase = createClient();

      // Define the type for the user organization with relations
      interface UserOrgWithRelations {
        id: string;
        role: 'admin' | 'accountant' | 'viewer';
        is_default: boolean;
        organization: {
          id: string;
          name: string;
          code: string;
        } | null;
      }

      // Get user's organizations
      // eslint-disable-next-line no-console
      console.info('[AuthContext] Fetching user organizations');
      const { data: userOrgs, error: orgsError } = await supabase
        .from('user_organizations')
        .select(
          `
          id,
          role,
          is_default,
          organization:organizations (
            id,
            name,
            code
          )
        `
        )
        .eq('user_id', supabaseUser.id)
        .returns<UserOrgWithRelations[]>();

      if (orgsError) {
        console.error('[AuthContext] Error fetching organizations:', orgsError);
      }

      // Get user's profile data
      // eslint-disable-next-line no-console
      console.info('[AuthContext] Fetching user profile');
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('name')
        .eq('id', supabaseUser.id)
        .single<{ name: string | null }>();

      if (userError) {
        console.error('[AuthContext] Error fetching user data:', userError);
      }

      const organizations: Organization[] =
        userOrgs
          ?.filter((userOrg) => userOrg.organization !== null)
          .map((userOrg) => {
            // We've filtered out null organizations above, so this is safe
            const org = userOrg.organization;
            if (!org) return null; // Type guard, will never happen
            return {
              id: org.id,
              name: org.name,
              code: org.code,
              role: userOrg.role,
              isDefault: userOrg.is_default,
            };
          })
          .filter((org): org is Organization => org !== null) || [];

      // Find default organization or use first one
      const defaultOrg = organizations.find((org) => org.isDefault) || organizations[0];

      const userInfo: User = {
        id: supabaseUser.id,
        email: supabaseUser.email || '',
        name: userData?.name || supabaseUser.user_metadata?.name || 'Unknown User',
        organizations,
        currentOrganization: defaultOrg,
      };

      // eslint-disable-next-line no-console
      console.info('[AuthContext] Setting user state with', organizations.length, 'organizations');
      setUser(userInfo);
      setCurrentOrganization(defaultOrg || null);
    } catch (error) {
      console.error('[AuthContext] Unexpected error in fetchUserData:', error);
      // Even if fetching additional data fails, set basic user info
      const basicUser: User = {
        id: supabaseUser.id,
        email: supabaseUser.email || '',
        name: supabaseUser.user_metadata?.name || 'Unknown User',
        organizations: [],
      };
      setUser(basicUser);
      setCurrentOrganization(null);
    }
  }, []);

  // Initialize auth state and listen for changes
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      // eslint-disable-next-line no-console
      console.info('[AuthContext] Starting auth initialization');
      try {
        const supabase = createClient();
        // eslint-disable-next-line no-console
        console.info('[AuthContext] Created Supabase client');

        // getUser()を使用してサーバー側で認証を検証（getSession()はクライアント側のCookieから直接取得するため安全でない）
        // タイムアウトを追加してハングを防ぐ（本番環境のネットワーク遅延を考慮して10秒に設定）
        // eslint-disable-next-line no-console
        console.info('[AuthContext] Calling getUser()...');
        const getUserPromise = supabase.auth.getUser();
        const timeoutPromise = new Promise<{ data: { user: null }; error: Error }>((_, reject) => {
          setTimeout(() => reject(new Error('getUser() timeout after 10s')), 10000);
        });

        let validatedUser = null;
        let error = null;

        try {
          const result = await Promise.race([getUserPromise, timeoutPromise]);
          validatedUser = result.data.user;
          error = result.error;
          // eslint-disable-next-line no-console
          console.info('[AuthContext] getUser completed successfully');
        } catch (timeoutError) {
          // タイムアウトまたはその他のエラー
          console.error('[AuthContext] getUser failed or timed out:', timeoutError);
          error = timeoutError instanceof Error ? timeoutError : new Error('Unknown error');
        }

        // eslint-disable-next-line no-console
        console.info('[AuthContext] getUser result:', {
          hasUser: !!validatedUser,
          email: validatedUser?.email,
          error: error?.message,
        });

        if (validatedUser && !error && mounted) {
          // eslint-disable-next-line no-console
          console.info('[AuthContext] Valid user found, fetching user data');
          await fetchUserData(validatedUser);
          // eslint-disable-next-line no-console
          console.info('[AuthContext] User data fetched successfully');
        } else if (mounted) {
          // ユーザーが認証されていない、またはエラーが発生した場合
          // eslint-disable-next-line no-console
          console.info('[AuthContext] No user or error, clearing state');
          setUser(null);
          setCurrentOrganization(null);
        }
      } catch (error) {
        console.error('[AuthContext] Error initializing auth:', error);
        // On error, set user to null to avoid blocking
        if (mounted) {
          setUser(null);
          setCurrentOrganization(null);
        }
      } finally {
        if (mounted) {
          // eslint-disable-next-line no-console
          console.info('[AuthContext] Setting loading to false');
          setLoading(false);
        }
      }
    };

    // Timeout fallback: Force loading to false after 5 seconds to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (mounted) {
        console.warn('[AuthContext] Timeout reached (5s), forcing loading to false');
        setLoading(false);
      }
    }, 5000);

    // Set up auth state change listener
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      // eslint-disable-next-line no-console
      console.info('[AuthContext] Auth state changed:', event);
      switch (event) {
        case 'SIGNED_IN':
        case 'TOKEN_REFRESHED':
          if (session?.user) {
            await fetchUserData(session.user);
          }
          break;
        case 'SIGNED_OUT':
          setUser(null);
          setCurrentOrganization(null);
          break;
        case 'USER_UPDATED':
          if (session?.user) {
            await fetchUserData(session.user);
          }
          break;
        default:
          break;
      }
    });

    // Initialize auth state
    initAuth();

    // Cleanup
    return () => {
      // eslint-disable-next-line no-console
      console.info('[AuthContext] Cleanup: unmounting');
      mounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  // Sign in function - delegates to Server Action
  const handleSignIn = async (email: string, password: string): Promise<ActionResult<AuthUser>> => {
    setLoading(true);
    try {
      const result = await signIn({ email, password });

      // If we reach here, signIn returned an error (redirect didn't happen)
      // Success case: redirect() throws and navigation happens automatically
      toast.error(result.error?.message || 'ログインに失敗しました');
      setLoading(false);
      return result;
    } catch (error) {
      // Unexpected exception (not a redirect)
      const errorMessage = error instanceof Error ? error.message : 'ログインに失敗しました';
      toast.error(errorMessage);
      setLoading(false);
      return {
        success: false,
        error: {
          code: 'LOGIN_ERROR',
          message: errorMessage,
        },
      };
    }
  };

  // Sign out function - delegates to Server Action
  const handleSignOut = async (): Promise<ActionResult<{ success: boolean }>> => {
    try {
      const result = await signOut();

      if (result.success) {
        // The auth state change listener will handle clearing the user state
        toast.success('ログアウトしました');
        router.push('/auth/login');
      } else {
        toast.error(result.error?.message || 'ログアウトに失敗しました');
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'ログアウトに失敗しました';
      toast.error(errorMessage);
      return {
        success: false,
        error: {
          code: 'LOGOUT_ERROR',
          message: errorMessage,
        },
      };
    }
  };

  // Switch organization
  const switchOrganization = async (organizationId: string) => {
    if (!user) return;

    const newOrg = user.organizations.find((org) => org.id === organizationId);
    if (!newOrg) {
      toast.error('組織が見つかりません');
      return;
    }

    try {
      const supabase = createClient();

      // Update default organization in database
      await supabase
        .from('user_organizations')
        // @ts-expect-error - Type inference issue with @supabase/supabase-js
        .update({ is_default: false })
        .eq('user_id', user.id);

      await supabase
        .from('user_organizations')
        // @ts-expect-error - Type inference issue with @supabase/supabase-js
        .update({ is_default: true })
        .eq('user_id', user.id)
        .eq('organization_id', organizationId);

      // Update local state
      const updatedOrganizations = user.organizations.map((org) => ({
        ...org,
        isDefault: org.id === organizationId,
      }));

      const updatedUser = {
        ...user,
        organizations: updatedOrganizations,
        currentOrganization: newOrg,
      };

      setUser(updatedUser);
      setCurrentOrganization(newOrg);

      toast.success(`${newOrg.name} に切り替えました`);

      // Refresh the page to reload data with new organization context
      router.refresh();
    } catch (error) {
      console.error('Failed to switch organization:', error);
      toast.error('組織の切り替えに失敗しました');
    }
  };

  // Refresh user data from server
  const refreshUser = async () => {
    try {
      const result = await getCurrentUser();

      if (result.success && result.data) {
        const supabase = createClient();
        const {
          data: { user: supabaseUser },
        } = await supabase.auth.getUser();

        if (supabaseUser) {
          await fetchUserData(supabaseUser);
        }
      } else {
        // User is not authenticated
        setUser(null);
        setCurrentOrganization(null);
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  // Backward compatibility wrapper for login
  const login = async (email: string, password: string): Promise<void> => {
    await handleSignIn(email, password);
  };

  // Backward compatibility wrapper for logout
  const logout = async (): Promise<void> => {
    await handleSignOut();
  };

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    currentOrganization,
    signIn: handleSignIn,
    signOut: handleSignOut,
    // Backward compatibility
    login,
    logout,
    switchOrganization,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
