'use client';

import type { Database } from '@/lib/supabase/database.types';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';

import { createAccount, updateAccount } from '@/app/actions/accounts';
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
import { useServerAction } from '@/hooks/useServerAction';
import { createAccountSchema, CreateAccountInput } from '@/types/schemas';

// Temporary type mappings
type Account = Database['public']['Tables']['accounts']['Row'] & {
  parent?: {
    id: string;
    code: string;
    name: string;
  } | null;
};

const AccountType = {
  ASSET: 'ASSET',
  LIABILITY: 'LIABILITY',
  EQUITY: 'EQUITY',
  REVENUE: 'REVENUE',
  EXPENSE: 'EXPENSE',
} as const;

const AccountTypeLabels: Record<string, string> = {
  ASSET: '資産',
  LIABILITY: '負債',
  EQUITY: '純資産',
  REVENUE: '収益',
  EXPENSE: '費用',
};

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
  const { organizationId } = useOrganization();
  const { execute: createAccountAction } = useServerAction(createAccount);
  const { execute: updateAccountAction } = useServerAction(updateAccount);
  const form = useForm<AccountFormData>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: {
      code: account?.code || '',
      name: account?.name || '',
      accountType: (account?.account_type as keyof typeof AccountType) || AccountType.ASSET,
      parentId: account?.parent_account_id || undefined,
    },
  });

  const onSubmit = async (data: AccountFormData) => {
    if (!organizationId) {
      toast.error('組織が選択されていません');
      return;
    }
    try {
      // Convert "none" value to undefined for parentId
      const processedData = {
        ...data,
        parentId: data.parentId === 'none' ? undefined : data.parentId,
      };

      if (account) {
        // Update existing account
        // Convert camelCase to snake_case for database
        const updateData = {
          code: processedData.code,
          name: processedData.name,
          account_type: processedData.accountType,
          category: 'general', // Default category
          parent_account_id: processedData.parentId || undefined,
          is_active: true, // Default to active
        };

        await updateAccountAction(account.id, organizationId, updateData, {
          successMessage: '勘定科目を更新しました',
          onSuccess: () => {
            onSuccess();
            onOpenChange(false);
            form.reset();
          },
        });
      } else {
        // Create new account
        // Convert camelCase to snake_case for database
        const createData = {
          organization_id: organizationId,
          code: processedData.code,
          name: processedData.name,
          account_type: processedData.accountType,
          category: 'general', // Default category
          parent_account_id: processedData.parentId || undefined,
          is_active: true, // Default to active
        };

        await createAccountAction(createData, {
          successMessage: '勘定科目を作成しました',
          onSuccess: () => {
            onSuccess();
            onOpenChange(false);
            form.reset();
          },
        });
      }
    } catch (error) {
      console.error('Failed to save account:', error);
      toast.error(account ? '勘定科目の更新に失敗しました' : '勘定科目の作成に失敗しました');
    }
  };

  const selectedType = form.watch('accountType');
  const filteredParentAccounts = accounts.filter(
    (a) => a.account_type === selectedType && a.id !== account?.id
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
