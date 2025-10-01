'use client';

import type { Database } from '@/lib/supabase/database.types';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { createPartner, updatePartner } from '@/app/actions/partners';
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
import { useOrganization } from '@/hooks/use-organization';

type Partner = Database['public']['Tables']['partners']['Row'];

const partnerSchema = z.object({
  code: z.string().min(1, '取引先コードは必須です'),
  name: z.string().min(1, '取引先名は必須です'),
  name_kana: z.string().optional().nullable(),
  partner_type: z.enum(['customer', 'supplier', 'both']),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z
    .string()
    .email('正しいメールアドレスを入力してください')
    .optional()
    .nullable()
    .or(z.literal('')),
  postal_code: z.string().optional().nullable(),
  bank_name: z.string().optional().nullable(),
  bank_branch: z.string().optional().nullable(),
  bank_account_type: z.string().optional().nullable(),
  bank_account_number: z.string().optional().nullable(),
  bank_account_name: z.string().optional().nullable(),
  payment_terms: z.number().optional().nullable(),
  credit_limit: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type PartnerFormData = z.infer<typeof partnerSchema>;

interface PartnerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partner: Partner | null;
  onSuccess: () => void;
}

export function PartnerDialog({ open, onOpenChange, partner, onSuccess }: PartnerDialogProps) {
  const { organizationId } = useOrganization();
  const form = useForm<PartnerFormData>({
    resolver: zodResolver(partnerSchema),
    defaultValues: {
      code: '',
      name: '',
      name_kana: '',
      partner_type: 'customer',
      address: '',
      phone: '',
      email: '',
      postal_code: '',
      bank_name: '',
      bank_branch: '',
      bank_account_type: '',
      bank_account_number: '',
      bank_account_name: '',
      payment_terms: null,
      credit_limit: null,
      notes: '',
    },
  });

  useEffect(() => {
    if (partner) {
      form.reset({
        code: partner.code,
        name: partner.name,
        name_kana: partner.name_kana || '',
        partner_type: partner.partner_type,
        address: partner.address || '',
        phone: partner.phone || '',
        email: partner.email || '',
        postal_code: partner.postal_code || '',
        bank_name: partner.bank_name || '',
        bank_branch: partner.bank_branch || '',
        bank_account_type: partner.bank_account_type || '',
        bank_account_number: partner.bank_account_number || '',
        bank_account_name: partner.bank_account_name || '',
        payment_terms: partner.payment_terms,
        credit_limit: partner.credit_limit,
        notes: partner.notes || '',
      });
    } else {
      form.reset({
        code: '',
        name: '',
        name_kana: '',
        partner_type: 'customer',
        address: '',
        phone: '',
        email: '',
        postal_code: '',
        bank_name: '',
        bank_branch: '',
        bank_account_type: '',
        bank_account_number: '',
        bank_account_name: '',
        payment_terms: null,
        credit_limit: null,
        notes: '',
      });
    }
  }, [partner, form]);

  const onSubmit = async (data: PartnerFormData) => {
    if (!organizationId) {
      toast.error('組織が選択されていません');
      return;
    }
    try {
      // Convert empty strings to null for nullable fields
      const processedData = {
        ...data,
        name_kana: data.name_kana || null,
        address: data.address || null,
        phone: data.phone || null,
        email: data.email || null,
        postal_code: data.postal_code || null,
        bank_name: data.bank_name || null,
        bank_branch: data.bank_branch || null,
        bank_account_type: data.bank_account_type || null,
        bank_account_number: data.bank_account_number || null,
        bank_account_name: data.bank_account_name || null,
        payment_terms: data.payment_terms,
        notes: data.notes || null,
        is_active: true,
      };

      if (partner) {
        const result = await updatePartner(partner.id, organizationId, processedData);
        if (result.success) {
          toast.success('取引先を更新しました');
          onSuccess();
          onOpenChange(false);
        } else {
          toast.error(result.error.message || '取引先の更新に失敗しました');
        }
      } else {
        const result = await createPartner({ ...processedData, organization_id: organizationId });
        if (result.success) {
          toast.success('取引先を登録しました');
          onSuccess();
          onOpenChange(false);
        } else {
          toast.error(result.error.message || '取引先の登録に失敗しました');
        }
      }
    } catch (error: unknown) {
      console.error('Failed to save partner:', error);
      toast.error('取引先の保存に失敗しました');
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
                name="partner_type"
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
                        <SelectItem value="customer">顧客</SelectItem>
                        <SelectItem value="supplier">仕入先</SelectItem>
                        <SelectItem value="both">両方</SelectItem>
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
              name="name_kana"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>フリガナ</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="カブシキガイシャサンプル"
                      {...field}
                      value={field.value || ''}
                    />
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
                    <Input
                      placeholder="東京都千代田区丸の内1-1-1"
                      {...field}
                      value={field.value || ''}
                    />
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
                      <Input placeholder="03-1234-5678" {...field} value={field.value || ''} />
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
                      <Input
                        type="email"
                        placeholder="info@example.com"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="postal_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>郵便番号</FormLabel>
                  <FormControl>
                    <Input placeholder="123-4567" {...field} value={field.value || ''} />
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
