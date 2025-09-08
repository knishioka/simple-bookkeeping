'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  createAccountingPeriodWithAuth,
  updateAccountingPeriodWithAuth,
} from '@/app/actions/accounting-periods-wrapper';
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

import type { Database } from '@/lib/supabase/database.types';

type AccountingPeriod = Database['public']['Tables']['accounting_periods']['Row'];

// Transform Supabase data to match the UI expectations
interface AccountingPeriodUI extends Omit<AccountingPeriod, 'is_closed'> {
  isActive: boolean;
  startDate: Date;
  endDate: Date;
}

// Schema definitions (migrated from @simple-bookkeeping/types)
const createAccountingPeriodSchema = z
  .object({
    name: z
      .string()
      .min(1, '会計期間名は必須です')
      .max(100, '会計期間名は100文字以内で入力してください'),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '開始日は YYYY-MM-DD 形式で入力してください'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '終了日は YYYY-MM-DD 形式で入力してください'),
    isActive: z.boolean().optional().default(false),
  })
  .refine((data) => new Date(data.startDate) < new Date(data.endDate), {
    message: '開始日は終了日より前である必要があります',
    path: ['endDate'],
  });

const updateAccountingPeriodSchema = z
  .object({
    name: z
      .string()
      .min(1, '会計期間名は必須です')
      .max(100, '会計期間名は100文字以内で入力してください')
      .optional(),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '開始日は YYYY-MM-DD 形式で入力してください')
      .optional(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '終了日は YYYY-MM-DD 形式で入力してください')
      .optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) < new Date(data.endDate);
      }
      return true;
    },
    {
      message: '開始日は終了日より前である必要があります',
      path: ['endDate'],
    }
  );

type CreateAccountingPeriodDto = z.infer<typeof createAccountingPeriodSchema>;
type UpdateAccountingPeriodDto = z.infer<typeof updateAccountingPeriodSchema>;

interface AccountingPeriodFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period?: AccountingPeriodUI | null;
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
        startDate:
          period.startDate instanceof Date
            ? period.startDate.toISOString().split('T')[0]
            : new Date(period.startDate).toISOString().split('T')[0],
        endDate:
          period.endDate instanceof Date
            ? period.endDate.toISOString().split('T')[0]
            : new Date(period.endDate).toISOString().split('T')[0],
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
      let result;
      if (isEdit && period) {
        // For update, only send changed fields
        const updateData: Record<string, unknown> = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.startDate !== undefined) updateData.start_date = data.startDate;
        if (data.endDate !== undefined) updateData.end_date = data.endDate;
        // Handle isActive -> is_closed transformation
        if (data.isActive !== undefined) updateData.is_closed = !data.isActive;

        result = await updateAccountingPeriodWithAuth(period.id, updateData);
      } else {
        // For create, all fields are required
        const createData = {
          name: data.name || '',
          start_date: data.startDate || '',
          end_date: data.endDate || '',
          // Note: is_closed is opposite of isActive
          // If isActive is true, is_closed should be false
          is_closed: !data.isActive,
        };

        result = await createAccountingPeriodWithAuth(createData);
      }

      if (!result.success) {
        throw new Error(result.error.message);
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
