'use client';

import { Download } from 'lucide-react';
import { useEffect } from 'react';
import { toast } from 'react-hot-toast';

import { DateRangePicker } from '@/components/common/DateRangePicker';
import { LedgerTable, LedgerEntry } from '@/components/common/LedgerTable';
import { ReportLayout } from '@/components/common/ReportLayout';
import { Button } from '@/components/ui/button';
import { useApiCall } from '@/hooks/useApiCall';
import { useDateRange } from '@/hooks/useDateRange';
import { apiClient } from '@/lib/api-client';
import { formatAmount } from '@/lib/formatters';

interface CashBookResponse {
  openingBalance: number;
  entries: Array<{
    id: string;
    date: string;
    entryNumber: string;
    description: string;
    debitAmount: number;
    creditAmount: number;
    balance: number;
    counterAccountName?: string;
  }>;
  closingBalance: number;
}

export default function CashBookPage() {
  const { startDate, endDate, setStartDate, setEndDate } = useDateRange();
  const { data, loading, execute } = useApiCall<CashBookResponse>();

  const fetchCashBook = () => {
    execute(
      () => apiClient.get('/ledgers/cash-book', {
        params: { startDate, endDate },
      }),
      {
        errorMessage: '現金出納帳の取得に失敗しました',
      }
    );
  };

  useEffect(() => {
    fetchCashBook();
  }, []);

  const handleExport = () => {
    toast.success('エクスポート機能は開発中です');
  };

  // Transform API response to match LedgerEntry interface
  const transformedEntries: LedgerEntry[] = data?.entries.map((entry) => ({
    id: entry.id,
    entryDate: entry.date,
    description: entry.description,
    debitAmount: entry.debitAmount,
    creditAmount: entry.creditAmount,
    balance: entry.balance,
    accountName: entry.counterAccountName,
  })) || [];

  return (
    <ReportLayout
      title="現金出納帳"
      subtitle={`${startDate} 〜 ${endDate}`}
    >
      <div className="space-y-6">
        <div className="no-print">
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            onSearch={fetchCashBook}
            loading={loading}
          />
          
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
          <>
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between">
                <span className="font-medium">前月繰越</span>
                <span className="font-medium">
                  {formatAmount(data.openingBalance)} 円
                </span>
              </div>
            </div>

            <LedgerTable 
              entries={transformedEntries}
              emptyMessage="該当する取引がありません"
            />

            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between">
                <span className="font-medium">次月繰越</span>
                <span className="font-medium">
                  {formatAmount(data.closingBalance)} 円
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-gray-500">
            データがありません
          </div>
        )}
      </div>
    </ReportLayout>
  );
}