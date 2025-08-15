'use client';

import { Plus, Search } from 'lucide-react';
import { useState } from 'react';

import { PartnerDialogDemo } from '@/components/partners/partner-dialog-demo';
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

interface Partner {
  id: string;
  code: string;
  name: string;
  nameKana?: string;
  partnerType: 'CUSTOMER' | 'VENDOR' | 'BOTH';
  address?: string;
  phone?: string;
  email?: string;
  taxId?: string;
  isActive: boolean;
}

const partnerTypeLabels = {
  CUSTOMER: '顧客',
  VENDOR: '仕入先',
  BOTH: '両方',
};

// Mock data
const mockPartners: Partner[] = [
  {
    id: '1',
    code: 'C001',
    name: '株式会社サンプル商事',
    nameKana: 'カブシキガイシャサンプルショウジ',
    partnerType: 'CUSTOMER',
    address: '東京都千代田区丸の内1-1-1',
    phone: '03-1234-5678',
    email: 'info@sample-shoji.co.jp',
    isActive: true,
  },
  {
    id: '2',
    code: 'C002',
    name: '株式会社テクノロジー',
    nameKana: 'カブシキガイシャテクノロジー',
    partnerType: 'CUSTOMER',
    address: '東京都渋谷区渋谷2-21-1',
    phone: '03-3456-7890',
    email: 'contact@technology.co.jp',
    isActive: true,
  },
  {
    id: '3',
    code: 'V001',
    name: 'オフィスサプライ株式会社',
    nameKana: 'オフィスサプライカブシキガイシャ',
    partnerType: 'VENDOR',
    address: '東京都新宿区西新宿2-2-2',
    phone: '03-2345-6789',
    email: 'sales@office-supply.co.jp',
    isActive: true,
  },
  {
    id: '4',
    code: 'V002',
    name: '文具ショップ田中',
    nameKana: 'ブングショップタナカ',
    partnerType: 'VENDOR',
    address: '東京都台東区浅草1-1-1',
    phone: '03-4567-8901',
    email: 'info@tanaka-bungu.jp',
    isActive: true,
  },
  {
    id: '5',
    code: 'B001',
    name: '総合商社ABC',
    nameKana: 'ソウゴウショウシャエービーシー',
    partnerType: 'BOTH',
    address: '東京都港区六本木6-10-1',
    phone: '03-5678-9012',
    email: 'info@abc-trading.co.jp',
    taxId: '1234567890123',
    isActive: true,
  },
];

export default function DemoPartnersPage() {
  const [partners] = useState<Partner[]>(mockPartners);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);

  const filteredPartners = partners.filter((partner) => {
    const matchesSearch =
      partner.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      partner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (partner.nameKana && partner.nameKana.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = selectedType === 'all' || partner.partnerType === selectedType;
    return matchesSearch && matchesType;
  });

  const handleCreateNew = () => {
    setEditingPartner(null);
    setDialogOpen(true);
  };

  const handleEdit = (partner: Partner) => {
    setEditingPartner(partner);
    setDialogOpen(true);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">取引先管理</h1>
        <p className="text-gray-600 mt-2">顧客と仕入先の情報を管理します</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>取引先一覧</CardTitle>
              <CardDescription>登録されている取引先の一覧です</CardDescription>
            </div>
            <Button onClick={handleCreateNew} className="gap-2">
              <Plus className="w-4 h-4" />
              新規登録
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="コード、名前、フリガナで検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="取引先タイプ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                <SelectItem value="CUSTOMER">顧客</SelectItem>
                <SelectItem value="VENDOR">仕入先</SelectItem>
                <SelectItem value="BOTH">両方</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>コード</TableHead>
                <TableHead>名前</TableHead>
                <TableHead>タイプ</TableHead>
                <TableHead>電話番号</TableHead>
                <TableHead>メール</TableHead>
                <TableHead>住所</TableHead>
                <TableHead className="w-[100px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPartners.map((partner) => (
                <TableRow key={partner.id}>
                  <TableCell className="font-mono">{partner.code}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{partner.name}</div>
                      {partner.nameKana && (
                        <div className="text-sm text-gray-500">{partner.nameKana}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {partnerTypeLabels[partner.partnerType]}
                    </span>
                  </TableCell>
                  <TableCell>{partner.phone || '-'}</TableCell>
                  <TableCell>{partner.email || '-'}</TableCell>
                  <TableCell className="max-w-xs truncate">{partner.address || '-'}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(partner)}
                      className="h-8 px-2"
                    >
                      編集
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredPartners.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    該当する取引先が見つかりません
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PartnerDialogDemo
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        partner={editingPartner}
        onSuccess={() => {
          setDialogOpen(false);
          // In a real app, this would refresh the list
        }}
      />
    </div>
  );
}
