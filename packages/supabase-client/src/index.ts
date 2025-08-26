// Main exports for Supabase client package
export { supabase } from './lib/supabase';
export { createSupabaseServerClient } from './lib/supabase-server';
export { updateSession } from './lib/supabase-middleware';

// Type exports
export type { Database, Tables, Inserts, Updates, Enums } from './lib/supabase';

// Re-export types
export type { User, Session } from '@supabase/supabase-js';
