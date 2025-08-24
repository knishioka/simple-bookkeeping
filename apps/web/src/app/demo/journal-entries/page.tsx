'use client';

import { Calendar, Plus, Search, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { JournalEntryDialogDemo } from '@/components/journal-entries/journal-entry-dialog-demo';
import { SimpleEntryDialog } from '@/components/simple-entry/simple-entry-dialog';
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

// Mock data
const mockEntries: JournalEntry[] = [
  {
    id: '1',
    entryNumber: '2024030001',
    entryDate: '2024-03-01',
    description: '現金での商品仕入',
    status: 'APPROVED',
    documentNumber: 'INV-001',
    totalAmount: 110000,
    createdAt: '2024-03-01T09:00:00Z',
    updatedAt: '2024-03-01T09:00:00Z',
    lines: [
      {
        id: '1-1',
        accountId: '1',
        account: { id: '1', code: '5110', name: '仕入高' },
        debitAmount: 100000,
        creditAmount: 0,
        description: '商品仕入',
        taxRate: 10,
      },
      {
        id: '1-2',
        accountId: '2',
        account: { id: '2', code: '2140', name: '仮払消費税' },
        debitAmount: 10000,
        creditAmount: 0,
        description: '消費税',
        taxRate: 0,
      },
      {
        id: '1-3',
        accountId: '3',
        account: { id: '3', code: '1110', name: '現金' },
        debitAmount: 0,
        creditAmount: 110000,
        description: '現金支払',
        taxRate: 0,
      },
    ],
  },
  {
    id: '2',
    entryNumber: '2024030002',
    entryDate: '2024-03-02',
    description: '売上の計上',
    status: 'APPROVED',
    documentNumber: 'SALE-001',
    totalAmount: 220000,
    createdAt: '2024-03-02T14:30:00Z',
    updatedAt: '2024-03-02T14:30:00Z',
    lines: [
      {
        id: '2-1',
        accountId: '4',
        account: { id: '4', code: '1140', name: '売掛金' },
        debitAmount: 220000,
        creditAmount: 0,
        description: '売上代金',
        taxRate: 0,
      },
      {
        id: '2-2',
        accountId: '5',
        account: { id: '5', code: '4110', name: '売上高' },
        debitAmount: 0,
        creditAmount: 200000,
        description: '売上計上',
        taxRate: 10,
      },
      {
        id: '2-3',
        accountId: '6',
        account: { id: '6', code: '2150', name: '仮受消費税' },
        debitAmount: 0,
        creditAmount: 20000,
        description: '消費税',
        taxRate: 0,
      },
    ],
  },
  {
    id: '3',
    entryNumber: '2024030003',
    entryDate: '2024-03-03',
    description: '給料支払',
    status: 'DRAFT',
    totalAmount: 250000,
    createdAt: '2024-03-03T16:00:00Z',
    updatedAt: '2024-03-03T16:00:00Z',
    lines: [
      {
        id: '3-1',
        accountId: '7',
        account: { id: '7', code: '5210', name: '給料手当' },
        debitAmount: 250000,
        creditAmount: 0,
        description: '3月分給料',
        taxRate: 0,
      },
      {
        id: '3-2',
        accountId: '8',
        account: { id: '8', code: '1130', name: '普通預金' },
        debitAmount: 0,
        creditAmount: 250000,
        description: '銀行振込',
        taxRate: 0,
      },
    ],
  },
];

// Mock accounts for demo
const mockAccounts = [
  { id: '1', code: '1110', name: '現金', accountType: 'ASSET' },
  { id: '2', code: '1120', name: '当座預金', accountType: 'ASSET' },
  { id: '3', code: '1130', name: '普通預金', accountType: 'ASSET' },
  { id: '4', code: '1140', name: '売掛金', accountType: 'ASSET' },
  { id: '5', code: '1150', name: '仮払消費税', accountType: 'ASSET' },
  { id: '6', code: '2110', name: '買掛金', accountType: 'LIABILITY' },
  { id: '7', code: '2140', name: '仮受消費税', accountType: 'LIABILITY' },
  { id: '8', code: '4110', name: '売上高', accountType: 'REVENUE' },
  { id: '9', code: '5110', name: '仕入高', accountType: 'EXPENSE' },
  { id: '10', code: '5210', name: '給料手当', accountType: 'EXPENSE' },
  { id: '11', code: '5220', name: '法定福利費', accountType: 'EXPENSE' },
  { id: '12', code: '5230', name: '旅費交通費', accountType: 'EXPENSE' },
  { id: '13', code: '5240', name: '通信費', accountType: 'EXPENSE' },
  { id: '14', code: '5250', name: '消耗品費', accountType: 'EXPENSE' },
  { id: '15', code: '5260', name: '水道光熱費', accountType: 'EXPENSE' },
  { id: '16', code: '5270', name: '支払手数料', accountType: 'EXPENSE' },
];

export default function DemoJournalEntriesPage() {
  const [entries] = useState<JournalEntry[]>(mockEntries);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [simpleDialogOpen, setSimpleDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('');

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

  const handleApprove = (entry: JournalEntry) => {
    // Demo: Approve entry
    void entry.id;
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
    <div className="space-y-6 p-8">
      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-6">
        <p className="text-sm text-yellow-800">
          デモページ: これは仕訳入力画面のUIデモです。実際のデータは保存されません。
        </p>
      </div>

      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">仕訳入力</h1>
        <div className="flex space-x-2">
          <Button onClick={() => setSimpleDialogOpen(true)} variant="outline">
            <Sparkles className="mr-2 h-4 w-4" />
            かんたん入力
          </Button>
          <Button onClick={handleCreate}>
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

          {filteredEntries.length === 0 ? (
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

      <JournalEntryDialogDemo
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entry={editingEntry}
        onSuccess={() => {
          // Demo: Journal entry saved
          setDialogOpen(false);
        }}
      />

      <SimpleEntryDialog
        open={simpleDialogOpen}
        onOpenChange={setSimpleDialogOpen}
        accounts={mockAccounts}
        onSubmit={async (journalEntry) => {
          // Demo: Simple entry converted to journal entry
          void journalEntry; // Acknowledge parameter
          setSimpleDialogOpen(false);
        }}
      />
    </div>
  );
}
