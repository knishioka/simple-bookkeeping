'use client';

import { Calendar, Download } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { getBalanceSheetWithAuth } from '@/app/actions/reports-wrapper';
import { ReportLayout } from '@/components/common/ReportLayout';
import { ReportTable, ReportItem } from '@/components/common/ReportTable';
import { ExportDialog } from '@/components/reports/ExportDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useServerAction } from '@/hooks/useServerAction';
import { getToday } from '@/lib/formatters';

interface BalanceSheetItem {
  category: string;
  subCategory: string | null;
  accountCode: string;
  accountName: string;
  amount: number;
}

// Note: Using the type from Server Action response instead
interface BalanceSheetData {
  assets: {
    current: BalanceSheetItem[];
    fixed: BalanceSheetItem[];
    deferred: BalanceSheetItem[];
    totalAssets: number;
  };
  liabilities: {
    current: BalanceSheetItem[];
    fixed: BalanceSheetItem[];
    totalLiabilities: number;
  };
  equity: {
    capital: BalanceSheetItem[];
    retainedEarnings: BalanceSheetItem[];
    currentPeriodIncome: number;
    totalEquity: number;
  };
  totalLiabilitiesAndEquity: number;
}

export default function BalanceSheetPage() {
  const [asOfDate, setAsOfDate] = useState(getToday());
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const { execute, data: rawData, isLoading } = useServerAction(getBalanceSheetWithAuth);
  const data = rawData as BalanceSheetData | null;

  const fetchBalanceSheet = useCallback(async () => {
    await execute(asOfDate, undefined, {
      errorMessage: '貸借対照表の取得に失敗しました',
      showToast: true,
    });
  }, [execute, asOfDate]);

  useEffect(() => {
    fetchBalanceSheet();
  }, [fetchBalanceSheet]);

  const handleExport = () => {
    setExportDialogOpen(true);
  };

  // Transform data to ReportItem format
  const transformToReportItems = (items: BalanceSheetItem[], level = 1): ReportItem[] => {
    return items.map((item) => ({
      id: item.accountCode,
      name: item.accountName,
      code: item.accountCode,
      amount: item.amount,
      level,
    }));
  };

  const assetItems: ReportItem[] = data
    ? [
        { name: '流動資産', amount: 0, isTotal: true },
        ...transformToReportItems(data.assets.current),
        {
          name: '流動資産合計',
          amount: data.assets.current.reduce((sum, item) => sum + item.amount, 0),
          level: 1,
          isTotal: true,
        },
        { name: '固定資産', amount: 0, isTotal: true },
        ...transformToReportItems(data.assets.fixed),
        {
          name: '固定資産合計',
          amount: data.assets.fixed.reduce((sum, item) => sum + item.amount, 0),
          level: 1,
          isTotal: true,
        },
        { name: '資産合計', amount: data.assets.totalAssets, isTotal: true },
      ]
    : [];

  const liabilityEquityItems: ReportItem[] = data
    ? [
        { name: '流動負債', amount: 0, isTotal: true },
        ...transformToReportItems(data.liabilities.current),
        {
          name: '流動負債合計',
          amount: data.liabilities.current.reduce((sum, item) => sum + item.amount, 0),
          level: 1,
          isTotal: true,
        },
        { name: '固定負債', amount: 0, isTotal: true },
        ...transformToReportItems(data.liabilities.fixed),
        {
          name: '固定負債合計',
          amount: data.liabilities.fixed.reduce((sum, item) => sum + item.amount, 0),
          level: 1,
          isTotal: true,
        },
        { name: '負債合計', amount: data.liabilities.totalLiabilities, isTotal: true },
        { name: '純資産', amount: 0, isTotal: true },
        ...transformToReportItems(data.equity.capital),
        ...transformToReportItems(data.equity.retainedEarnings),
        { name: '純資産合計', amount: data.equity.totalEquity, isTotal: true },
        { name: '負債・純資産合計', amount: data.totalLiabilitiesAndEquity, isTotal: true },
      ]
    : [];

  return (
    <ReportLayout title="貸借対照表" subtitle={`基準日: ${asOfDate}`}>
      <div className="space-y-6">
        <div className="no-print">
          <Card>
            <CardHeader>
              <CardTitle>基準日選択</CardTitle>
              <CardDescription>貸借対照表の基準日を選択してください</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 items-end">
                <div className="flex-1 max-w-xs">
                  <label className="text-sm font-medium">基準日</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="date"
                      value={asOfDate}
                      onChange={(e) => setAsOfDate(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Button onClick={fetchBalanceSheet} disabled={isLoading}>
                  表示
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              エクスポート
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8">読み込み中...</div>
        ) : data ? (
          <div className="grid grid-cols-2 gap-6 print:gap-0">
            {/* 資産の部 */}
            <Card className="print:shadow-none print:border-r">
              <CardHeader>
                <CardTitle>資産の部</CardTitle>
              </CardHeader>
              <CardContent>
                <ReportTable items={assetItems} showCode={false} />
              </CardContent>
            </Card>

            {/* 負債・純資産の部 */}
            <Card className="print:shadow-none">
              <CardHeader>
                <CardTitle>負債・純資産の部</CardTitle>
              </CardHeader>
              <CardContent>
                <ReportTable items={liabilityEquityItems} showCode={false} />
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">データがありません</div>
        )}
      </div>
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        reportType="balance-sheet"
        reportParams={{ asOf: asOfDate }}
      />
    </ReportLayout>
  );
}
