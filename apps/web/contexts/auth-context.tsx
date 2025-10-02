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
      const { data: userOrgs } = await supabase
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

      // Get user's profile data
      const { data: userData } = await supabase
        .from('users')
        .select('name')
        .eq('id', supabaseUser.id)
        .single();

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

      setUser(userInfo);
      setCurrentOrganization(defaultOrg || null);
    } catch (error) {
      console.error('Error fetching user data:', error);
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
      try {
        const supabase = createClient();

        // Get initial session to check if user is logged in
        // Note: We use getSession() here just to check if a session exists
        // The actual user validation will be done by onAuthStateChange
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user && mounted) {
          // Validate the session by calling getUser()
          const {
            data: { user: validatedUser },
            error,
          } = await supabase.auth.getUser();

          if (validatedUser && !error) {
            await fetchUserData(validatedUser);
          } else {
            // Session is invalid, clear state
            setUser(null);
            setCurrentOrganization(null);
          }
        } else if (mounted) {
          setUser(null);
          setCurrentOrganization(null);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        // On error, set user to null to avoid blocking
        if (mounted) {
          setUser(null);
          setCurrentOrganization(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Set up auth state change listener
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

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
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  // Sign in function - delegates to Server Action
  const handleSignIn = async (email: string, password: string): Promise<ActionResult<AuthUser>> => {
    setLoading(true);
    try {
      const result = await signIn({ email, password });

      if (result.success && result.data) {
        // The auth state change listener will handle updating the user state
        // DO NOT navigate here - let the calling component handle navigation
        // to avoid race conditions with middleware auth checks
        toast.success('ログインしました');
      } else if (!result.success) {
        toast.error(result.error?.message || 'ログインに失敗しました');
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'ログインに失敗しました';
      toast.error(errorMessage);
      return {
        success: false,
        error: {
          code: 'LOGIN_ERROR',
          message: errorMessage,
        },
      };
    } finally {
      setLoading(false);
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
