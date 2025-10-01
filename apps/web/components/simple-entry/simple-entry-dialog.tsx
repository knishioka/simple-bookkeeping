'use client';

import { ArrowLeft, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { SimpleEntryForm } from './simple-entry-form';
import { TransactionTypeSelector } from './transaction-type-selector';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SimpleEntryConverter } from '@/lib/simple-entry-converter';
import { CreateJournalEntryDto } from '@/types/journal';
import { SimpleEntryInput, TransactionType } from '@/types/simple-entry';

interface SimpleEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Array<{ id: string; code: string; name: string; accountType: string }>;
  onSubmit: (journalEntry: CreateJournalEntryDto) => Promise<void>;
}

type Step = 'select-type' | 'input-details' | 'confirm';

export function SimpleEntryDialog({
  open,
  onOpenChange,
  accounts,
  onSubmit,
}: SimpleEntryDialogProps) {
  const [step, setStep] = useState<Step>('select-type');
  const [selectedType, setSelectedType] = useState<TransactionType | undefined>();
  const [, setSimpleInput] = useState<SimpleEntryInput | undefined>();
  const [convertedEntry, setConvertedEntry] = useState<CreateJournalEntryDto | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const converter = new SimpleEntryConverter(accounts);

  const handleTypeSelect = (type: TransactionType) => {
    setSelectedType(type);
    setStep('input-details');
    setError(undefined);
  };

  const handleFormSubmit = (input: SimpleEntryInput) => {
    setSimpleInput(input);
    const result = converter.convert(input);

    if (result.validationErrors && result.validationErrors.length > 0) {
      setError(result.validationErrors.join(', '));
      return;
    }

    setConvertedEntry(result.journalEntry as CreateJournalEntryDto);
    setStep('confirm');
    setError(undefined);
  };

  const handleConfirm = async () => {
    if (!convertedEntry) return;

    setIsSubmitting(true);
    setError(undefined);

    try {
      await onSubmit(convertedEntry);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '仕訳の作成に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step === 'input-details') {
      setStep('select-type');
      setSelectedType(undefined);
    } else if (step === 'confirm') {
      setStep('input-details');
      setConvertedEntry(undefined);
    }
    setError(undefined);
  };

  const handleClose = () => {
    setStep('select-type');
    setSelectedType(undefined);
    setSimpleInput(undefined);
    setConvertedEntry(undefined);
    setError(undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {step !== 'select-type' && (
                <Button variant="ghost" size="icon" onClick={handleBack} disabled={isSubmitting}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <DialogTitle className="flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <span>かんたん入力</span>
              </DialogTitle>
            </div>
          </div>
          <DialogDescription>
            {step === 'select-type' && '取引の種類を選択してください'}
            {step === 'input-details' && '取引の詳細を入力してください'}
            {step === 'confirm' && '作成される仕訳を確認してください'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="mt-4">
          {step === 'select-type' && (
            <TransactionTypeSelector selectedType={selectedType} onSelect={handleTypeSelect} />
          )}

          {step === 'input-details' && selectedType && (
            <SimpleEntryForm
              transactionType={selectedType}
              accounts={accounts}
              onSubmit={handleFormSubmit}
              onCancel={handleBack}
            />
          )}

          {step === 'confirm' && convertedEntry && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium mb-2">作成される仕訳</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>日付:</span>
                    <span>{convertedEntry.entryDate}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>摘要:</span>
                    <span>{convertedEntry.description}</span>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium">勘定科目</th>
                      <th className="px-4 py-2 text-right text-sm font-medium">借方</th>
                      <th className="px-4 py-2 text-right text-sm font-medium">貸方</th>
                    </tr>
                  </thead>
                  <tbody>
                    {convertedEntry.lines.map((line, index) => {
                      const account = accounts.find((a) => a.id === line.accountId);
                      return (
                        <tr key={index} className="border-t">
                          <td className="px-4 py-2 text-sm">
                            {account ? `${account.code} - ${account.name}` : line.accountId}
                          </td>
                          <td className="px-4 py-2 text-right text-sm">
                            {line.debitAmount > 0 ? line.debitAmount.toLocaleString() : '-'}
                          </td>
                          <td className="px-4 py-2 text-right text-sm">
                            {line.creditAmount > 0 ? line.creditAmount.toLocaleString() : '-'}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t font-medium">
                      <td className="px-4 py-2 text-sm">合計</td>
                      <td className="px-4 py-2 text-right text-sm">
                        {convertedEntry.lines
                          .reduce((sum, line) => sum + line.debitAmount, 0)
                          .toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-right text-sm">
                        {convertedEntry.lines
                          .reduce((sum, line) => sum + line.creditAmount, 0)
                          .toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={handleBack} disabled={isSubmitting}>
                  戻る
                </Button>
                <Button onClick={handleConfirm} disabled={isSubmitting}>
                  {isSubmitting ? '作成中...' : '仕訳を作成'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
