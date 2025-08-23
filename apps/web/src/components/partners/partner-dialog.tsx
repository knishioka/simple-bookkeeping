'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api-client';

import type { Partner } from '@/types/partner';

const partnerSchema = z.object({
  code: z.string().min(1, '取引先コードは必須です'),
  name: z.string().min(1, '取引先名は必須です'),
  nameKana: z.string().optional(),
  partnerType: z.enum(['CUSTOMER', 'VENDOR', 'BOTH']),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('正しいメールアドレスを入力してください').optional().or(z.literal('')),
  taxId: z.string().optional(),
});

type PartnerFormData = z.infer<typeof partnerSchema>;

interface PartnerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partner: Partner | null;
  onSuccess: () => void;
}

export function PartnerDialog({ open, onOpenChange, partner, onSuccess }: PartnerDialogProps) {
  const form = useForm<PartnerFormData>({
    resolver: zodResolver(partnerSchema),
    defaultValues: {
      code: '',
      name: '',
      nameKana: '',
      partnerType: 'CUSTOMER',
      address: '',
      phone: '',
      email: '',
      taxId: '',
    },
  });

  useEffect(() => {
    if (partner) {
      form.reset({
        code: partner.code,
        name: partner.name,
        nameKana: partner.nameKana || '',
        partnerType: partner.partnerType,
        address: partner.address || '',
        phone: partner.phone || '',
        email: partner.email || '',
        taxId: partner.taxId || '',
      });
    } else {
      form.reset({
        code: '',
        name: '',
        nameKana: '',
        partnerType: 'CUSTOMER',
        address: '',
        phone: '',
        email: '',
        taxId: '',
      });
    }
  }, [partner, form]);

  const onSubmit = async (data: PartnerFormData) => {
    try {
      if (partner) {
        await apiClient.put(`/partners/${partner.id}`, data);
        toast.success('取引先を更新しました');
      } else {
        await apiClient.post('/partners', data);
        toast.success('取引先を登録しました');
      }
      onSuccess();
    } catch (error: unknown) {
      console.error('Failed to save partner:', error);
      const errorMessage =
        (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || '取引先の保存に失敗しました';
      toast.error(errorMessage);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{partner ? '取引先編集' : '取引先新規登録'}</DialogTitle>
          <DialogDescription>
            {partner
              ? '取引先情報を編集します'
              : '新しい取引先を登録します。必須項目を入力してください。'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>取引先コード *</FormLabel>
                    <FormControl>
                      <Input placeholder="C001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="partnerType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>取引先タイプ *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="選択してください" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="CUSTOMER">顧客</SelectItem>
                        <SelectItem value="VENDOR">仕入先</SelectItem>
                        <SelectItem value="BOTH">両方</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>取引先名 *</FormLabel>
                  <FormControl>
                    <Input placeholder="株式会社サンプル" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="nameKana"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>フリガナ</FormLabel>
                  <FormControl>
                    <Input placeholder="カブシキガイシャサンプル" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>住所</FormLabel>
                  <FormControl>
                    <Input placeholder="東京都千代田区丸の内1-1-1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>電話番号</FormLabel>
                    <FormControl>
                      <Input placeholder="03-1234-5678" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>メールアドレス</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="info@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="taxId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>法人番号/個人番号</FormLabel>
                  <FormControl>
                    <Input placeholder="1234567890123" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                キャンセル
              </Button>
              <Button type="submit">{partner ? '更新' : '登録'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
