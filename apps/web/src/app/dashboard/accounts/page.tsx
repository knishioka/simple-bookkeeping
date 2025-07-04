'use client';

import { Account, AccountType, AccountTypeLabels } from '@simple-bookkeeping/core';
import { Plus, Search } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

// Lazy load the account dialog
const AccountDialog = lazy(() =>
  import('@/components/accounts/account-dialog').then((mod) => ({
    default: mod.AccountDialog,
  }))
);
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

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<Account[]>('/accounts');
      if (response.data) {
        setAccounts(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
      toast.error('勘定科目の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const filteredAccounts = accounts.filter((account) => {
    const matchesSearch =
      account.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || account.accountType === selectedType;
    return matchesSearch && matchesType;
  });

  const handleCreate = () => {
    setEditingAccount(null);
    setDialogOpen(true);
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">勘定科目管理</h1>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          新規作成
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>勘定科目一覧</CardTitle>
          <CardDescription>システムに登録されている勘定科目を管理します</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="コードまたは名称で検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="科目タイプ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                <SelectItem value={AccountType.ASSET}>
                  {AccountTypeLabels[AccountType.ASSET]}
                </SelectItem>
                <SelectItem value={AccountType.LIABILITY}>
                  {AccountTypeLabels[AccountType.LIABILITY]}
                </SelectItem>
                <SelectItem value={AccountType.EQUITY}>
                  {AccountTypeLabels[AccountType.EQUITY]}
                </SelectItem>
                <SelectItem value={AccountType.REVENUE}>
                  {AccountTypeLabels[AccountType.REVENUE]}
                </SelectItem>
                <SelectItem value={AccountType.EXPENSE}>
                  {AccountTypeLabels[AccountType.EXPENSE]}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-8">読み込み中...</div>
          ) : filteredAccounts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">勘定科目が見つかりません</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>コード</TableHead>
                  <TableHead>科目名</TableHead>
                  <TableHead>タイプ</TableHead>
                  <TableHead>親科目</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-mono">{account.code}</TableCell>
                    <TableCell>{account.name}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {AccountTypeLabels[account.accountType]}
                      </span>
                    </TableCell>
                    <TableCell>
                      {account.parent ? (
                        <span className="text-sm">
                          {account.parent.code} - {account.parent.name}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          account.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {account.isActive ? '有効' : '無効'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(account)}>
                        編集
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Suspense fallback={<div className="fixed inset-0 bg-black/50" />}>
        <AccountDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          account={editingAccount}
          accounts={accounts}
          onSuccess={fetchAccounts}
        />
      </Suspense>
    </div>
  );
}
