import { createClient } from '@supabase/supabase-js';
import { useEffect, useState, useCallback } from 'react';

import { authUtils } from './index';

import type { AuthUser, UserOrganization } from './index';
import type { Database } from '../lib/supabase';

/**
 * Hook to get current authenticated user
 */
export function useAuth(supabase: ReturnType<typeof createClient<Database>>) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Get initial user
    authUtils
      .getCurrentUser(supabase)
      .then(setUser)
      .catch(setError)
      .finally(() => setLoading(false));

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const authUser = await authUtils.getCurrentUser(supabase);
        setUser(authUser);
      } else {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await authUtils.signIn(email, password, supabase);
        setUser(result.user);
        return result;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  const signUp = useCallback(
    async (email: string, password: string, organizationName: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await authUtils.signUp(email, password, organizationName, supabase);
        return result;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await authUtils.signOut(supabase);
      setUser(null);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const switchOrganization = useCallback(
    async (organizationId: string) => {
      setLoading(true);
      setError(null);
      try {
        await authUtils.switchOrganization(organizationId, supabase);
        const updatedUser = await authUtils.getCurrentUser(supabase);
        setUser(updatedUser);
        return updatedUser;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  const hasPermission = useCallback(
    (requiredRole: 'admin' | 'accountant' | 'viewer') => {
      return authUtils.hasPermission(user, requiredRole);
    },
    [user]
  );

  return {
    user,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    switchOrganization,
    hasPermission,
  };
}

/**
 * Hook to check if user has required permission
 */
export function usePermission(
  requiredRole: 'admin' | 'accountant' | 'viewer',
  supabase: ReturnType<typeof createClient<Database>>
) {
  const { user, loading } = useAuth(supabase);
  const hasPermission = authUtils.hasPermission(user, requiredRole);

  return {
    hasPermission,
    loading,
    user,
  };
}

/**
 * Hook for organization management
 */
export function useOrganization(supabase: ReturnType<typeof createClient<Database>>) {
  const { user, switchOrganization } = useAuth(supabase);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const organizations = user?.organizations || [];
  const currentOrganization = organizations.find(
    (org: UserOrganization) => org.id === user?.currentOrganizationId
  );

  const switchToOrganization = useCallback(
    async (organizationId: string) => {
      setLoading(true);
      setError(null);
      try {
        await switchOrganization(organizationId);
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [switchOrganization]
  );

  return {
    organizations,
    currentOrganization,
    switchToOrganization,
    loading,
    error,
  };
}
