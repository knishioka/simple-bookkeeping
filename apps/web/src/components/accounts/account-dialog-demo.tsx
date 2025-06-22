'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
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

const accountSchema = z.object({
  code: z.string().min(1, 'コードは必須です').max(10, 'コードは10文字以内で入力してください'),
  name: z.string().min(1, '科目名は必須です').max(50, '科目名は50文字以内で入力してください'),
  accountType: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'], {
    required_error: 'タイプを選択してください',
  }),
  parentId: z.string().optional(),
});

type AccountFormData = z.infer<typeof accountSchema>;

interface Account {
  id: string;
  code: string;
  name: string;
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  parentId: string | null;
}

interface AccountDialogDemoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Account | null;
  accounts: Account[];
  onSuccess: () => void;
}

const accountTypeLabels = {
  ASSET: '資産',
  LIABILITY: '負債',
  EQUITY: '純資産',
  REVENUE: '収益',
  EXPENSE: '費用',
};

export function AccountDialogDemo({
  open,
  onOpenChange,
  account,
  accounts,
  onSuccess,
}: AccountDialogDemoProps) {
  const form = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      code: account?.code || '',
      name: account?.name || '',
      accountType: account?.accountType || 'ASSET',
      parentId: account?.parentId || undefined,
    },
  });

  const onSubmit = async (_data: AccountFormData) => {
    try {
      // デモ用: API呼び出しの代わりに成功メッセージを表示
      await new Promise((resolve) => setTimeout(resolve, 500)); // 擬似的な遅延

      if (account) {
        toast.success('勘定科目を更新しました（デモ）');
      } else {
        toast.success('勘定科目を作成しました（デモ）');
      }

      onSuccess();
      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error('Demo error:', error);
      toast.error('エラーが発生しました（デモ）');
    }
  };

  const selectedType = form.watch('accountType');
  const filteredParentAccounts = accounts.filter(
    (a) => a.accountType === selectedType && a.id !== account?.id
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{account ? '勘定科目の編集' : '勘定科目の新規作成'}</DialogTitle>
          <DialogDescription>勘定科目の情報を入力してください（デモ版）</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>コード</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="1110" disabled={!!account} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>科目名</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="現金" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="accountType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>タイプ</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={!!account}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="タイプを選択" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(accountTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="parentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>親科目（任意）</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="親科目を選択" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">なし</SelectItem>
                      {filteredParentAccounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.code} - {acc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                キャンセル
              </Button>
              <Button type="submit">{account ? '更新' : '作成'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
