'use client';

import { Calendar, Plus, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { JournalEntryDialog } from '@/components/journal-entries/journal-entry-dialog';
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
import { apiClient } from '@/lib/api-client';

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
  description?: string;
  taxRate?: number;
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
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  useEffect(() => {
    fetchJournalEntries();
  }, []);

  const fetchJournalEntries = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<JournalEntry[]>('/journal-entries');
      if (response.data) {
        setEntries(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch journal entries:', error);
      toast.error('仕訳の取得に失敗しました');
    } finally {
      setLoading(false);
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
      const response = await apiClient.post(`/journal-entries/${entry.id}/approve`);
      if (response.data) {
        toast.success('仕訳を承認しました');
        fetchJournalEntries();
      }
    } catch (error) {
      console.error('Failed to approve journal entry:', error);
      toast.error('仕訳の承認に失敗しました');
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
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          新規作成
        </Button>
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
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="pl-10 w-[200px]"
              />
            </div>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[150px]">
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

          {loading ? (
            <div className="text-center py-8">読み込み中...</div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-8 text-gray-500">仕訳が見つかりません</div>
          ) : (
            <Table>
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

      <JournalEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entry={editingEntry}
        onSuccess={fetchJournalEntries}
      />
    </div>
  );
}
