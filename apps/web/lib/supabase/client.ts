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

  // Helper function to parse cookie values
  // Cookies may be stored as:
  // 1. Plain JSON string
  // 2. base64-encoded JSON (prefixed with 'base64-')
  const parseCookieValue = (value: string, cookieKey?: string): string | null => {
    try {
      // Check if the value is base64-encoded
      if (value.startsWith('base64-')) {
        // Remove 'base64-' prefix and decode
        const base64String = value.substring(7);
        const decoded = atob(base64String);
        // The decoded value should be a JSON string
        return decoded;
      }
      // Return as-is if not base64-encoded
      return value;
    } catch (error) {
      console.error('[Cookie Storage] Failed to parse cookie value:', error);

      // MIGRATION: Clear corrupted cookies from previous versions
      // This handles cookies that were stored with the old broken encoding
      if (cookieKey) {
        console.warn(
          `[Cookie Storage] Clearing corrupted cookie: ${cookieKey} (migration from old storage format)`
        );
        // Remove the main cookie and all chunks
        document.cookie = `${cookieKey}=; path=/; max-age=0`;
        for (let i = 0; i < 10; i++) {
          document.cookie = `${cookieKey}.${i}=; path=/; max-age=0`;
        }
      }

      return null;
    }
  };

  // CRITICAL: Use cookie-based storage to match server-side session storage
  // Server Actions use cookies via @supabase/ssr, so browser client must read from cookies too
  const cookieStorage = {
    getItem: (key: string) => {
      // eslint-disable-next-line no-console
      console.info('[Cookie Storage] getItem called for key:', key);
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
            const value = decodeURIComponent(singleCookie.substring(key.length + 1));
            const parsed = parseCookieValue(value, key);
            // eslint-disable-next-line no-console
            console.info('[Cookie Storage] Found non-chunked cookie, parsed:', !!parsed);
            return parsed;
          }

          console.warn('[Cookie Storage] No cookie found for key:', key);
          return null;
        }

        // CRITICAL: Each chunk value is URL-encoded and needs to be decoded
        // before joining with other chunks
        const encodedValue = chunk.substring(chunkKey.length + 1);
        const decodedValue = decodeURIComponent(encodedValue);
        chunks.push(decodedValue);
        chunkIndex++;
      }

      // Combine all chunks and parse
      // Chunks are already decoded, so just join and parse
      if (chunks.length > 0) {
        const combined = chunks.join('');
        const parsed = parseCookieValue(combined, key);
        // eslint-disable-next-line no-console
        console.info(
          `[Cookie Storage] Found ${chunks.length} chunks, combined length: ${combined.length}, parsed:`,
          !!parsed
        );
        return parsed;
      }

      console.warn('[Cookie Storage] No chunks found for key:', key);
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

  // CRITICAL: Extract hostname from URL for cookie storage key
  // Supabase uses only the hostname part (without port) for cookie names
  // Example: localhost:54321 → localhost, eksgzskroipxdwtbmkxm.supabase.co → eksgzskroipxdwtbmkxm
  const urlHost = supabaseUrl.split('//')[1].split('/')[0]; // "localhost:54321" or "eksgzskroipxdwtbmkxm.supabase.co"
  const hostname = urlHost.split(':')[0].split('.')[0]; // "localhost" or "eksgzskroipxdwtbmkxm"

  const config = {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: cookieStorage,
      storageKey: `sb-${hostname}-auth-token`,
      flowType: 'pkce' as const,
    },
  };

  // eslint-disable-next-line no-console
  console.info('[Supabase Client] Creating client with config:', {
    persistSession: config.auth.persistSession,
    storageKey: config.auth.storageKey,
    hasCustomStorage: !!config.auth.storage,
  });

  browserClient = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey, config);

  return browserClient;
}

/**
 * 型安全なSupabaseクライアントタイプ
 */
export type SupabaseClient = ReturnType<typeof createClient>;
