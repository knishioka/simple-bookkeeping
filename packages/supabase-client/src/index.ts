// Main exports for Supabase client package
export { supabase } from './lib/supabase';
export { createSupabaseServerClient } from './lib/supabase-server';
export { updateSession } from './lib/supabase-middleware';

// Auth exports
export { authUtils, AuthError } from './auth';
export type { AuthUser, UserOrganization } from './auth';
export { useAuth, usePermission, useOrganization } from './auth/hooks';

// Type exports
export type { Database, Tables, Inserts, Updates, Enums } from './lib/supabase';

// Re-export types
export type { User, Session } from '@supabase/supabase-js';
