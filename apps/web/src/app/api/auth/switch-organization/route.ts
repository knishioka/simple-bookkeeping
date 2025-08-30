import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const switchOrganizationSchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validationResult = switchOrganizationSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { organizationId } = validationResult.data;

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
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Call RPC function to switch organization
    const { data, error } = await supabase.rpc('switch_user_organization', {
      new_organization_id: organizationId,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Refresh session to get updated JWT
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      return NextResponse.json({ error: 'Failed to refresh session' }, { status: 500 });
    }

    // Get updated user info
    const {
      data: { user: updatedUser },
    } = await supabase.auth.getUser();
    const currentRole = updatedUser?.app_metadata?.current_role;

    return NextResponse.json({
      message: 'Organization switched successfully',
      organizationId,
      role: currentRole || data?.role,
    });
  } catch (error) {
    console.error('Switch organization error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
