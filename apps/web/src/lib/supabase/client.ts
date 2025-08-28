import { createBrowserClient } from '@supabase/ssr';

import type { Database } from './database.types';

/**
 * Supabaseクライアント（ブラウザ用）
 * クライアントサイドコンポーネントで使用
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * 型安全なSupabaseクライアントタイプ
 */
export type SupabaseClient = ReturnType<typeof createClient>;
