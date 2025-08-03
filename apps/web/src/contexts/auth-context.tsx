'use client';

import { useRouter } from 'next/navigation';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { apiClient } from '@/lib/api-client';

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

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    if (token) {
      // TODO: Validate token and get user info
      // For now, we'll just clear the loading state
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
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

        toast.success('ログインしました');
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Login failed:', error);
      if (error instanceof Error) {
        toast.error(`ログインエラー: ${error.message}`);
      } else {
        toast.error('ログインに失敗しました');
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
      apiClient.clearTokens();
      apiClient.clearOrganizationId();
      setUser(null);
      setCurrentOrganization(null);
      toast.success('ログアウトしました');
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      // Even if logout fails, clear local state
      apiClient.clearTokens();
      apiClient.clearOrganizationId();
      setUser(null);
      setCurrentOrganization(null);
      router.push('/login');
    }
  };

  const switchOrganization = async (organizationId: string) => {
    if (!user) return;

    const organization = user.organizations.find((org) => org.id === organizationId);
    if (!organization) {
      toast.error('組織が見つかりません');
      return;
    }

    setCurrentOrganization(organization);
    setUser({
      ...user,
      currentOrganization: organization,
    });

    // Update API client with new organization
    apiClient.setOrganizationId(organizationId);

    toast.success(`${organization.name} に切り替えました`);

    // Refresh the current page to reload data
    router.refresh();
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
    switchOrganization,
    currentOrganization,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
