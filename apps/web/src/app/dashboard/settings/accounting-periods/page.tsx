'use client';

import { Plus, Calendar, Check, Edit, Trash2 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

import {
  getAccountingPeriodsWithAuth,
  activateAccountingPeriodWithAuth,
  deleteAccountingPeriodWithAuth,
} from '@/app/actions/accounting-periods-wrapper';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

import { AccountingPeriodFormDialog } from './accounting-period-form-dialog';

import type { Database } from '@/lib/supabase/database.types';

type AccountingPeriod = Database['public']['Tables']['accounting_periods']['Row'];

// Transform Supabase data to match the UI expectations
interface AccountingPeriodUI extends Omit<AccountingPeriod, 'is_closed'> {
  isActive: boolean;
  startDate: Date;
  endDate: Date;
}

// Helper function to transform database period to UI period
function transformPeriodForUI(period: AccountingPeriod): AccountingPeriodUI {
  return {
    ...period,
    isActive: !period.is_closed,
    startDate: new Date(period.start_date),
    endDate: new Date(period.end_date),
  };
}

export default function AccountingPeriodsPage() {
  const [periods, setPeriods] = useState<AccountingPeriodUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<AccountingPeriodUI | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { toast } = useToast();

  const fetchPeriods = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getAccountingPeriodsWithAuth();

      if (!result.success) {
        throw new Error(result.error.message);
      }

      // Transform the periods to match UI expectations
      const transformedPeriods = result.data.items.map(transformPeriodForUI);
      setPeriods(transformedPeriods);
    } catch (error) {
      console.error('Error fetching accounting periods:', error);
      toast({
        title: 'エラー',
        description: error instanceof Error ? error.message : '会計期間の取得に失敗しました',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  const handleActivate = async (periodId: string) => {
    try {
      const result = await activateAccountingPeriodWithAuth(periodId);

      if (!result.success) {
        throw new Error(result.error.message);
      }

      toast({
        title: '成功',
        description: '会計期間を有効化しました',
      });

      await fetchPeriods();
    } catch (error) {
      console.error('Error activating period:', error);
      toast({
        title: 'エラー',
        description: error instanceof Error ? error.message : '会計期間の有効化に失敗しました',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (periodId: string) => {
    try {
      const result = await deleteAccountingPeriodWithAuth(periodId);

      if (!result.success) {
        throw new Error(result.error.message);
      }

      toast({
        title: '成功',
        description: '会計期間を削除しました',
      });

      await fetchPeriods();
    } catch (error) {
      console.error('Error deleting period:', error);
      toast({
        title: 'エラー',
        description: error instanceof Error ? error.message : '会計期間の削除に失敗しました',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (period: AccountingPeriodUI) => {
    setSelectedPeriod(period);
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setSelectedPeriod(null);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setSelectedPeriod(null);
    setIsFormOpen(false);
  };

  const handleFormSuccess = () => {
    handleFormClose();
    fetchPeriods();
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">読み込み中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">会計期間管理</h1>
          <p className="text-muted-foreground mt-1">会計期間の作成・編集・削除を行います</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          新規作成
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>期間名</TableHead>
              <TableHead>開始日</TableHead>
              <TableHead>終了日</TableHead>
              <TableHead className="text-center">ステータス</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {periods.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Calendar className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">会計期間が登録されていません</p>
                    <Button onClick={handleCreate} variant="outline" size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      最初の会計期間を作成
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              periods.map((period) => (
                <TableRow key={period.id}>
                  <TableCell className="font-medium">{period.name}</TableCell>
                  <TableCell>{formatDate(period.startDate)}</TableCell>
                  <TableCell>{formatDate(period.endDate)}</TableCell>
                  <TableCell className="text-center">
                    {period.isActive ? (
                      <Badge className="bg-green-100 text-green-800">
                        <Check className="mr-1 h-3 w-3" />
                        有効
                      </Badge>
                    ) : (
                      <Badge variant="outline">無効</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!period.isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleActivate(period.id)}
                        >
                          有効化
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(period)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      {!period.isActive && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>会計期間を削除しますか？</AlertDialogTitle>
                              <AlertDialogDescription>
                                この操作は取り消すことができません。 会計期間「{period.name}
                                」を削除してもよろしいですか？
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>キャンセル</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(period.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                削除
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AccountingPeriodFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        period={selectedPeriod}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}
