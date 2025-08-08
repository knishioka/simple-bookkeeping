'use client';

import { Calendar, Download, Printer } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiClient } from '@/lib/api-client';

interface TrialBalanceEntry {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  debitBalance: number;
  creditBalance: number;
}

interface TrialBalanceData {
  entries: TrialBalanceEntry[];
  totalDebit: number;
  totalCredit: number;
}

export default function TrialBalancePage() {
  const [data, setData] = useState<TrialBalanceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [asOfDate, setAsOfDate] = useState(() => {
    const date = new Date();
    return date.toISOString().split('T')[0];
  });

  const fetchTrialBalance = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<TrialBalanceData>(
        `/reports/trial-balance?asOfDate=${asOfDate}`
      );
      if (response.data) {
        setData(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch trial balance:', error);
      toast.error('試算表の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [asOfDate]);

  useEffect(() => {
    fetchTrialBalance();
  }, [fetchTrialBalance]);

  const handleDateChange = () => {
    fetchTrialBalance();
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

  const accountTypeLabels: { [key: string]: string } = {
    ASSET: '資産',
    LIABILITY: '負債',
    EQUITY: '純資産',
    REVENUE: '収益',
    EXPENSE: '費用',
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">試算表</h1>
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
          <CardTitle>基準日選択</CardTitle>
          <CardDescription>試算表の基準日を選択してください</CardDescription>
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
            <Button onClick={handleDateChange} disabled={loading}>
              表示
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="print:shadow-none">
        <CardHeader>
          <CardTitle>試算表</CardTitle>
          <CardDescription>基準日: {asOfDate}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">読み込み中...</div>
          ) : data ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>科目コード</TableHead>
                    <TableHead>科目名</TableHead>
                    <TableHead>科目タイプ</TableHead>
                    <TableHead className="text-right">借方残高</TableHead>
                    <TableHead className="text-right">貸方残高</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                        データがありません
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {data.entries.map((entry) => (
                        <TableRow key={entry.accountId}>
                          <TableCell className="font-mono">{entry.accountCode}</TableCell>
                          <TableCell>{entry.accountName}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {accountTypeLabels[entry.accountType] || entry.accountType}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {entry.debitBalance > 0 ? formatAmount(entry.debitBalance) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {entry.creditBalance > 0 ? formatAmount(entry.creditBalance) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-t-4 bg-gray-50">
                        <TableCell colSpan={3} className="font-bold text-lg">
                          合計
                        </TableCell>
                        <TableCell className="text-right font-bold text-lg">
                          {formatAmount(data.totalDebit)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-lg">
                          {formatAmount(data.totalCredit)}
                        </TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>

              {data.totalDebit !== data.totalCredit && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800">
                    警告: 借方と貸方の合計が一致していません。仕訳データを確認してください。
                  </p>
                  <p className="text-red-800 mt-2">
                    差額: {formatAmount(Math.abs(data.totalDebit - data.totalCredit))} 円
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">データがありません</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
