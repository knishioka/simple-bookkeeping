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

interface LedgerEntry {
  id: string;
  date: string;
  entryNumber: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  balance: number;
  counterAccountName?: string;
}

interface AccountsReceivableData {
  openingBalance: number;
  entries: LedgerEntry[];
  closingBalance: number;
}

export default function AccountsReceivablePage() {
  const [data, setData] = useState<AccountsReceivableData | null>(null);
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

  const fetchAccountsReceivable = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<AccountsReceivableData>(
        `/ledgers/accounts-receivable?startDate=${startDate}&endDate=${endDate}`
      );
      if (response.data) {
        setData(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch accounts receivable:', error);
      toast.error('売掛金台帳の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchAccountsReceivable();
  }, [fetchAccountsReceivable]);

  const handleDateChange = () => {
    fetchAccountsReceivable();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ja-JP').format(amount);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    // CSV エクスポート機能（後で実装）
    toast.success('エクスポート機能は開発中です');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">売掛金台帳</h1>
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
          <CardDescription>表示する期間を選択してください</CardDescription>
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
          <CardTitle>売掛金台帳</CardTitle>
          <CardDescription>
            {startDate} 〜 {endDate}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">読み込み中...</div>
          ) : data ? (
            <>
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between">
                  <span className="font-medium">前月繰越</span>
                  <span className="font-medium">{formatAmount(data.openingBalance)} 円</span>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>日付</TableHead>
                    <TableHead>伝票番号</TableHead>
                    <TableHead>摘要</TableHead>
                    <TableHead>相手科目</TableHead>
                    <TableHead className="text-right">売上</TableHead>
                    <TableHead className="text-right">回収</TableHead>
                    <TableHead className="text-right">残高</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        該当する取引がありません
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{formatDate(entry.date)}</TableCell>
                        <TableCell className="font-mono">{entry.entryNumber}</TableCell>
                        <TableCell>{entry.description}</TableCell>
                        <TableCell>{entry.counterAccountName || '-'}</TableCell>
                        <TableCell className="text-right">
                          {entry.debitAmount > 0 ? formatAmount(entry.debitAmount) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.creditAmount > 0 ? formatAmount(entry.creditAmount) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatAmount(entry.balance)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between">
                  <span className="font-medium">次月繰越</span>
                  <span className="font-medium">{formatAmount(data.closingBalance)} 円</span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">データがありません</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
