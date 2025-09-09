'use client';

import { Calendar, Plus, Search, Upload } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';

import {
  getJournalEntriesWithAuth,
  approveJournalEntryWithAuth,
} from '@/app/actions/journal-entries-wrapper';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useServerAction } from '@/hooks/useServerAction';

// Lazy load heavy dialog components
const JournalEntryDialog = lazy(() =>
  import('@/components/journal-entries/journal-entry-dialog').then((mod) => ({
    default: mod.JournalEntryDialog,
  }))
);
const JournalEntryImportDialog = lazy(() =>
  import('@/components/journal-entries/journal-entry-import-dialog').then((mod) => ({
    default: mod.JournalEntryImportDialog,
  }))
);

interface JournalEntryLine {
  id: string;
  accountId: string;
  account: {
    id: string;
    code: string;
    name: string;
  };
  debitAmount: number;
  creditAmount: number;
  description?: string | null;
  taxRate?: number | null;
}

interface JournalEntry {
  id: string;
  entryNumber: string;
  entryDate: string;
  description: string;
  status: 'DRAFT' | 'APPROVED' | 'CANCELLED';
  documentNumber?: string;
  lines: JournalEntryLine[];
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
}

const statusLabels = {
  DRAFT: '下書き',
  APPROVED: '承認済',
  CANCELLED: 'キャンセル',
};

const statusColors = {
  DRAFT: 'bg-gray-100 text-gray-800',
  APPROVED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export default function JournalEntriesPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const { execute: fetchEntriesAction, isLoading } = useServerAction(getJournalEntriesWithAuth);
  const { execute: approveAction } = useServerAction(approveJournalEntryWithAuth);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  useEffect(() => {
    fetchJournalEntries();

    // Preload heavy components in the background after initial render
    const timer = setTimeout(() => {
      import('@/components/journal-entries/journal-entry-dialog');
      import('@/components/journal-entries/journal-entry-import-dialog');
    }, 1000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchJournalEntries = async () => {
    try {
      const result = await fetchEntriesAction(undefined, {
        showToast: false, // Don't show toast on initial load
      });

      if (result && result.items) {
        // Transform the data to match the expected format
        const transformedEntries = result.items.map((entry) => ({
          id: entry.id,
          entryNumber: entry.entry_number,
          entryDate: entry.entry_date,
          description: entry.description,
          status: entry.status.toUpperCase() as 'DRAFT' | 'APPROVED' | 'CANCELLED',
          documentNumber: undefined, // document_number field doesn't exist in current schema
          lines: entry.lines.map((line) => ({
            id: line.id,
            accountId: line.account_id,
            account: line.account || {
              id: line.account_id,
              code: '',
              name: '',
            },
            debitAmount: line.debit_amount || 0,
            creditAmount: line.credit_amount || 0,
            description: line.description,
            taxRate: line.tax_rate,
          })),
          totalAmount: entry.totalAmount || 0,
          createdAt: entry.created_at,
          updatedAt: entry.updated_at,
        }));

        setEntries(transformedEntries);
      }
    } catch (error) {
      console.error('Failed to fetch journal entries:', error);
    }
  };

  const filteredEntries = entries.filter((entry) => {
    const matchesSearch =
      entry.entryNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.documentNumber &&
        entry.documentNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = selectedStatus === 'all' || entry.status === selectedStatus;
    const matchesMonth = !selectedMonth || entry.entryDate.startsWith(selectedMonth);
    return matchesSearch && matchesStatus && matchesMonth;
  });

  const handleCreate = () => {
    setEditingEntry(null);
    setDialogOpen(true);
  };

  const handleEdit = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setDialogOpen(true);
  };

  const handleApprove = async (entry: JournalEntry) => {
    try {
      await approveAction(entry.id, {
        successMessage: '仕訳を承認しました',
        errorMessage: '仕訳の承認に失敗しました',
        onSuccess: () => fetchJournalEntries(),
      });
    } catch (error) {
      console.error('Failed to approve journal entry:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">仕訳入力</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setImportDialogOpen(true)}
            data-testid="journal-entry-import-button"
          >
            <Upload className="mr-2 h-4 w-4" />
            CSVインポート
          </Button>
          <Button onClick={handleCreate} data-testid="journal-entry-create-button">
            <Plus className="mr-2 h-4 w-4" />
            新規作成
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>仕訳一覧</CardTitle>
          <CardDescription>登録されている仕訳を確認・編集できます</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="仕訳番号、摘要、証憑番号で検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="journal-entries-search-input"
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="pl-10 w-[200px]"
                data-testid="journal-entries-month-filter"
              />
            </div>
            <Select
              value={selectedStatus}
              onValueChange={setSelectedStatus}
              data-testid="journal-entries-status-filter"
            >
              <SelectTrigger className="w-[150px]" data-testid="journal-entries-status-trigger">
                <SelectValue placeholder="ステータス" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                <SelectItem value="DRAFT">下書き</SelectItem>
                <SelectItem value="APPROVED">承認済</SelectItem>
                <SelectItem value="CANCELLED">キャンセル</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="text-center py-8">読み込み中...</div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-8 text-gray-500">仕訳が見つかりません</div>
          ) : (
            <Table data-testid="journal-entries-table">
              <TableHeader>
                <TableRow>
                  <TableHead>仕訳番号</TableHead>
                  <TableHead>日付</TableHead>
                  <TableHead>摘要</TableHead>
                  <TableHead>借方</TableHead>
                  <TableHead>貸方</TableHead>
                  <TableHead>金額</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono">{entry.entryNumber}</TableCell>
                    <TableCell>{formatDate(entry.entryDate)}</TableCell>
                    <TableCell>{entry.description}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {entry.lines
                          .filter((line) => line.debitAmount > 0)
                          .map((line, idx) => (
                            <div key={idx} className="text-sm">
                              {line.account.name}
                            </div>
                          ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {entry.lines
                          .filter((line) => line.creditAmount > 0)
                          .map((line, idx) => (
                            <div key={idx} className="text-sm">
                              {line.account.name}
                            </div>
                          ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatAmount(entry.totalAmount)}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          statusColors[entry.status]
                        }`}
                      >
                        {statusLabels[entry.status]}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        {entry.status === 'DRAFT' && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(entry)}>
                              編集
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleApprove(entry)}>
                              承認
                            </Button>
                          </>
                        )}
                        {entry.status === 'APPROVED' && (
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(entry)}>
                            詳細
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Suspense fallback={<div className="fixed inset-0 bg-black/50" />}>
        <JournalEntryDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          entry={editingEntry}
          onSuccess={fetchJournalEntries}
        />
      </Suspense>
      <Suspense fallback={<div className="fixed inset-0 bg-black/50" />}>
        <JournalEntryImportDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          onSuccess={fetchJournalEntries}
        />
      </Suspense>
    </div>
  );
}
