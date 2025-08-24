'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { SimpleEntryInput, TransactionType, TRANSACTION_PATTERNS } from '@simple-bookkeeping/types';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { SimpleEntryConverter } from '@/lib/simple-entry-converter';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  amount: z.number().min(1, '金額を入力してください'),
  date: z.date({
    message: '日付を選択してください',
  }),
  description: z.string().min(1, '摘要を入力してください').max(100),
  selectedAccount: z.string().optional(),
  taxRate: z.number().optional(),
});

interface SimpleEntryFormProps {
  transactionType: TransactionType;
  accounts: Array<{ id: string; code: string; name: string; accountType: string }>;
  onSubmit: (data: SimpleEntryInput) => void;
  onCancel: () => void;
}

export function SimpleEntryForm({
  transactionType,
  accounts,
  onSubmit,
  onCancel,
}: SimpleEntryFormProps) {
  const pattern = TRANSACTION_PATTERNS[transactionType];
  const requiresAccountSelection = SimpleEntryConverter.requiresAccountSelection(transactionType);
  const expenseAccounts = SimpleEntryConverter.getExpenseAccounts(accounts);

  const [includeTax, setIncludeTax] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 0,
      date: new Date(),
      description: '',
      selectedAccount: '',
      taxRate: 0,
    },
  });

  // Generate default description when transaction type changes
  useEffect(() => {
    const date = form.getValues('date');
    const dateStr = format(date, 'M/d');
    form.setValue('description', `${dateStr} ${pattern.name}`);
  }, [transactionType, pattern.name, form]);

  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    const input: SimpleEntryInput = {
      transactionType,
      amount: values.amount,
      date: format(values.date, 'yyyy-MM-dd'),
      description: values.description,
      selectedAccount: values.selectedAccount,
      taxRate: includeTax ? values.taxRate : undefined,
    };
    onSubmit(input);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{pattern.icon}</span>
            <div>
              <h3 className="font-medium">{pattern.name}</h3>
              <p className="text-sm text-gray-600">{pattern.description}</p>
            </div>
          </div>
        </div>

        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>金額</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="0"
                  {...field}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                />
              </FormControl>
              <FormDescription>取引金額を入力してください</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {requiresAccountSelection && (
          <FormField
            control={form.control}
            name="selectedAccount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>勘定科目</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={pattern.accountSelectionHint || '勘定科目を選択'} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {expenseAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.code}>
                        {account.code} - {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>日付</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full pl-3 text-left font-normal',
                        !field.value && 'text-muted-foreground'
                      )}
                    >
                      {field.value ? (
                        format(field.value, 'yyyy年MM月dd日')
                      ) : (
                        <span>日付を選択</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormDescription>取引日を選択してください</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>摘要</FormLabel>
              <FormControl>
                <Textarea placeholder="取引の詳細を入力" className="resize-none" {...field} />
              </FormControl>
              <FormDescription>取引の内容を説明してください</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {(transactionType === 'cash_sale' ||
          transactionType === 'credit_sale' ||
          transactionType === 'cash_purchase' ||
          transactionType === 'credit_purchase' ||
          transactionType === 'expense_cash' ||
          transactionType === 'expense_bank') && (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="includeTax"
                checked={includeTax}
                onChange={(e) => setIncludeTax(e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="includeTax" className="text-sm font-medium">
                消費税を含む
              </label>
            </div>

            {includeTax && (
              <FormField
                control={form.control}
                name="taxRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>税率</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(Number(value))}
                      defaultValue={String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="税率を選択" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="8">8%</SelectItem>
                        <SelectItem value="10">10%</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
        )}

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            キャンセル
          </Button>
          <Button type="submit">仕訳を作成</Button>
        </div>
      </form>
    </Form>
  );
}
