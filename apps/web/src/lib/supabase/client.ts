import { createBrowserClient } from '@supabase/ssr';

import type { Database } from './database.types';

/**
 * Supabaseクライアント（ブラウザ用）
 * クライアントサイドコンポーネントで使用
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}

/**
 * 型安全なSupabaseクライアントタイプ
 */
export type SupabaseClient = ReturnType<typeof createClient>;
