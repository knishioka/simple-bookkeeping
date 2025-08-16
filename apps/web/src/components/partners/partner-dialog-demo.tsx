'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

const partnerSchema = z.object({
  code: z.string().min(1, '取引先コードは必須です'),
  name: z.string().min(1, '取引先名は必須です'),
  nameKana: z.string().optional(),
  partnerType: z.enum(['CUSTOMER', 'VENDOR', 'BOTH']),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('正しいメールアドレスを入力してください').optional().or(z.literal('')),
  taxId: z.string().optional(),
  isActive: z.boolean(),
});

type PartnerFormData = z.infer<typeof partnerSchema>;

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

interface PartnerDialogDemoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partner?: Partner | null;
  onSuccess: () => void;
}

export function PartnerDialogDemo({
  open,
  onOpenChange,
  partner,
  onSuccess,
}: PartnerDialogDemoProps) {
  const form = useForm<PartnerFormData>({
    resolver: zodResolver(partnerSchema),
    defaultValues: partner || {
      code: '',
      name: '',
      nameKana: '',
      partnerType: 'CUSTOMER',
      address: '',
      phone: '',
      email: '',
      taxId: '',
      isActive: true,
    },
  });

  const handleSubmit = (_data: PartnerFormData) => {
    // In a real app, this would call the API
    onSuccess();
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{partner ? '取引先編集' : '新規取引先登録'}</DialogTitle>
          <DialogDescription>
            {partner ? '取引先情報を編集します' : '新しい取引先を登録します'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>取引先コード *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="C001" />
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="タイプを選択" />
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
                    <Input {...field} placeholder="株式会社サンプル" />
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
                    <Input {...field} placeholder="カブシキガイシャサンプル" />
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
                    <Textarea {...field} placeholder="東京都千代田区..." rows={2} />
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
                      <Input {...field} placeholder="03-1234-5678" />
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
                      <Input {...field} type="email" placeholder="info@example.com" />
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
                    <Input {...field} placeholder="1234567890123" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {partner && (
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>有効</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        無効にすると、この取引先は選択できなくなります
                      </div>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  form.reset();
                }}
              >
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
