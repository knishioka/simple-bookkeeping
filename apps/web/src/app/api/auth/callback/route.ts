import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const redirectTo = requestUrl.searchParams.get('redirectTo') || '/dashboard';

  if (code) {
    const supabase = createRouteHandlerClient({ cookies });

    // Exchange code for session
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Auth callback error:', error);
      return NextResponse.redirect(new URL('/auth/login?error=auth_callback_failed', request.url));
    }
  }

  // Redirect to the original destination or dashboard
  return NextResponse.redirect(new URL(redirectTo, request.url));
}
