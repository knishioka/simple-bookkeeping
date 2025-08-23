'use client';

import { Plus, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { PartnerDialog } from '@/components/partners/partner-dialog';
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

import type { Partner } from '@/types/partner';

const partnerTypeLabels = {
  CUSTOMER: '顧客',
  VENDOR: '仕入先',
  BOTH: '両方',
};

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);

  const fetchPartners = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedType && selectedType !== 'all') params.append('type', selectedType);

      const response = await apiClient.get<{ data: Partner[] }>(`/partners?${params}`);
      setPartners(response.data?.data || []);
    } catch (error) {
      console.error('Failed to fetch partners:', error);
      toast.error('取引先の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPartners();
  }, [searchTerm, selectedType]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateNew = () => {
    setEditingPartner(null);
    setDialogOpen(true);
  };

  const handleEdit = (partner: Partner) => {
    setEditingPartner(partner);
    setDialogOpen(true);
  };

  const handleDelete = async (partnerId: string) => {
    if (!confirm('この取引先を削除してもよろしいですか？')) {
      return;
    }

    try {
      await apiClient.delete(`/partners/${partnerId}`);
      toast.success('取引先を削除しました');
      fetchPartners();
    } catch (error) {
      console.error('Failed to delete partner:', error);
      toast.error('取引先の削除に失敗しました');
    }
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

          {loading ? (
            <div className="text-center py-8">読み込み中...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>コード</TableHead>
                  <TableHead>名前</TableHead>
                  <TableHead>タイプ</TableHead>
                  <TableHead>電話番号</TableHead>
                  <TableHead>メール</TableHead>
                  <TableHead>住所</TableHead>
                  <TableHead className="w-[150px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.map((partner) => (
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
                        {partnerTypeLabels[partner.partnerType as keyof typeof partnerTypeLabels]}
                      </span>
                    </TableCell>
                    <TableCell>{partner.phone || '-'}</TableCell>
                    <TableCell>{partner.email || '-'}</TableCell>
                    <TableCell className="max-w-xs truncate">{partner.address || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(partner)}
                          className="h-8 px-2"
                        >
                          編集
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(partner.id)}
                          className="h-8 px-2 text-red-600 hover:text-red-700"
                        >
                          削除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {partners.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      該当する取引先が見つかりません
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PartnerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        partner={editingPartner}
        onSuccess={() => {
          setDialogOpen(false);
          fetchPartners();
        }}
      />
    </div>
  );
}
