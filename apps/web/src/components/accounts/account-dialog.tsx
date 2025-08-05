'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';

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
import { Account, AccountType, AccountTypeLabels } from '@/types/account';
import { createAccountSchema, CreateAccountInput } from '@/types/schemas';

type AccountFormData = CreateAccountInput;

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Account | null;
  accounts: Account[];
  onSuccess: () => void;
}

export function AccountDialog({
  open,
  onOpenChange,
  account,
  accounts,
  onSuccess,
}: AccountDialogProps) {
  const form = useForm<AccountFormData>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: {
      code: account?.code || '',
      name: account?.name || '',
      accountType: account?.accountType || AccountType.ASSET,
      parentId: account?.parentId || undefined,
    },
  });

  const onSubmit = async (data: AccountFormData) => {
    try {
      // Convert "none" value to undefined for parentId
      const processedData = {
        ...data,
        parentId: data.parentId === 'none' ? undefined : data.parentId,
      };

      if (account) {
        // Update existing account
        const response = await apiClient.put(`/accounts/${account.id}`, processedData);
        if (response.data) {
          toast.success('勘定科目を更新しました');
          onSuccess();
          onOpenChange(false);
          form.reset();
        }
      } else {
        // Create new account
        const response = await apiClient.post('/accounts', processedData);
        if (response.data) {
          toast.success('勘定科目を作成しました');
          onSuccess();
          onOpenChange(false);
          form.reset();
        }
      }
    } catch (error) {
      console.error('Failed to save account:', error);
      toast.error(account ? '勘定科目の更新に失敗しました' : '勘定科目の作成に失敗しました');
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
          <DialogDescription>勘定科目の情報を入力してください</DialogDescription>
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
                      {Object.entries(AccountTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value} data-testid={`select-item-${value}`}>
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
                  <Select onValueChange={field.onChange} defaultValue={field.value ?? undefined}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="親科目を選択" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">なし</SelectItem>
                      {filteredParentAccounts.map((acc) => (
                        <SelectItem
                          key={acc.id}
                          value={acc.id}
                          data-testid={`select-item-${acc.id}`}
                        >
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
