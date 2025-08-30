import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Create Supabase client
    const cookieStore = await cookies();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    });

    // Get current user
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user's organizations from metadata
    const organizations = user.app_metadata?.organizations || [];
    const currentOrganizationId = user.app_metadata?.current_organization_id;
    const currentRole = user.app_metadata?.current_role;

    // Get additional user info from public.users table
    const { data: userData } = await supabase
      .from('users')
      .select('id, name, email, role, organization_id, is_active')
      .eq('id', user.id)
      .eq('organization_id', currentOrganizationId)
      .single();

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: userData?.name || user.email?.split('@')[0],
        organizations,
        currentOrganizationId,
        currentRole: userData?.role || currentRole,
        isActive: userData?.is_active ?? true,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
