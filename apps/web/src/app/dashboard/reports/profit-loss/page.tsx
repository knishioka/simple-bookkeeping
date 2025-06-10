'use client';

import { Calendar, Download, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/table';
import { apiClient } from '@/lib/api-client';

interface AccountBalance {
  accountId: string;
  accountCode: string;
  accountName: string;
  balance: number;
  children?: AccountBalance[];
}

interface ProfitLossData {
  revenue: {
    sales: AccountBalance[];
    otherRevenue: AccountBalance[];
    totalRevenue: number;
  };
  expenses: {
    costOfSales: AccountBalance[];
    sellingExpenses: AccountBalance[];
    administrativeExpenses: AccountBalance[];
    otherExpenses: AccountBalance[];
    totalExpenses: number;
  };
  operatingIncome: number;
  nonOperatingIncome: AccountBalance[];
  nonOperatingExpenses: AccountBalance[];
  ordinaryIncome: number;
  extraordinaryIncome: AccountBalance[];
  extraordinaryLosses: AccountBalance[];
  netIncomeBeforeTax: number;
  incomeTax: number;
  netIncome: number;
}

export default function ProfitLossPage() {
  const [data, setData] = useState<ProfitLossData | null>(null);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1); // 月初
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    date.setDate(0); // 月末
    return date.toISOString().split('T')[0];
  });

  const fetchProfitLoss = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/reports/profit-loss', {
        params: { startDate, endDate },
      });
      setData(response.data.data);
    } catch (error) {
      console.error('Failed to fetch profit loss:', error);
      toast.error('損益計算書の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfitLoss();
  }, []);

  const handleDateChange = () => {
    fetchProfitLoss();
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ja-JP').format(Math.abs(amount));
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    // CSV エクスポート機能（後で実装）
    toast.success('エクスポート機能は開発中です');
  };

  const renderAccountRow = (account: AccountBalance, level = 0) => {
    const paddingLeft = level * 20;
    return (
      <>
        <TableRow key={account.accountId}>
          <TableCell style={{ paddingLeft: `${paddingLeft + 16}px` }}>
            {account.accountName}
          </TableCell>
          <TableCell className="text-right">
            {formatAmount(account.balance)}
          </TableCell>
        </TableRow>
        {account.children?.map((child) => renderAccountRow(child, level + 1))}
      </>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">損益計算書</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            印刷
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            エクスポート
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>期間選択</CardTitle>
          <CardDescription>
            損益計算書の対象期間を選択してください
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium">開始日</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium">終了日</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Button onClick={handleDateChange} disabled={loading}>
              表示
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="print:shadow-none">
        <CardHeader>
          <CardTitle>損益計算書</CardTitle>
          <CardDescription>
            {startDate} 〜 {endDate}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">読み込み中...</div>
          ) : data ? (
            <Table>
              <TableBody>
                {/* 売上高 */}
                <TableRow>
                  <TableCell className="font-bold">売上高</TableCell>
                  <TableCell></TableCell>
                </TableRow>
                {data.revenue.sales.map((account) => renderAccountRow(account, 1))}
                <TableRow className="border-t-2">
                  <TableCell className="font-bold pl-8">売上高合計</TableCell>
                  <TableCell className="text-right font-bold">
                    {formatAmount(data.revenue.totalRevenue)}
                  </TableCell>
                </TableRow>

                {/* 売上原価 */}
                <TableRow>
                  <TableCell className="font-bold pt-4">売上原価</TableCell>
                  <TableCell></TableCell>
                </TableRow>
                {data.expenses.costOfSales.map((account) => renderAccountRow(account, 1))}
                <TableRow className="border-t-2">
                  <TableCell className="font-bold pl-8">売上原価合計</TableCell>
                  <TableCell className="text-right font-bold">
                    {formatAmount(data.expenses.costOfSales.reduce((sum, acc) => sum + acc.balance, 0))}
                  </TableCell>
                </TableRow>

                {/* 売上総利益 */}
                <TableRow className="border-t-2 bg-gray-50">
                  <TableCell className="font-bold">売上総利益</TableCell>
                  <TableCell className="text-right font-bold">
                    {formatAmount(data.revenue.totalRevenue - data.expenses.costOfSales.reduce((sum, acc) => sum + acc.balance, 0))}
                  </TableCell>
                </TableRow>

                {/* 販売費及び一般管理費 */}
                <TableRow>
                  <TableCell className="font-bold pt-4">販売費及び一般管理費</TableCell>
                  <TableCell></TableCell>
                </TableRow>
                {data.expenses.sellingExpenses.map((account) => renderAccountRow(account, 1))}
                {data.expenses.administrativeExpenses.map((account) => renderAccountRow(account, 1))}
                <TableRow className="border-t-2">
                  <TableCell className="font-bold pl-8">販売費及び一般管理費合計</TableCell>
                  <TableCell className="text-right font-bold">
                    {formatAmount(
                      data.expenses.sellingExpenses.reduce((sum, acc) => sum + acc.balance, 0) +
                      data.expenses.administrativeExpenses.reduce((sum, acc) => sum + acc.balance, 0)
                    )}
                  </TableCell>
                </TableRow>

                {/* 営業利益 */}
                <TableRow className="border-t-2 bg-gray-50">
                  <TableCell className="font-bold">営業利益</TableCell>
                  <TableCell className="text-right font-bold">
                    {formatAmount(data.operatingIncome)}
                  </TableCell>
                </TableRow>

                {/* 営業外収益・費用 */}
                {data.nonOperatingIncome.length > 0 && (
                  <>
                    <TableRow>
                      <TableCell className="font-bold pt-4">営業外収益</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    {data.nonOperatingIncome.map((account) => renderAccountRow(account, 1))}
                  </>
                )}
                {data.nonOperatingExpenses.length > 0 && (
                  <>
                    <TableRow>
                      <TableCell className="font-bold pt-4">営業外費用</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    {data.nonOperatingExpenses.map((account) => renderAccountRow(account, 1))}
                  </>
                )}

                {/* 経常利益 */}
                <TableRow className="border-t-2 bg-gray-50">
                  <TableCell className="font-bold">経常利益</TableCell>
                  <TableCell className="text-right font-bold">
                    {formatAmount(data.ordinaryIncome)}
                  </TableCell>
                </TableRow>

                {/* 特別損益 */}
                {data.extraordinaryIncome.length > 0 && (
                  <>
                    <TableRow>
                      <TableCell className="font-bold pt-4">特別利益</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    {data.extraordinaryIncome.map((account) => renderAccountRow(account, 1))}
                  </>
                )}
                {data.extraordinaryLosses.length > 0 && (
                  <>
                    <TableRow>
                      <TableCell className="font-bold pt-4">特別損失</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    {data.extraordinaryLosses.map((account) => renderAccountRow(account, 1))}
                  </>
                )}

                {/* 税引前当期純利益 */}
                <TableRow className="border-t-2 bg-gray-50">
                  <TableCell className="font-bold">税引前当期純利益</TableCell>
                  <TableCell className="text-right font-bold">
                    {formatAmount(data.netIncomeBeforeTax)}
                  </TableCell>
                </TableRow>

                {/* 法人税等 */}
                {data.incomeTax > 0 && (
                  <TableRow>
                    <TableCell className="pl-8">法人税等</TableCell>
                    <TableCell className="text-right">
                      {formatAmount(data.incomeTax)}
                    </TableCell>
                  </TableRow>
                )}

                {/* 当期純利益 */}
                <TableRow className="border-t-4 bg-blue-50">
                  <TableCell className="font-bold text-lg">当期純利益</TableCell>
                  <TableCell className="text-right font-bold text-lg">
                    {formatAmount(data.netIncome)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-gray-500">
              データがありません
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}