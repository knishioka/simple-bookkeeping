import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

/**
 * 勘定科目一覧取得 API
 * GET /api/accounts
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // クエリパラメータの取得
    const { searchParams } = new URL(request.url);
    const accountType = searchParams.get('account_type');
    const category = searchParams.get('category');
    const isActive = searchParams.get('is_active');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // クエリの構築
    let query = supabase
      .from('accounts')
      .select('*', { count: 'exact' })
      .order('code', { ascending: true });

    // フィルタの適用
    if (accountType) {
      query = query.eq('account_type', accountType);
    }
    if (category) {
      query = query.eq('category', category);
    }
    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true');
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
    }

    // ページネーション
    query = query.range(offset, offset + limit - 1);

    // データ取得
    const { data: accounts, error, count } = await query;

    if (error) {
      console.error('Failed to fetch accounts:', error);
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
    }

    return NextResponse.json({
      data: accounts,
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Accounts API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * 勘定科目作成 API
 * POST /api/accounts
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // リクエストボディの取得
    const body = await request.json();

    // バリデーション
    if (!body.code || !body.name || !body.account_type || !body.category) {
      return NextResponse.json({ error: 'Required fields are missing' }, { status: 400 });
    }

    // 現在の組織IDを取得
    const { data: orgData } = await supabase
      .from('user_organizations')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('is_default', true)
      .single();

    if (!orgData) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 });
    }

    // 重複チェック（同一組織内でコードの重複を防ぐ）
    const { data: existing } = await supabase
      .from('accounts')
      .select('id')
      .eq('organization_id', orgData.organization_id)
      .eq('code', body.code)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Account code already exists' }, { status: 409 });
    }

    // 勘定科目の作成
    const { data: account, error } = await supabase
      .from('accounts')
      .insert({
        organization_id: orgData.organization_id,
        code: body.code,
        name: body.name,
        name_kana: body.name_kana || null,
        account_type: body.account_type,
        category: body.category,
        sub_category: body.sub_category || null,
        description: body.description || null,
        tax_rate: body.tax_rate || null,
        parent_account_id: body.parent_account_id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create account:', error);
      return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
    }

    return NextResponse.json({ data: account }, { status: 201 });
  } catch (error) {
    console.error('Account creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
