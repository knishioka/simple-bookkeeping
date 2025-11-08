import type { Database } from './database.types';

import { createBrowserClient } from '@supabase/ssr';

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

/**
 * Supabaseクライアント（ブラウザ用）
 * クライアントサイドコンポーネントで使用
 */
export function createClient() {
  // Check if running in test environment with mock
  if (typeof window !== 'undefined') {
    const win = window as unknown as {
      __supabaseClientMock?: () => ReturnType<typeof createBrowserClient>;
    };
    if (win.__supabaseClientMock) {
      return win.__supabaseClientMock();
    }
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

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        // eslint-disable-next-line no-console
        console.info('[Supabase Client] Cookie get:', name);
        if (typeof document === 'undefined') return undefined;
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
          const [key, value] = cookie.trim().split('=');
          if (key === name) {
            return decodeURIComponent(value);
          }
        }
        return undefined;
      },
      set(name: string, value: string, options: { maxAge?: number; path?: string }) {
        // eslint-disable-next-line no-console
        console.info('[Supabase Client] Cookie set:', { name, valueLength: value.length });
        if (typeof document === 'undefined') return;
        let cookie = `${name}=${encodeURIComponent(value)}`;
        if (options.path) {
          cookie += `; path=${options.path}`;
        }
        if (options.maxAge) {
          cookie += `; max-age=${options.maxAge}`;
        }
        cookie += '; SameSite=Lax';
        document.cookie = cookie;
      },
      remove(name: string, options: { path?: string }) {
        // eslint-disable-next-line no-console
        console.info('[Supabase Client] Cookie remove:', name);
        if (typeof document === 'undefined') return;
        let cookie = `${name}=; max-age=0`;
        if (options.path) {
          cookie += `; path=${options.path}`;
        }
        document.cookie = cookie;
      },
    },
  });
}

/**
 * 型安全なSupabaseクライアントタイプ
 */
export type SupabaseClient = ReturnType<typeof createClient>;
