'use client';

import { useRouter } from 'next/navigation';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

// TODO: Migrate to Supabase auth - Issue #355
// import { apiClient } from '@/lib/api-client';

interface Organization {
  id: string;
  name: string;
  code: string;
  role: 'ADMIN' | 'ACCOUNTANT' | 'VIEWER';
  isDefault: boolean;
}

interface User {
  id: string;
  email: string;
  name: string;
  organizations: Organization[];
  currentOrganization?: Organization;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  switchOrganization: (organizationId: string) => Promise<void>;
  currentOrganization: Organization | null;
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

  useEffect(() => {
    // TODO: Migrate to Supabase auth - Issue #355
    // This auth check is temporarily disabled during migration to Supabase
    // The application should use Supabase's auth.getUser() instead
    setLoading(false);

    // Original auth check code commented out:
    /*
    const checkAuth = async () => {
      // Skip auth check for demo pages to avoid 401 errors
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/demo')) {
        setLoading(false);
        return;
      }

      try {
        const token = localStorage.getItem('token');
        const refreshToken = localStorage.getItem('refreshToken');

        if (token && refreshToken) {
          // Set tokens in API client
          apiClient.setToken(token, refreshToken);

          // Try to restore user from localStorage first (fast recovery)
          const cachedUser = localStorage.getItem('user');
          if (cachedUser) {
            try {
              const parsedUser = JSON.parse(cachedUser) as User;
              setUser(parsedUser);
              setCurrentOrganization(parsedUser.currentOrganization || null);

              // Set organization ID if available
              if (parsedUser.currentOrganization?.id) {
                apiClient.setOrganizationId(parsedUser.currentOrganization.id);
              }
            } catch {
              // Failed to parse cached user data
              localStorage.removeItem('user');
            }
          }

          // Then validate the token by fetching fresh user info
          try {
            const response = await apiClient.get<{ user: User }>('/auth/me');
            if (response.data?.user) {
              const freshUser = response.data.user;
              setUser(freshUser);
              setCurrentOrganization(freshUser.currentOrganization || null);

              // Update cached user data
              localStorage.setItem('user', JSON.stringify(freshUser));

              // Set organization ID if available
              if (freshUser.currentOrganization?.id) {
                apiClient.setOrganizationId(freshUser.currentOrganization.id);
              }
            }
          } catch {
            // Token might be expired or invalid, clearing auth state
            apiClient.clearTokens();
            apiClient.clearOrganizationId();
            localStorage.removeItem('user');
            setUser(null);
            setCurrentOrganization(null);
          }
        }
      } catch {
        // Auth check failed
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
    */
  }, []);

  const login = async (_email: string, _password: string) => {
    // TODO: Migrate to Supabase auth - Issue #355
    // Use signIn Server Action from app/actions/auth.ts instead
    toast.error('ログイン機能は現在メンテナンス中です');
    setLoading(false);

    // Original login code commented out:
    /*
    setLoading(true);
    try {
      const response = await apiClient.post<{
        token: string;
        refreshToken: string;
        user: {
          id: string;
          email: string;
          name: string;
          role: string;
          organizationId?: string;
          organization?: {
            id: string;
            name: string;
            code: string;
          };
        };
      }>('/auth/login', { email, password });

      if (response.data) {
        apiClient.setToken(response.data.token, response.data.refreshToken);

        // Set organization ID if available
        if (response.data.user.organizationId) {
          apiClient.setOrganizationId(response.data.user.organizationId);
        }

        // Create organization object from response
        const organization: Organization | undefined = response.data.user.organization
          ? {
              id: response.data.user.organization.id,
              name: response.data.user.organization.name,
              code: response.data.user.organization.code,
              role: response.data.user.role as 'ADMIN' | 'ACCOUNTANT' | 'VIEWER',
              isDefault: true,
            }
          : undefined;

        const fullUser: User = {
          id: response.data.user.id,
          email: response.data.user.email,
          name: response.data.user.name,
          organizations: organization ? [organization] : [],
          currentOrganization: organization,
        };

        setUser(fullUser);
        setCurrentOrganization(organization || null);

        // Save user data to localStorage for fast recovery
        localStorage.setItem('user', JSON.stringify(fullUser));

        toast.success('ログインしました');
        router.push('/dashboard');
      }
    } catch (error) {
      // Login failed
      if (error instanceof Error) {
        toast.error(`ログインエラー: ${error.message}`);
      } else {
        toast.error('ログインに失敗しました');
      }
    } finally {
      setLoading(false);
    }
    */
  };

  const logout = async () => {
    // TODO: Migrate to Supabase auth - Issue #355
    // Use signOut Server Action from app/actions/auth.ts instead
    localStorage.removeItem('user');
    setUser(null);
    setCurrentOrganization(null);
    toast.success('ログアウトしました');
    router.push('/login');

    // Original logout code commented out:
    /*
    try {
      await apiClient.post('/auth/logout');
      apiClient.clearTokens();
      apiClient.clearOrganizationId();
      localStorage.removeItem('user');
      setUser(null);
      setCurrentOrganization(null);
      toast.success('ログアウトしました');
      router.push('/login');
    } catch {
      // Logout failed
      // Even if logout fails, clear local state
      apiClient.clearTokens();
      apiClient.clearOrganizationId();
      localStorage.removeItem('user');
      setUser(null);
      setCurrentOrganization(null);
      router.push('/login');
    }
    */
  };

  const switchOrganization = async (_organizationId: string) => {
    // TODO: Migrate to Supabase auth - Issue #355
    // Need to implement organization switching with Supabase
    toast.error('組織切り替え機能は現在メンテナンス中です');

    // Original switchOrganization code commented out:
    /*
    if (!user) return;

    try {
      // Call the new switch organization endpoint
      const response = await apiClient.post<{
        token: string;
        refreshToken: string;
        user: {
          id: string;
          email: string;
          name: string;
          role: string;
          organizationId: string;
          organization: {
            id: string;
            name: string;
            code: string;
          };
        };
      }>('/auth/switch-organization', { organizationId });

      if (response.data) {
        // Update tokens with new organization context
        apiClient.setToken(response.data.token, response.data.refreshToken);
        apiClient.setOrganizationId(organizationId);

        // Create organization object from response
        const organization: Organization = {
          id: response.data.user.organization.id,
          name: response.data.user.organization.name,
          code: response.data.user.organization.code,
          role: response.data.user.role as 'ADMIN' | 'ACCOUNTANT' | 'VIEWER',
          isDefault: false, // Not necessarily the default after switching
        };

        const updatedUser = {
          ...user,
          currentOrganization: organization,
        };

        setCurrentOrganization(organization);
        setUser(updatedUser);

        // Update cached user data
        localStorage.setItem('user', JSON.stringify(updatedUser));

        toast.success(`${organization.name} に切り替えました`);

        // Refresh the current page to reload data
        router.refresh();
      }
    } catch {
      // Failed to switch organization
      toast.error('組織の切り替えに失敗しました');
    }
    */
  };

  const refreshUser = async () => {
    // TODO: Migrate to Supabase auth - Issue #355
    // Use getCurrentUser Server Action from app/actions/auth.ts instead
    // Original refreshUser code commented out:
    /*
    try {
      const response = await apiClient.get<{ user: User }>('/auth/me');
      if (response.data?.user) {
        const freshUser = response.data.user;
        setUser(freshUser);
        setCurrentOrganization(freshUser.currentOrganization || null);

        // Update cached user data
        localStorage.setItem('user', JSON.stringify(freshUser));

        // Set organization ID if available
        if (freshUser.currentOrganization?.id) {
          apiClient.setOrganizationId(freshUser.currentOrganization.id);
        }
      }
    } catch {
      // Failed to refresh user data
    }
    */
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
    switchOrganization,
    currentOrganization,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
