'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Minus, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
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
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/lib/api-client';

const journalEntryLineSchema = z.object({
  accountId: z.string().min(1, '勘定科目を選択してください'),
  debitAmount: z.number().min(0, '借方金額は0以上である必要があります'),
  creditAmount: z.number().min(0, '貸方金額は0以上である必要があります'),
  description: z.string().optional(),
  taxRate: z.number().min(0).max(100).optional(),
});

const journalEntrySchema = z
  .object({
    entryDate: z.string().min(1, '日付は必須です'),
    description: z
      .string()
      .min(1, '摘要は必須です')
      .max(200, '摘要は200文字以内で入力してください'),
    documentNumber: z.string().optional(),
    lines: z.array(journalEntryLineSchema).min(2, '最低2行の仕訳明細が必要です'),
  })
  .refine(
    (data) => {
      // Validate that debits equal credits
      const totalDebits = data.lines.reduce((sum, line) => sum + line.debitAmount, 0);
      const totalCredits = data.lines.reduce((sum, line) => sum + line.creditAmount, 0);
      return Math.abs(totalDebits - totalCredits) < 0.01;
    },
    {
      message: '借方合計と貸方合計が一致しません',
      path: ['lines'],
    }
  )
  .refine(
    (data) => {
      // Validate that each line has either debit or credit (not both)
      return data.lines.every(
        (line) =>
          (line.debitAmount > 0 && line.creditAmount === 0) ||
          (line.debitAmount === 0 && line.creditAmount > 0)
      );
    },
    {
      message: '各行は借方または貸方のどちらか一方のみ入力してください',
      path: ['lines'],
    }
  );

type JournalEntryFormData = z.infer<typeof journalEntrySchema>;

interface Account {
  id: string;
  code: string;
  name: string;
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
}

interface JournalEntry {
  id: string;
  entryNumber: string;
  entryDate: string;
  description: string;
  status: 'DRAFT' | 'APPROVED' | 'CANCELLED';
  documentNumber?: string;
  lines: Array<{
    id: string;
    accountId: string;
    account: {
      id: string;
      code: string;
      name: string;
    };
    debitAmount: number;
    creditAmount: number;
    description?: string;
    taxRate?: number;
  }>;
}

interface JournalEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: JournalEntry | null;
  onSuccess: () => void;
}

export function JournalEntryDialog({
  open,
  onOpenChange,
  entry,
  onSuccess,
}: JournalEntryDialogProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);

  const form = useForm<JournalEntryFormData>({
    resolver: zodResolver(journalEntrySchema),
    defaultValues: {
      entryDate: entry?.entryDate || new Date().toISOString().split('T')[0],
      description: entry?.description || '',
      documentNumber: entry?.documentNumber || '',
      lines: entry?.lines.map((line) => ({
        accountId: line.accountId,
        debitAmount: line.debitAmount,
        creditAmount: line.creditAmount,
        description: line.description || '',
        taxRate: line.taxRate || 0,
      })) || [
        { accountId: '', debitAmount: 0, creditAmount: 0, description: '', taxRate: 0 },
        { accountId: '', debitAmount: 0, creditAmount: 0, description: '', taxRate: 0 },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'lines',
  });

  useEffect(() => {
    if (open) {
      fetchAccounts();
      // Reset form when dialog opens
      if (entry) {
        form.reset({
          entryDate: entry.entryDate,
          description: entry.description,
          documentNumber: entry.documentNumber || '',
          lines: entry.lines.map((line) => ({
            accountId: line.accountId,
            debitAmount: line.debitAmount,
            creditAmount: line.creditAmount,
            description: line.description || '',
            taxRate: line.taxRate || 0,
          })),
        });
      } else {
        form.reset({
          entryDate: new Date().toISOString().split('T')[0],
          description: '',
          documentNumber: '',
          lines: [
            { accountId: '', debitAmount: 0, creditAmount: 0, description: '', taxRate: 0 },
            { accountId: '', debitAmount: 0, creditAmount: 0, description: '', taxRate: 0 },
          ],
        });
      }
    }
  }, [open, entry, form]);

  const fetchAccounts = async () => {
    try {
      const response = await apiClient.get<Account[]>('/accounts?active=true');
      if (response.data) {
        setAccounts(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
      toast.error('勘定科目の取得に失敗しました');
    }
  };

  const onSubmit = async (data: JournalEntryFormData) => {
    setLoading(true);
    try {
      if (entry) {
        // Update existing entry
        const response = await apiClient.put(`/journal-entries/${entry.id}`, data);
        if (response.data) {
          toast.success('仕訳を更新しました');
          onSuccess();
          onOpenChange(false);
        }
      } else {
        // Create new entry
        const response = await apiClient.post('/journal-entries', data);
        if (response.data) {
          toast.success('仕訳を作成しました');
          onSuccess();
          onOpenChange(false);
        }
      }
    } catch (error) {
      console.error('Failed to save journal entry:', error);
      toast.error(entry ? '仕訳の更新に失敗しました' : '仕訳の作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const addLine = () => {
    append({ accountId: '', debitAmount: 0, creditAmount: 0, description: '', taxRate: 0 });
  };

  const removeLine = (index: number) => {
    if (fields.length > 2) {
      remove(index);
    }
  };

  const calculateTotals = () => {
    const lines = form.watch('lines');
    const totalDebits = lines.reduce((sum, line) => sum + (line.debitAmount || 0), 0);
    const totalCredits = lines.reduce((sum, line) => sum + (line.creditAmount || 0), 0);
    return { totalDebits, totalCredits };
  };

  const { totalDebits, totalCredits } = calculateTotals();
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{entry ? '仕訳の編集' : '仕訳の新規作成'}</DialogTitle>
          <DialogDescription>
            複式簿記の仕訳を入力してください。借方合計と貸方合計が一致する必要があります。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="entryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>日付</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="documentNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>証憑番号（任意）</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="請求書番号など" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex items-end">
                <div
                  className={`text-sm p-2 rounded ${
                    isBalanced ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}
                >
                  差額: ¥{Math.abs(totalDebits - totalCredits).toLocaleString()}
                </div>
              </div>
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>摘要</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="取引の内容を入力してください" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">仕訳明細</h3>
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus className="mr-2 h-4 w-4" />
                  行を追加
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 gap-2 p-4 bg-gray-50 font-medium text-sm">
                  <div className="col-span-3">勘定科目</div>
                  <div className="col-span-2 text-right">借方金額</div>
                  <div className="col-span-2 text-right">貸方金額</div>
                  <div className="col-span-3">摘要</div>
                  <div className="col-span-1 text-center">税率</div>
                  <div className="col-span-1"></div>
                </div>

                {fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-12 gap-2 p-4 border-t">
                    <div className="col-span-3">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.accountId`}
                        render={({ field }) => (
                          <FormItem>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="勘定科目を選択" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {accounts.map((account) => (
                                  <SelectItem key={account.id} value={account.id}>
                                    {account.code} - {account.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="col-span-2">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.debitAmount`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                className="text-right"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="col-span-2">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.creditAmount`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                className="text-right"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="col-span-3">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.description`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input {...field} placeholder="摘要（任意）" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="col-span-1">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.taxRate`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.1"
                                min="0"
                                max="100"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                className="text-center"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="col-span-1 flex justify-center">
                      {fields.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLine(index)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-12 gap-2 p-4 bg-gray-50 border rounded-lg">
                <div className="col-span-3 font-medium">合計</div>
                <div className="col-span-2 text-right font-medium">
                  ¥{totalDebits.toLocaleString()}
                </div>
                <div className="col-span-2 text-right font-medium">
                  ¥{totalCredits.toLocaleString()}
                </div>
                <div className="col-span-5"></div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                キャンセル
              </Button>
              <Button type="submit" disabled={loading || !isBalanced}>
                {loading ? '保存中...' : entry ? '更新' : '作成'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
