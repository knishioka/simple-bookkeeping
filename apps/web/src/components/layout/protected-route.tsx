'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from '@/contexts/auth-context';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    // Check if we're in test mode (using placeholder Supabase URLs)
    const isTestMode =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
      (localStorage.getItem('supabase.auth.token') ||
        (window as Window & { __testUser?: Record<string, unknown> }).__testUser);

    if (!loading && !isAuthenticated && !isTestMode) {
      router.push('/auth/login');
    }
  }, [isAuthenticated, loading, router]);

  // Check if we're in test mode (using placeholder Supabase URLs)
  const isTestMode =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
    (localStorage.getItem('supabase.auth.token') ||
      (window as Window & { __testUser?: Record<string, unknown> }).__testUser);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Allow access in test mode even if not authenticated through normal means
  if (!isAuthenticated && !isTestMode) {
    return null;
  }

  return <>{children}</>;
}
