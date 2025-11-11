/**
 * Internal API Route for Default Organization Lookup
 * Issue #553: This route runs on Node runtime (not Edge) to safely use Service Role Key
 *
 * Security: This is an internal-only endpoint called by middleware.
 * It should NOT be accessible to external clients.
 */

import type { DefaultOrganization } from '@/app/actions/organizations';

import { NextRequest, NextResponse } from 'next/server';

import { getDefaultUserOrganization } from '@/app/actions/organizations';

// CRITICAL: Force Node runtime to keep Service Role Key out of Edge
export const runtime = 'nodejs';

// Disable caching for this internal endpoint
export const dynamic = 'force-dynamic';

interface RequestBody {
  userId: string;
}

interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = (await request.json()) as RequestBody;
    const { userId } = body;

    // Validate input
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'User ID is required and must be a string' },
        { status: 400 }
      );
    }

    // Call Server Action (which uses Service Role Key)
    const result: ActionResult<DefaultOrganization> = await getDefaultUserOrganization(userId);

    // Return result
    return NextResponse.json(result, { status: result.success ? 200 : 404 });
  } catch (error) {
    console.error('[Internal API] Error fetching default organization:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// Prevent GET requests
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
