'use client';

import { Plus, Search, Upload } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';

import { getAccountsWithAuth } from '@/app/actions/accounts-wrapper';
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

import type { Database } from '@/lib/supabase/database.types';

// Lazy load the account dialog
const AccountDialog = lazy(() =>
  import('@/components/accounts/account-dialog').then((mod) => ({
    default: mod.AccountDialog,
  }))
);
// Lazy load the account import dialog
const AccountImportDialog = lazy(() =>
  import('@/components/accounts/account-import-dialog').then((mod) => ({
    default: mod.AccountImportDialog,
  }))
);
// Temporary type mappings until we fully migrate to Supabase types
type Account = Database['public']['Tables']['accounts']['Row'] & {
  parent?: {
    id: string;
    code: string;
    name: string;
  } | null;
};

// Account type enum mapping
const AccountType = {
  ASSET: 'ASSET',
  LIABILITY: 'LIABILITY',
  EQUITY: 'EQUITY',
  REVENUE: 'REVENUE',
  EXPENSE: 'EXPENSE',
} as const;

const AccountTypeLabels: Record<string, string> = {
  ASSET: '資産',
  LIABILITY: '負債',
  EQUITY: '純資産',
  REVENUE: '収益',
  EXPENSE: '費用',
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const { execute: fetchAccountsAction, isLoading } = useServerAction(getAccountsWithAuth);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const fetchAccounts = async () => {
    const result = await fetchAccountsAction(undefined, {
      errorMessage: '勘定科目の取得に失敗しました',
      showToast: true,
    });

    if (result && result.items) {
      // Transform the data to match the expected format
      const transformedAccounts = result.items.map((acc) => ({
        ...acc,
        // Map snake_case to camelCase for compatibility
        accountType: acc.account_type,
        parentId: acc.parent_account_id,
        organizationId: acc.organization_id,
        isActive: acc.is_active,
        createdAt: new Date(acc.created_at),
        updatedAt: new Date(acc.updated_at),
      })) as unknown as Account[];

      setAccounts(transformedAccounts);
    }
  };

  useEffect(() => {
    fetchAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredAccounts = accounts.filter((account) => {
    const matchesSearch =
      account.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || account.account_type === selectedType;
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
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setImportDialogOpen(true)}
            data-testid="account-import-button"
          >
            <Upload className="mr-2 h-4 w-4" />
            インポート
          </Button>
          <Button onClick={handleCreate} data-testid="account-create-button">
            <Plus className="mr-2 h-4 w-4" />
            新規作成
          </Button>
        </div>
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
                data-testid="accounts-search-input"
              />
            </div>
            <Select
              value={selectedType}
              onValueChange={setSelectedType}
              data-testid="accounts-type-filter"
            >
              <SelectTrigger className="w-[200px]" data-testid="accounts-type-trigger">
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

          {isLoading ? (
            <div className="text-center py-8">読み込み中...</div>
          ) : filteredAccounts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">勘定科目が見つかりません</div>
          ) : (
            <Table data-testid="accounts-table">
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
                        {AccountTypeLabels[account.account_type] || account.account_type}
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
                          account.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {account.is_active ? '有効' : '無効'}
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

      <Suspense fallback={<div className="fixed inset-0 bg-black/50" />}>
        <AccountImportDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          onSuccess={fetchAccounts}
        />
      </Suspense>
    </div>
  );
}
