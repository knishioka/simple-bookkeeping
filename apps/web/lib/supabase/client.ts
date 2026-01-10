import type { Database } from './database.types';

import { createBrowserClient } from '@supabase/ssr';

import { assertNotLegacyKey } from './validation';

import { logger } from '@/lib/logger';

// Singleton instance to prevent multiple GoTrueClient instances
let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * Supabaseクライアント（ブラウザ用）
 * クライアントサイドコンポーネントで使用
 * シングルトンパターンで実装し、複数のインスタンス作成を防ぐ
 */
export function createClient() {
  // Check if running in test environment with mock
  if (typeof window !== 'undefined') {
    const win = window as unknown as {
      __supabaseClientMock?: () => ReturnType<typeof createBrowserClient<Database>>;
    };
    if (win.__supabaseClientMock) {
      return win.__supabaseClientMock();
    }
  }

  // Return existing instance if available (singleton pattern)
  if (browserClient) {
    logger.info('[Supabase Client] Reusing existing browser client instance');
    return browserClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Temporary debug logging for production environment variable check
  logger.info('[Supabase Client] Environment check:', {
    hasUrl: !!supabaseUrl,
    urlPrefix: supabaseUrl?.substring(0, 30),
    hasAnonKey: !!supabaseAnonKey,
    anonKeyPrefix: supabaseAnonKey?.substring(0, 20),
  });

  if (!supabaseUrl || !supabaseAnonKey) {
    // 開発環境やテスト環境で環境変数が設定されていない場合のエラーメッセージを改善
    logger.warn(
      'Supabase environment variables are not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
    throw new Error(
      'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }

  assertNotLegacyKey(supabaseAnonKey, 'NEXT_PUBLIC_SUPABASE_ANON_KEY');

  // Use @supabase/ssr's createBrowserClient for consistent cookie handling
  // This ensures client-side and server-side (middleware) use the same cookie format
  logger.info('[Supabase Client] Creating NEW browser client with @supabase/ssr');

  // createBrowserClient handles all cookie operations internally
  // No need for custom storage implementation
  browserClient = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        // @supabase/ssr handles cookie chunking automatically
        const cookies = document.cookie.split(';').map((c) => c.trim());
        const cookie = cookies.find((c) => c.startsWith(`${name}=`));
        if (!cookie) return null;
        return decodeURIComponent(cookie.substring(name.length + 1));
      },
      set(name: string, value: string, options: { maxAge?: number; path?: string }) {
        document.cookie = `${name}=${encodeURIComponent(value)}; path=${options.path ?? '/'}; max-age=${options.maxAge ?? 31536000}; SameSite=Lax`;
      },
      remove(name: string, options: { path?: string }) {
        document.cookie = `${name}=; path=${options.path ?? '/'}; max-age=0; SameSite=Lax`;
      },
    },
  });

  return browserClient;
}

/**
 * 型安全なSupabaseクライアントタイプ
 */
export type SupabaseClient = ReturnType<typeof createClient>;
