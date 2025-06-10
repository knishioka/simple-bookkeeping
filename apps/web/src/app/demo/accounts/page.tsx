'use client';

import { Plus, Search } from 'lucide-react';
import { useState } from 'react';

import { AccountDialogDemo } from '@/components/accounts/account-dialog-demo';
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

interface Account {
  id: string;
  code: string;
  name: string;
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  parentId: string | null;
  parent?: {
    id: string;
    code: string;
    name: string;
  };
  isActive: boolean;
  _count?: {
    children: number;
  };
}

const accountTypeLabels = {
  ASSET: '資産',
  LIABILITY: '負債',
  EQUITY: '純資産',
  REVENUE: '収益',
  EXPENSE: '費用',
};

// Mock data
const mockAccounts: Account[] = [
  { id: '1', code: '1110', name: '現金', accountType: 'ASSET', parentId: null, isActive: true },
  { id: '2', code: '1120', name: '当座預金', accountType: 'ASSET', parentId: null, isActive: true },
  { id: '3', code: '1130', name: '普通預金', accountType: 'ASSET', parentId: null, isActive: true },
  { id: '4', code: '1140', name: '売掛金', accountType: 'ASSET', parentId: null, isActive: true },
  { id: '5', code: '2110', name: '買掛金', accountType: 'LIABILITY', parentId: null, isActive: true },
  { id: '6', code: '2120', name: '未払金', accountType: 'LIABILITY', parentId: null, isActive: true },
  { id: '7', code: '3110', name: '資本金', accountType: 'EQUITY', parentId: null, isActive: true },
  { id: '8', code: '4110', name: '売上高', accountType: 'REVENUE', parentId: null, isActive: true },
  { id: '9', code: '5110', name: '仕入高', accountType: 'EXPENSE', parentId: null, isActive: true },
  { id: '10', code: '5210', name: '給料手当', accountType: 'EXPENSE', parentId: null, isActive: true },
];

export default function DemoAccountsPage() {
  const [accounts] = useState<Account[]>(mockAccounts);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

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
    <div className="space-y-6 p-8">
      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-6">
        <p className="text-sm text-yellow-800">
          デモページ: これは勘定科目管理画面のUIデモです。実際のデータは保存されません。
        </p>
      </div>

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
          <CardDescription>
            システムに登録されている勘定科目を管理します
          </CardDescription>
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
                <SelectItem value="ASSET">資産</SelectItem>
                <SelectItem value="LIABILITY">負債</SelectItem>
                <SelectItem value="EQUITY">純資産</SelectItem>
                <SelectItem value="REVENUE">収益</SelectItem>
                <SelectItem value="EXPENSE">費用</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredAccounts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              勘定科目が見つかりません
            </div>
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
                        {accountTypeLabels[account.accountType]}
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
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        account.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {account.isActive ? '有効' : '無効'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleEdit(account)}
                      >
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

      <AccountDialogDemo
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        account={editingAccount}
        accounts={accounts}
        onSuccess={() => {
          // Demo: Account saved
          setDialogOpen(false);
        }}
      />
    </div>
  );
}