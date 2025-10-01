'use client';

import type { Account } from '@/types/account';

import { Minus, Plus } from 'lucide-react';
import { FieldArrayWithId, UseFieldArrayRemove, UseFormReturn } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface JournalEntryFormData {
  entryDate: Date;
  description: string;
  documentNumber?: string;
  lines: {
    accountId: string;
    debitAmount: number;
    creditAmount: number;
    description?: string;
    taxRate?: number;
  }[];
}

interface JournalEntryLineItemsProps {
  fields: FieldArrayWithId<JournalEntryFormData, 'lines', 'id'>[];
  accounts: Account[];
  form: UseFormReturn<JournalEntryFormData>;
  remove: UseFieldArrayRemove;
  onAddLine: () => void;
  onRemoveLine: (index: number) => void;
}

export function JournalEntryLineItems({
  fields,
  accounts,
  form,
  remove: _remove,
  onAddLine,
  onRemoveLine,
}: JournalEntryLineItemsProps) {
  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Label>仕訳明細</Label>
          <Button type="button" variant="outline" size="sm" onClick={onAddLine}>
            <Plus className="mr-2 h-4 w-4" />
            行を追加
          </Button>
        </div>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">勘定科目</TableHead>
                <TableHead className="w-[150px]">借方金額</TableHead>
                <TableHead className="w-[150px]">貸方金額</TableHead>
                <TableHead>摘要</TableHead>
                <TableHead className="w-[100px]">税率(%)</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, index) => (
                <TableRow key={field.id}>
                  <TableCell>
                    <Select
                      value={form.watch(`lines.${index}.accountId`)}
                      onValueChange={(value) => form.setValue(`lines.${index}.accountId`, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="選択してください" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.code} - {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.lines?.[index]?.accountId && (
                      <p className="text-sm text-red-500 mt-1">
                        {form.formState.errors.lines[index]?.accountId?.message}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      {...form.register(`lines.${index}.debitAmount`, { valueAsNumber: true })}
                      placeholder="0"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      {...form.register(`lines.${index}.creditAmount`, { valueAsNumber: true })}
                      placeholder="0"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      {...form.register(`lines.${index}.description`)}
                      placeholder="摘要（任意）"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      {...form.register(`lines.${index}.taxRate`, { valueAsNumber: true })}
                      placeholder="0"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveLine(index)}
                      disabled={fields.length <= 2}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
