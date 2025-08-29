import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

// Edge Runtimeを使用
export const runtime = 'edge';

// キャッシュ設定
export const revalidate = 300; // 5分間キャッシュ

/**
 * 勘定科目一覧取得（Edge Runtime最適化版）
 */
export async function GET(request: NextRequest) {
  try {
    // Supabase環境変数が設定されていない場合は、エラーレスポンスを返す
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json(
        { error: 'Supabase configuration is not available' },
        { status: 503 }
      );
    }

    const supabase = await createClient();

    // クエリパラメータの取得
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organization_id');
    const accountType = searchParams.get('type');
    const isActive = searchParams.get('is_active');

    // クエリの構築
    let query = supabase.from('accounts').select('*').order('code', { ascending: true });

    // フィルタリング
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    if (accountType) {
      query = query.eq('account_type', accountType);
    }
    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true');
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // レスポンスヘッダーにキャッシュ情報を追加
    const response = NextResponse.json({ data });
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

    return response;
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * 勘定科目作成
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { data, error } = await supabase.from('accounts').insert(body).select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Error creating account:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
