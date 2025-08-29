import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import type {
  BalanceSheetData,
  ProfitLossData,
  TrialBalanceData,
  CashFlowData,
  AccountBalance,
  TrialBalanceItem,
  ReportItem,
} from '../../types';
import type { Database } from '@/lib/supabase/database.types';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { reportType, format, periodId, startDate, endDate } = body;

    // Validate required fields
    if (!reportType || !format) {
      return NextResponse.json({ error: 'reportType and format are required' }, { status: 400 });
    }

    if (!['balance-sheet', 'profit-loss', 'trial-balance', 'cash-flow'].includes(reportType)) {
      return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
    }

    if (!['pdf', 'excel', 'csv'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Supported formats: pdf, excel, csv' },
        { status: 400 }
      );
    }

    // Get report data based on type
    const baseUrl = request.nextUrl.origin;

    // Build query params
    const params = new URLSearchParams();
    if (periodId) params.append('periodId', periodId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    // Fetch report data from the appropriate endpoint
    const reportResponse = await fetch(
      `${baseUrl}/api/v2/reports/${reportType}?${params.toString()}`,
      {
        headers: {
          cookie: request.headers.get('cookie') || '',
        },
      }
    );

    if (!reportResponse.ok) {
      const error = await reportResponse.json();
      return NextResponse.json(error, { status: reportResponse.status });
    }

    const reportData = await reportResponse.json();

    // Generate export based on format
    switch (format) {
      case 'csv':
        return generateCSV(reportData, reportType);
      case 'excel':
        return generateExcel(reportData, reportType);
      case 'pdf':
        // For PDF, we'll return a job ID and process asynchronously
        // This would typically invoke a Supabase Edge Function
        return NextResponse.json({
          message: 'PDF generation queued',
          jobId: crypto.randomUUID(),
          estimatedTime: 30, // seconds
        });
      default:
        return NextResponse.json({ error: 'Format not implemented' }, { status: 501 });
    }
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Failed to export report' }, { status: 500 });
  }
}

function generateCSV(
  data: BalanceSheetData | ProfitLossData | TrialBalanceData | CashFlowData,
  reportType: string
): NextResponse {
  let csv = '';

  switch (reportType) {
    case 'balance-sheet':
      csv = generateBalanceSheetCSV(data as BalanceSheetData);
      break;
    case 'profit-loss':
      csv = generateProfitLossCSV(data as ProfitLossData);
      break;
    case 'trial-balance':
      csv = generateTrialBalanceCSV(data as TrialBalanceData);
      break;
    case 'cash-flow':
      csv = generateCashFlowCSV(data as CashFlowData);
      break;
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${reportType}-${Date.now()}.csv"`,
    },
  });
}

function generateBalanceSheetCSV(data: BalanceSheetData): string {
  const lines: string[] = [];
  lines.push('Balance Sheet');
  lines.push('');
  lines.push('Category,Account Code,Account Name,Balance');

  // Assets
  lines.push('ASSETS');
  lines.push('Current Assets');
  data.assets.current.forEach((item: AccountBalance) => {
    lines.push(`,,${item.code},${item.name},${item.balance}`);
  });
  lines.push('Fixed Assets');
  data.assets.fixed.forEach((item: AccountBalance) => {
    lines.push(`,,${item.code},${item.name},${item.balance}`);
  });
  lines.push(`Total Assets,,,${data.assets.total}`);

  // Liabilities
  lines.push('');
  lines.push('LIABILITIES');
  lines.push('Current Liabilities');
  data.liabilities.current.forEach((item: AccountBalance) => {
    lines.push(`,,${item.code},${item.name},${item.balance}`);
  });
  lines.push('Long-term Liabilities');
  data.liabilities.longTerm.forEach((item: AccountBalance) => {
    lines.push(`,,${item.code},${item.name},${item.balance}`);
  });
  lines.push(`Total Liabilities,,,${data.liabilities.total}`);

  // Equity
  lines.push('');
  lines.push('EQUITY');
  data.equity.capital.forEach((item: AccountBalance) => {
    lines.push(`,,${item.code},${item.name},${item.balance}`);
  });
  data.equity.retained.forEach((item: AccountBalance) => {
    lines.push(`,,${item.code},${item.name},${item.balance}`);
  });
  lines.push(`Total Equity,,,${data.equity.total}`);

  lines.push('');
  lines.push(`Total Liabilities and Equity,,,${data.totalLiabilitiesAndEquity}`);

  return lines.join('\n');
}

function generateProfitLossCSV(data: ProfitLossData): string {
  const lines: string[] = [];
  lines.push('Profit & Loss Statement');
  lines.push('');
  lines.push('Category,Account Code,Account Name,Amount');

  // Revenue
  lines.push('REVENUE');
  lines.push('Sales');
  data.revenue.sales.forEach((item: AccountBalance) => {
    lines.push(`,,${item.code},${item.name},${item.balance}`);
  });
  lines.push('Other Revenue');
  data.revenue.other.forEach((item: AccountBalance) => {
    lines.push(`,,${item.code},${item.name},${item.balance}`);
  });
  lines.push(`Total Revenue,,,${data.revenue.total}`);

  // Expenses
  lines.push('');
  lines.push('EXPENSES');
  lines.push('Cost of Sales');
  data.expenses.costOfSales.forEach((item: AccountBalance) => {
    lines.push(`,,${item.code},${item.name},${item.balance}`);
  });
  lines.push('Operating Expenses');
  data.expenses.operating.forEach((item: AccountBalance) => {
    lines.push(`,,${item.code},${item.name},${item.balance}`);
  });
  lines.push('Financial Expenses');
  data.expenses.financial.forEach((item: AccountBalance) => {
    lines.push(`,,${item.code},${item.name},${item.balance}`);
  });
  lines.push('Other Expenses');
  data.expenses.other.forEach((item: AccountBalance) => {
    lines.push(`,,${item.code},${item.name},${item.balance}`);
  });
  lines.push(`Total Expenses,,,${data.expenses.total}`);

  lines.push('');
  lines.push(`Gross Profit,,,${data.grossProfit}`);
  lines.push(`Operating Profit,,,${data.operatingProfit}`);
  lines.push(`Net Profit,,,${data.netProfit}`);

  return lines.join('\n');
}

function generateTrialBalanceCSV(data: TrialBalanceData): string {
  const lines: string[] = [];
  lines.push('Trial Balance');
  lines.push('');
  lines.push('Account Code,Account Name,Debit Total,Credit Total,Debit Balance,Credit Balance');

  data.items.forEach((item: TrialBalanceItem) => {
    lines.push(
      [
        item.account.code,
        item.account.name,
        item.debitTotal,
        item.creditTotal,
        item.debitBalance,
        item.creditBalance,
      ].join(',')
    );
  });

  lines.push('');
  lines.push(
    [
      'TOTALS',
      '',
      data.totals.debitTotal,
      data.totals.creditTotal,
      data.totals.debitBalance,
      data.totals.creditBalance,
    ].join(',')
  );

  lines.push('');
  lines.push(`Balanced: ${data.isBalanced ? 'Yes' : 'No'}`);

  return lines.join('\n');
}

function generateCashFlowCSV(data: CashFlowData): string {
  const lines: string[] = [];
  lines.push('Cash Flow Statement');
  lines.push('');
  lines.push('Category,Description,Amount');

  // Operating Activities
  lines.push('OPERATING ACTIVITIES');
  lines.push('Receipts');
  data.operating.receipts.forEach((item: ReportItem) => {
    lines.push(`,,${item.description},${item.amount}`);
  });
  lines.push('Payments');
  data.operating.payments.forEach((item: ReportItem) => {
    lines.push(`,,${item.description},-${item.amount}`);
  });
  lines.push(`Net Cash from Operating Activities,,${data.operating.net}`);

  // Investing Activities
  lines.push('');
  lines.push('INVESTING ACTIVITIES');
  lines.push('Receipts');
  data.investing.receipts.forEach((item: ReportItem) => {
    lines.push(`,,${item.description},${item.amount}`);
  });
  lines.push('Payments');
  data.investing.payments.forEach((item: ReportItem) => {
    lines.push(`,,${item.description},-${item.amount}`);
  });
  lines.push(`Net Cash from Investing Activities,,${data.investing.net}`);

  // Financing Activities
  lines.push('');
  lines.push('FINANCING ACTIVITIES');
  lines.push('Receipts');
  data.financing.receipts.forEach((item: ReportItem) => {
    lines.push(`,,${item.description},${item.amount}`);
  });
  lines.push('Payments');
  data.financing.payments.forEach((item: ReportItem) => {
    lines.push(`,,${item.description},-${item.amount}`);
  });
  lines.push(`Net Cash from Financing Activities,,${data.financing.net}`);

  lines.push('');
  lines.push(`Beginning Cash Balance,,${data.beginningCash}`);
  lines.push(`Net Change in Cash,,${data.netChange}`);
  lines.push(`Ending Cash Balance,,${data.endingCash}`);

  return lines.join('\n');
}

function generateExcel(
  _data: BalanceSheetData | ProfitLossData | TrialBalanceData | CashFlowData,
  _reportType: string
): NextResponse {
  // For now, return a placeholder response
  // In production, this would use a library like ExcelJS
  return NextResponse.json(
    {
      message: 'Excel generation not yet implemented',
      suggestion: 'Use CSV format for now',
    },
    { status: 501 }
  );
}
