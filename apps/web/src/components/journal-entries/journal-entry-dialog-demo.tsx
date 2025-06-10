'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Minus, Plus } from 'lucide-react';
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

const journalEntrySchema = z.object({
  entryDate: z.string().min(1, '日付は必須です'),
  description: z.string().min(1, '摘要は必須です').max(100, '摘要は100文字以内で入力してください'),
  documentNumber: z.string().optional(),
  lines: z.array(z.object({
    accountId: z.string().min(1, '勘定科目を選択してください'),
    debitAmount: z.number().min(0),
    creditAmount: z.number().min(0),
    description: z.string().optional(),
    taxRate: z.number().optional(),
  })).min(2, '仕訳明細は最低2行必要です').refine(
    (lines) => {
      const totalDebit = lines.reduce((sum, line) => sum + line.debitAmount, 0);
      const totalCredit = lines.reduce((sum, line) => sum + line.creditAmount, 0);
      return totalDebit === totalCredit && totalDebit > 0;
    },
    { message: '借方と貸方の合計が一致していません' }
  ),
});

type JournalEntryFormData = z.infer<typeof journalEntrySchema>;

interface JournalEntry {
  id: string;
  entryNumber: string;
  entryDate: string;
  description: string;
  status: 'DRAFT' | 'APPROVED' | 'CANCELLED';
  documentNumber?: string;
  lines: {
    id: string;
    accountId: string;
    debitAmount: number;
    creditAmount: number;
    description?: string;
    taxRate?: number;
  }[];
}

interface JournalEntryDialogDemoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: JournalEntry | null;
  onSuccess: () => void;
}

// Mock accounts data
const mockAccounts = [
  { id: '1', code: '1110', name: '現金', accountType: 'ASSET' },
  { id: '2', code: '1120', name: '当座預金', accountType: 'ASSET' },
  { id: '3', code: '1130', name: '普通預金', accountType: 'ASSET' },
  { id: '4', code: '1140', name: '売掛金', accountType: 'ASSET' },
  { id: '5', code: '2110', name: '買掛金', accountType: 'LIABILITY' },
  { id: '6', code: '2140', name: '仮払消費税', accountType: 'ASSET' },
  { id: '7', code: '2150', name: '仮受消費税', accountType: 'LIABILITY' },
  { id: '8', code: '4110', name: '売上高', accountType: 'REVENUE' },
  { id: '9', code: '5110', name: '仕入高', accountType: 'EXPENSE' },
  { id: '10', code: '5210', name: '給料手当', accountType: 'EXPENSE' },
];

export function JournalEntryDialogDemo({
  open,
  onOpenChange,
  entry,
  onSuccess,
}: JournalEntryDialogDemoProps) {
  const form = useForm<JournalEntryFormData>({
    resolver: zodResolver(journalEntrySchema),
    defaultValues: {
      entryDate: entry?.entryDate || new Date().toISOString().split('T')[0],
      description: entry?.description || '',
      documentNumber: entry?.documentNumber || '',
      lines: entry?.lines || [
        { accountId: '', debitAmount: 0, creditAmount: 0, description: '', taxRate: 0 },
        { accountId: '', debitAmount: 0, creditAmount: 0, description: '', taxRate: 0 },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'lines',
  });

  const onSubmit = async (_data: JournalEntryFormData) => {
    try {
      // デモ用: API呼び出しの代わりに成功メッセージを表示
      await new Promise(resolve => setTimeout(resolve, 500)); // 擬似的な遅延
      
      if (entry) {
        toast.success('仕訳を更新しました（デモ）');
      } else {
        toast.success('仕訳を作成しました（デモ）');
      }
      
      onSuccess();
      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error('Demo error:', error);
      toast.error('エラーが発生しました（デモ）');
    }
  };

  const watchLines = form.watch('lines');
  const totalDebit = watchLines.reduce((sum, line) => sum + (line.debitAmount || 0), 0);
  const totalCredit = watchLines.reduce((sum, line) => sum + (line.creditAmount || 0), 0);
  const isBalanced = totalDebit === totalCredit && totalDebit > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{entry ? '仕訳の編集' : '仕訳の新規作成'}</DialogTitle>
          <DialogDescription>
            仕訳の情報を入力してください（デモ版）
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                name="description"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>摘要</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="仕訳の摘要を入力"
                        className="resize-none"
                        rows={1}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="documentNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>証憑番号（任意）</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="INV-001" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <FormLabel>仕訳明細</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ accountId: '', debitAmount: 0, creditAmount: 0, description: '', taxRate: 0 })}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  行を追加
                </Button>
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 text-sm font-medium">
                  <div className="col-span-3">勘定科目</div>
                  <div className="col-span-2 text-right">借方金額</div>
                  <div className="col-span-2 text-right">貸方金額</div>
                  <div className="col-span-3">摘要</div>
                  <div className="col-span-1 text-center">税率</div>
                  <div className="col-span-1"></div>
                </div>

                {fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-12 gap-2">
                    <FormField
                      control={form.control}
                      name={`lines.${index}.accountId`}
                      render={({ field }) => (
                        <FormItem className="col-span-3">
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="選択" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {mockAccounts.map((account) => (
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
                    <FormField
                      control={form.control}
                      name={`lines.${index}.debitAmount`}
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                              className="text-right"
                              min="0"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`lines.${index}.creditAmount`}
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                              className="text-right"
                              min="0"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`lines.${index}.description`}
                      render={({ field }) => (
                        <FormItem className="col-span-3">
                          <FormControl>
                            <Input {...field} placeholder="明細摘要" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`lines.${index}.taxRate`}
                      render={({ field }) => (
                        <FormItem className="col-span-1">
                          <Select 
                            onValueChange={(value) => field.onChange(Number(value))} 
                            defaultValue={String(field.value || 0)}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="0">0%</SelectItem>
                              <SelectItem value="8">8%</SelectItem>
                              <SelectItem value="10">10%</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="col-span-1 flex justify-center">
                      {fields.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-12 gap-2 pt-2 border-t">
                <div className="col-span-3 font-medium">合計</div>
                <div className="col-span-2 text-right font-medium">
                  {new Intl.NumberFormat('ja-JP').format(totalDebit)}
                </div>
                <div className="col-span-2 text-right font-medium">
                  {new Intl.NumberFormat('ja-JP').format(totalCredit)}
                </div>
                <div className="col-span-5">
                  {!isBalanced && (
                    <span className="text-sm text-red-500">
                      {totalDebit === 0 && totalCredit === 0
                        ? '金額を入力してください'
                        : '借方と貸方の合計が一致していません'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                キャンセル
              </Button>
              <Button type="submit" disabled={!isBalanced}>
                {entry ? '更新' : '作成'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}