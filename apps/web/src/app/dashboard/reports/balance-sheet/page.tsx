'use client';

import { Calendar, Download } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { ReportLayout } from '@/components/common/ReportLayout';
import { ReportTable, ReportItem } from '@/components/common/ReportTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useApiCall } from '@/hooks/useApiCall';
import { apiClient } from '@/lib/api-client';
import { getToday } from '@/lib/formatters';

interface AccountBalance {
  accountId: string;
  accountCode: string;
  accountName: string;
  balance: number;
  children?: AccountBalance[];
}

interface BalanceSheetData {
  assets: {
    current: AccountBalance[];
    fixed: AccountBalance[];
    totalAssets: number;
  };
  liabilities: {
    current: AccountBalance[];
    longTerm: AccountBalance[];
    totalLiabilities: number;
  };
  equity: {
    items: AccountBalance[];
    totalEquity: number;
  };
  totalLiabilitiesAndEquity: number;
}

export default function BalanceSheetPage() {
  const [asOfDate, setAsOfDate] = useState(getToday());
  const { data, loading, execute } = useApiCall<BalanceSheetData>();

  const fetchBalanceSheet = useCallback(() => {
    execute(() => apiClient.get<BalanceSheetData>(`/reports/balance-sheet?asOfDate=${asOfDate}`), {
      errorMessage: '貸借対照表の取得に失敗しました',
    });
  }, [execute, asOfDate]);

  useEffect(() => {
    fetchBalanceSheet();
  }, [fetchBalanceSheet]);

  const handleExport = () => {
    toast.success('エクスポート機能は開発中です');
  };

  // Transform data to ReportItem format
  const transformToReportItems = (accounts: AccountBalance[], level = 1): ReportItem[] => {
    return accounts.map((account) => ({
      id: account.accountId,
      name: account.accountName,
      code: account.accountCode,
      amount: account.balance,
      level,
      children: account.children ? transformToReportItems(account.children, level + 1) : undefined,
    }));
  };

  const assetItems: ReportItem[] = data
    ? [
        { name: '流動資産', amount: 0, isTotal: true },
        ...transformToReportItems(data.assets.current),
        {
          name: '流動資産合計',
          amount: data.assets.current.reduce((sum, acc) => sum + acc.balance, 0),
          level: 1,
          isTotal: true,
        },
        { name: '固定資産', amount: 0, isTotal: true },
        ...transformToReportItems(data.assets.fixed),
        {
          name: '固定資産合計',
          amount: data.assets.fixed.reduce((sum, acc) => sum + acc.balance, 0),
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
          amount: data.liabilities.current.reduce((sum, acc) => sum + acc.balance, 0),
          level: 1,
          isTotal: true,
        },
        { name: '固定負債', amount: 0, isTotal: true },
        ...transformToReportItems(data.liabilities.longTerm),
        {
          name: '固定負債合計',
          amount: data.liabilities.longTerm.reduce((sum, acc) => sum + acc.balance, 0),
          level: 1,
          isTotal: true,
        },
        { name: '負債合計', amount: data.liabilities.totalLiabilities, isTotal: true },
        { name: '純資産', amount: 0, isTotal: true },
        ...transformToReportItems(data.equity.items),
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
                <Button onClick={fetchBalanceSheet} disabled={loading}>
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

        {loading ? (
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
    </ReportLayout>
  );
}
