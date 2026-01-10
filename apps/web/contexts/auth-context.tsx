'use client';

import type { ActionResult } from '@/app/actions/types';
import type { User as SupabaseUser } from '@supabase/supabase-js';

import { useRouter } from 'next/navigation';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';

import { signIn, signOut, getCurrentUser, getUserProfile } from '@/app/actions/auth';
import { getUserOrganizations } from '@/app/actions/organizations';
import { logger } from '@/lib/logger';
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
    try {
      // Get user's organizations using Server Action (bypasses RLS with Service Role Key)
      const orgResult = await getUserOrganizations(supabaseUser.id);

      if (!orgResult.success) {
        logger.error('[AuthContext] Error fetching organizations:', orgResult.error);
      }

      // Get user's profile data using Server Action (bypasses RLS)
      const profileResult = await getUserProfile(supabaseUser.id);

      if (!profileResult.success) {
        logger.error('[AuthContext] Error fetching user profile:', profileResult.error);
      }

      // Map organizations directly from Server Action response
      const organizations: Organization[] =
        orgResult.success && orgResult.data
          ? orgResult.data.map((org) => ({
              id: org.id,
              name: org.name,
              code: org.code,
              role: org.role,
              isDefault: org.isDefault,
            }))
          : [];

      // Find default organization or use first one
      const defaultOrg = organizations.find((org) => org.isDefault) || organizations[0];

      // Get user name from profile or fallback to metadata
      const userName =
        profileResult.success && profileResult.data?.name
          ? profileResult.data.name
          : supabaseUser.user_metadata?.name || 'Unknown User';

      const userInfo: User = {
        id: supabaseUser.id,
        email: supabaseUser.email || '',
        name: userName,
        organizations,
        currentOrganization: defaultOrg,
      };

      setUser(userInfo);
      setCurrentOrganization(defaultOrg || null);
    } catch (error) {
      logger.error('[AuthContext] Unexpected error in fetchUserData:', error);
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
    // CRITICAL: Early exit for SSR - do not run ANY initialization logic
    if (typeof window === 'undefined') {
      return;
    }

    let mounted = true;

    const initAuth = async () => {
      logger.info('[AuthContext] Starting auth initialization');
      try {
        const supabase = createClient();
        logger.info('[AuthContext] Created Supabase client');

        // CRITICAL FIX: Use getSession() first to restore session from cookie storage
        // Then optionally verify with getUser() if session exists
        // This ensures our custom cookieStorage.getItem() is actually called
        logger.info('[AuthContext] Calling getSession() to restore from cookies...');

        let validatedUser = null;
        let error = null;

        try {
          // Step 1: Try to restore session from cookies (this will call cookieStorage.getItem)
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

          logger.info('[AuthContext] getSession result:', {
            hasSession: !!sessionData.session,
            hasUser: !!sessionData.session?.user,
            email: sessionData.session?.user?.email,
            error: sessionError?.message,
          });

          if (sessionError) {
            error = sessionError;
          } else if (sessionData.session?.user) {
            // Session found in cookies - use it directly
            // In production, the server already validated this session when it was created
            validatedUser = sessionData.session.user;
            logger.info('[AuthContext] Session restored from cookies successfully');
          } else {
            logger.info('[AuthContext] No session found in cookies');
          }
        } catch (sessionError) {
          logger.error('[AuthContext] getSession failed:', sessionError);
          error = sessionError instanceof Error ? sessionError : new Error('Unknown error');
        }

        logger.info('[AuthContext] Authentication result:', {
          hasUser: !!validatedUser,
          email: validatedUser?.email,
          error: error?.message,
        });

        if (validatedUser && !error && mounted) {
          logger.info('[AuthContext] Valid user found, fetching user data');
          await fetchUserData(validatedUser);
          logger.info('[AuthContext] User data fetched successfully');
        } else if (mounted) {
          // ユーザーが認証されていない、またはエラーが発生した場合
          logger.info('[AuthContext] No user or error, clearing state');
          setUser(null);
          setCurrentOrganization(null);
        }
      } catch (error) {
        logger.error('[AuthContext] Error initializing auth:', error);
        // CRITICAL: Log detailed error information for debugging
        if (error instanceof Error) {
          logger.error('[AuthContext] Error name:', error.name);
          logger.error('[AuthContext] Error message:', error.message);
          logger.error('[AuthContext] Error stack:', error.stack);
        }
        // On error, set user to null to avoid blocking
        if (mounted) {
          setUser(null);
          setCurrentOrganization(null);
        }
      } finally {
        if (mounted) {
          logger.info('[AuthContext] Setting loading to false');
          setLoading(false);
        }
      }
    };

    // Timeout fallback: Force loading to false after 15 seconds to prevent infinite loading
    // (Set longer than getUser timeout to allow proper error handling)
    const timeoutId = setTimeout(() => {
      if (mounted) {
        logger.warn('[AuthContext] Timeout reached (15s), forcing loading to false');
        setLoading(false);
      }
    }, 15000);

    // Set up auth state change listener (client-side only)
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      logger.info('[AuthContext] Auth state changed:', event);
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
      logger.info('[AuthContext] Cleanup: unmounting');
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
        .update({ is_default: false })
        .eq('user_id', user.id);

      await supabase
        .from('user_organizations')
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
      logger.error('Failed to switch organization:', error);
      toast.error('組織の切り替えに失敗しました');
    }
  };

  // Refresh user data from server
  const refreshUser = async () => {
    try {
      const result = await getCurrentUser();

      if (result.success && result.data) {
        const supabase = createClient();
        // Use getSession() instead of getUser() to avoid timeout issues
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          await fetchUserData(session.user);
        }
      } else {
        // User is not authenticated
        setUser(null);
        setCurrentOrganization(null);
      }
    } catch (error) {
      logger.error('Failed to refresh user:', error);
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
