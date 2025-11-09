import type { Database } from './database.types';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const assertNotLegacyKey = (key: string, envName: string) => {
  // Skip validation in test environment
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  if (key.startsWith('sbp_')) {
    throw new Error(
      `${envName} にレガシー形式 (sbp_...) の Supabase API キーが設定されています。Project settings → API で新しいキーを発行し、環境変数を更新してください。`
    );
  }
};

// Singleton instance to prevent multiple GoTrueClient instances
let browserClient: ReturnType<typeof createSupabaseClient<Database>> | null = null;

/**
 * Supabaseクライアント（ブラウザ用）
 * クライアントサイドコンポーネントで使用
 * シングルトンパターンで実装し、複数のインスタンス作成を防ぐ
 */
export function createClient() {
  // Check if running in test environment with mock
  if (typeof window !== 'undefined') {
    const win = window as unknown as {
      __supabaseClientMock?: () => ReturnType<typeof createSupabaseClient<Database>>;
    };
    if (win.__supabaseClientMock) {
      return win.__supabaseClientMock();
    }
  }

  // Return existing instance if available (singleton pattern)
  if (browserClient) {
    // eslint-disable-next-line no-console
    console.info('[Supabase Client] Reusing existing browser client instance');
    return browserClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Temporary debug logging for production environment variable check
  // eslint-disable-next-line no-console
  console.info('[Supabase Client] Environment check:', {
    hasUrl: !!supabaseUrl,
    urlPrefix: supabaseUrl?.substring(0, 30),
    hasAnonKey: !!supabaseAnonKey,
    anonKeyPrefix: supabaseAnonKey?.substring(0, 20),
  });

  if (!supabaseUrl || !supabaseAnonKey) {
    // 開発環境やテスト環境で環境変数が設定されていない場合のエラーメッセージを改善
    console.warn(
      'Supabase environment variables are not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
    throw new Error(
      'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }

  assertNotLegacyKey(supabaseAnonKey, 'NEXT_PUBLIC_SUPABASE_ANON_KEY');

  // WORKAROUND: Use @supabase/supabase-js directly instead of @supabase/ssr
  // @supabase/ssr's createBrowserClient is not making network requests in Next.js 15
  // This is a temporary fix until the compatibility issue is resolved
  // eslint-disable-next-line no-console
  console.info('[Supabase Client] Creating NEW browser client with @supabase/supabase-js');

  // CRITICAL: Use cookie-based storage to match server-side session storage
  // Server Actions use cookies via @supabase/ssr, so browser client must read from cookies too
  const cookieStorage = {
    getItem: (key: string) => {
      // Supabase splits large cookies into chunks (key.0, key.1, etc.)
      // We need to find all chunks and combine them
      const cookies = document.cookie.split(';').map((c) => c.trim());
      const chunks: string[] = [];

      // Find all cookie chunks for this key
      let chunkIndex = 0;
      while (true) {
        const chunkKey = chunkIndex === 0 ? `${key}.${chunkIndex}` : `${key}.${chunkIndex}`;
        const chunk = cookies.find((c) => c.startsWith(`${chunkKey}=`));

        if (!chunk) {
          // If we found at least one chunk (index 0), stop here
          if (chunkIndex > 0) break;

          // Otherwise, try to find a non-chunked cookie
          const singleCookie = cookies.find((c) => c.startsWith(`${key}=`));
          if (singleCookie) {
            return decodeURIComponent(singleCookie.substring(key.length + 1));
          }
          return null;
        }

        const value = chunk.substring(chunkKey.length + 1);
        chunks.push(value);
        chunkIndex++;
      }

      // Combine all chunks
      if (chunks.length > 0) {
        return decodeURIComponent(chunks.join(''));
      }

      return null;
    },
    setItem: (key: string, value: string) => {
      // Let the server handle cookie chunking - just store the value
      document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
    },
    removeItem: (key: string) => {
      // Remove the main cookie and all chunks
      document.cookie = `${key}=; path=/; max-age=0`;
      for (let i = 0; i < 10; i++) {
        document.cookie = `${key}.${i}=; path=/; max-age=0`;
      }
    },
  };

  browserClient = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: cookieStorage,
      storageKey: `sb-${supabaseUrl.split('//')[1].split('.')[0]}-auth-token`,
      flowType: 'pkce',
    },
  });

  return browserClient;
}

/**
 * 型安全なSupabaseクライアントタイプ
 */
export type SupabaseClient = ReturnType<typeof createClient>;
