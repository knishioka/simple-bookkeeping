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

  // Use the official pattern from Supabase docs - no custom cookie handlers needed
  // @supabase/ssr handles cookies automatically
  // eslint-disable-next-line no-console
  console.info('[Supabase Client] Creating browser client');
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}

/**
 * 型安全なSupabaseクライアントタイプ
 */
export type SupabaseClient = ReturnType<typeof createClient>;
