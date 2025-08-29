import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

// Edge Runtimeを使用
export const runtime = 'edge';

// ISR設定（Incremental Static Regeneration）
export const revalidate = 60; // 1分間キャッシュ

/**
 * 仕訳一覧取得（Edge Runtime最適化版）
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
    const periodId = searchParams.get('period_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // ページネーション計算
    const from = (page - 1) * limit;
    const to = from + limit - 1;

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
          )
        )
      `,
        { count: 'exact' }
      )
      .order('entry_date', { ascending: false })
      .order('entry_number', { ascending: false })
      .range(from, to);

    // フィルタリング
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    if (periodId) {
      query = query.eq('accounting_period_id', periodId);
    }
    if (startDate) {
      query = query.gte('entry_date', startDate);
    }
    if (endDate) {
      query = query.lte('entry_date', endDate);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // ページネーション情報を含めたレスポンス
    const response = NextResponse.json({
      data,
      meta: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });

    // キャッシュヘッダーの設定
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');

    return response;
  } catch (error) {
    console.error('Error fetching journal entries:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * 仕訳作成（トランザクション処理）
 */
export async function POST(request: NextRequest) {
  try {
    // Supabase環境変数が設定されていない場合は、エラーレスポンスを返す
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json(
        { error: 'Supabase configuration is not available' },
        { status: 503 }
      );
    }

    const supabase = await createClient();
    const body = await request.json();

    // トランザクション的な処理（Supabaseではpostgres関数で実装することが推奨）
    // ここでは簡略化のため、順次処理で実装

    // 1. 仕訳ヘッダーの作成
    const { data: journalEntry, error: entryError } = await supabase
      .from('journal_entries')
      .insert({
        organization_id: body.organization_id,
        accounting_period_id: body.accounting_period_id,
        entry_date: body.entry_date,
        entry_number: body.entry_number,
        description: body.description,
        status: body.status || 'draft',
      })
      .select()
      .single();

    if (entryError) {
      return NextResponse.json({ error: entryError.message }, { status: 400 });
    }

    // 2. 仕訳明細の作成
    const lines = body.lines.map(
      (
        line: {
          account_id: string;
          debit_amount?: number;
          credit_amount?: number;
          description?: string;
        },
        index: number
      ) => ({
        journal_entry_id: journalEntry.id,
        account_id: line.account_id,
        debit_amount: line.debit_amount || 0,
        credit_amount: line.credit_amount || 0,
        line_number: index + 1,
        description: line.description,
      })
    );

    const { error: linesError } = await supabase.from('journal_entry_lines').insert(lines);

    if (linesError) {
      // ロールバック（仕訳ヘッダーを削除）
      await supabase.from('journal_entries').delete().eq('id', journalEntry.id);

      return NextResponse.json({ error: linesError.message }, { status: 400 });
    }

    // 3. 完成した仕訳を取得
    const { data: completeEntry, error: fetchError } = await supabase
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
      .eq('id', journalEntry.id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 400 });
    }

    return NextResponse.json({ data: completeEntry }, { status: 201 });
  } catch (error) {
    console.error('Error creating journal entry:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
