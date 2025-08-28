import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

/**
 * 仕訳一覧取得 API
 * GET /api/journal-entries
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
    const periodId = searchParams.get('accounting_period_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // クエリの構築
    let query = supabase
      .from('journal_entries')
      .select(
        `
        *,
        journal_entry_lines (
          *,
          account:accounts (
            id,
            code,
            name
          ),
          partner:partners (
            id,
            code,
            name
          )
        ),
        created_user:users!created_by (
          id,
          name,
          email
        ),
        approved_user:users!approved_by (
          id,
          name,
          email
        )
      `,
        { count: 'exact' }
      )
      .order('entry_date', { ascending: false })
      .order('entry_number', { ascending: false });

    // フィルタの適用
    if (periodId) {
      query = query.eq('accounting_period_id', periodId);
    }
    if (startDate) {
      query = query.gte('entry_date', startDate);
    }
    if (endDate) {
      query = query.lte('entry_date', endDate);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (search) {
      query = query.or(`description.ilike.%${search}%,entry_number.ilike.%${search}%`);
    }

    // ページネーション
    query = query.range(offset, offset + limit - 1);

    // データ取得
    const { data: entries, error, count } = await query;

    if (error) {
      console.error('Failed to fetch journal entries:', error);
      return NextResponse.json({ error: 'Failed to fetch journal entries' }, { status: 500 });
    }

    // 仕訳明細を整形
    const formattedEntries = entries?.map((entry) => ({
      ...entry,
      totalDebit: entry.journal_entry_lines?.reduce(
        (sum: number, line: { debit_amount?: number }) => sum + (line.debit_amount || 0),
        0
      ),
      totalCredit: entry.journal_entry_lines?.reduce(
        (sum: number, line: { credit_amount?: number }) => sum + (line.credit_amount || 0),
        0
      ),
    }));

    return NextResponse.json({
      data: formattedEntries,
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Journal entries API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * 仕訳作成 API
 * POST /api/journal-entries
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
    if (
      !body.accounting_period_id ||
      !body.entry_date ||
      !body.description ||
      !body.lines ||
      !Array.isArray(body.lines) ||
      body.lines.length < 2
    ) {
      return NextResponse.json(
        { error: 'Required fields are missing or invalid' },
        { status: 400 }
      );
    }

    // 貸借合計のチェック
    const totalDebit = body.lines.reduce(
      (sum: number, line: { debit_amount?: number }) => sum + (line.debit_amount || 0),
      0
    );
    const totalCredit = body.lines.reduce(
      (sum: number, line: { credit_amount?: number }) => sum + (line.credit_amount || 0),
      0
    );

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return NextResponse.json({ error: 'Debit and credit amounts must match' }, { status: 400 });
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

    // 仕訳番号の生成（組織内で連番）
    const entryDate = new Date(body.entry_date);
    const yearMonth = `${entryDate.getFullYear()}${String(entryDate.getMonth() + 1).padStart(2, '0')}`;

    const { data: lastEntry } = await supabase
      .from('journal_entries')
      .select('entry_number')
      .eq('organization_id', orgData.organization_id)
      .like('entry_number', `${yearMonth}%`)
      .order('entry_number', { ascending: false })
      .limit(1)
      .single();

    let entryNumber: string;
    if (lastEntry) {
      const lastNumber = parseInt(lastEntry.entry_number.slice(-4));
      entryNumber = `${yearMonth}${String(lastNumber + 1).padStart(4, '0')}`;
    } else {
      entryNumber = `${yearMonth}0001`;
    }

    // RPC関数を使用して仕訳を作成（トランザクション処理）
    const { data: entryId, error } = await supabase.rpc('create_journal_entry', {
      p_organization_id: orgData.organization_id,
      p_accounting_period_id: body.accounting_period_id,
      p_entry_date: body.entry_date,
      p_description: body.description,
      p_entry_number: entryNumber, // entryNumberを使用
      p_lines: body.lines.map(
        (
          line: {
            account_id: string;
            partner_id?: string | null;
            debit_amount?: number;
            credit_amount?: number;
            tax_amount?: number | null;
            tax_rate?: number | null;
            description?: string | null;
          },
          index: number
        ) => ({
          account_id: line.account_id,
          partner_id: line.partner_id || null,
          debit_amount: line.debit_amount || 0,
          credit_amount: line.credit_amount || 0,
          tax_amount: line.tax_amount || null,
          tax_rate: line.tax_rate || null,
          description: line.description || null,
          line_number: index + 1,
        })
      ),
    });

    if (error) {
      console.error('Failed to create journal entry:', error);
      return NextResponse.json({ error: 'Failed to create journal entry' }, { status: 500 });
    }

    // 作成された仕訳を取得
    const { data: newEntry } = await supabase
      .from('journal_entries')
      .select(
        `
        *,
        journal_entry_lines (
          *,
          account:accounts (
            id,
            code,
            name
          )
        )
      `
      )
      .eq('id', entryId)
      .single();

    return NextResponse.json({ data: newEntry }, { status: 201 });
  } catch (error) {
    console.error('Journal entry creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
