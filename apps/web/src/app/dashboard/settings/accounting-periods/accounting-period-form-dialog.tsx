'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  createAccountingPeriodSchema,
  updateAccountingPeriodSchema,
  type CreateAccountingPeriodDto,
  type UpdateAccountingPeriodDto,
  type AccountingPeriod,
} from '@simple-bookkeeping/types';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

interface AccountingPeriodFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period?: AccountingPeriod | null;
  onSuccess: () => void;
}

export function AccountingPeriodFormDialog({
  open,
  onOpenChange,
  period,
  onSuccess,
}: AccountingPeriodFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const isEdit = !!period;

  const form = useForm<CreateAccountingPeriodDto | UpdateAccountingPeriodDto>({
    resolver: zodResolver(isEdit ? updateAccountingPeriodSchema : createAccountingPeriodSchema),
    defaultValues: {
      name: '',
      startDate: '',
      endDate: '',
      isActive: false,
    },
  });

  useEffect(() => {
    if (period) {
      form.reset({
        name: period.name,
        startDate: new Date(period.startDate).toISOString().split('T')[0],
        endDate: new Date(period.endDate).toISOString().split('T')[0],
        isActive: period.isActive,
      });
    } else {
      form.reset({
        name: '',
        startDate: '',
        endDate: '',
        isActive: false,
      });
    }
  }, [period, form]);

  const onSubmit = async (data: CreateAccountingPeriodDto | UpdateAccountingPeriodDto) => {
    setLoading(true);
    try {
      const url = isEdit ? `/api/v1/accounting-periods/${period.id}` : '/api/v1/accounting-periods';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.error || `Failed to ${isEdit ? 'update' : 'create'} accounting period`
        );
      }

      toast({
        title: '成功',
        description: `会計期間を${isEdit ? '更新' : '作成'}しました`,
      });

      onSuccess();
    } catch (error) {
      console.error('Error submitting form:', error);
      toast({
        title: 'エラー',
        description:
          error instanceof Error
            ? error.message
            : `会計期間の${isEdit ? '更新' : '作成'}に失敗しました`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? '会計期間を編集' : '新規会計期間を作成'}</DialogTitle>
          <DialogDescription>会計期間の情報を入力してください。</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>期間名</FormLabel>
                  <FormControl>
                    <Input placeholder="例: 2024年度" {...field} disabled={loading} />
                  </FormControl>
                  <FormDescription>会計期間を識別するための名前を入力してください</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>開始日</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} disabled={loading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>終了日</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} disabled={loading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>有効化</FormLabel>
                    <FormDescription>この期間を現在の会計期間として設定します</FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={loading || (isEdit && period?.isActive)}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                キャンセル
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? '処理中...' : isEdit ? '更新' : '作成'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
