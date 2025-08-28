import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

/**
 * 勘定科目詳細取得 API
 * GET /api/accounts/[id]
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 勘定科目の取得
    const { data: account, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // 残高の計算（オプション）
    const calculateBalance = request.nextUrl.searchParams.get('include_balance') === 'true';

    if (calculateBalance) {
      const { data: balanceData } = await supabase
        .from('journal_entry_lines')
        .select('debit_amount, credit_amount')
        .eq('account_id', id);

      const balance = balanceData?.reduce(
        (acc, line) => {
          acc.debit += line.debit_amount || 0;
          acc.credit += line.credit_amount || 0;
          return acc;
        },
        { debit: 0, credit: 0 }
      );

      return NextResponse.json({
        data: {
          ...account,
          balance,
        },
      });
    }

    return NextResponse.json({ data: account });
  } catch (error) {
    console.error('Account fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * 勘定科目更新 API
 * PUT /api/accounts/[id]
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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

    // 既存の勘定科目を確認
    const { data: existing } = await supabase
      .from('accounts')
      .select('id, organization_id')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // 仕訳で使用されているかチェック（コード変更時）
    if (body.code) {
      const { data: usedInEntries } = await supabase
        .from('journal_entry_lines')
        .select('id')
        .eq('account_id', id)
        .limit(1);

      if (usedInEntries && usedInEntries.length > 0) {
        return NextResponse.json(
          { error: 'Cannot change code of account that has journal entries' },
          { status: 400 }
        );
      }
    }

    // 更新データの構築
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'name',
      'name_kana',
      'account_type',
      'category',
      'sub_category',
      'description',
      'tax_rate',
      'is_active',
      'parent_account_id',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // 勘定科目の更新
    const { data: account, error } = await supabase
      .from('accounts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update account:', error);
      return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
    }

    return NextResponse.json({ data: account });
  } catch (error) {
    console.error('Account update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * 勘定科目削除 API
 * DELETE /api/accounts/[id]
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 仕訳で使用されているかチェック
    const { data: usedInEntries } = await supabase
      .from('journal_entry_lines')
      .select('id')
      .eq('account_id', id)
      .limit(1);

    if (usedInEntries && usedInEntries.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete account that has journal entries' },
        { status: 400 }
      );
    }

    // 勘定科目の削除（ソフトデリート）
    const { error } = await supabase.from('accounts').update({ is_active: false }).eq('id', id);

    if (error) {
      console.error('Failed to delete account:', error);
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Account deletion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
