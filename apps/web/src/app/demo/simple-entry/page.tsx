'use client';

import {
  SimpleEntryInput,
  TransactionType,
  CreateJournalEntryDto,
} from '@simple-bookkeeping/types';
import { ArrowLeft, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { SimpleEntryForm } from '@/components/simple-entry/simple-entry-form';
import { TransactionTypeSelector } from '@/components/simple-entry/transaction-type-selector';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SimpleEntryConverter } from '@/lib/simple-entry-converter';

// Mock accounts for demo
const mockAccounts = [
  { id: '1', code: '1110', name: '現金', accountType: 'ASSET' },
  { id: '2', code: '1120', name: '当座預金', accountType: 'ASSET' },
  { id: '3', code: '1130', name: '普通預金', accountType: 'ASSET' },
  { id: '4', code: '1140', name: '売掛金', accountType: 'ASSET' },
  { id: '5', code: '1150', name: '仮払消費税', accountType: 'ASSET' },
  { id: '6', code: '2110', name: '買掛金', accountType: 'LIABILITY' },
  { id: '7', code: '2140', name: '仮受消費税', accountType: 'LIABILITY' },
  { id: '8', code: '4110', name: '売上高', accountType: 'REVENUE' },
  { id: '9', code: '5110', name: '仕入高', accountType: 'EXPENSE' },
  { id: '10', code: '5210', name: '給料手当', accountType: 'EXPENSE' },
  { id: '11', code: '5220', name: '法定福利費', accountType: 'EXPENSE' },
  { id: '12', code: '5230', name: '旅費交通費', accountType: 'EXPENSE' },
  { id: '13', code: '5240', name: '通信費', accountType: 'EXPENSE' },
  { id: '14', code: '5250', name: '消耗品費', accountType: 'EXPENSE' },
  { id: '15', code: '5260', name: '水道光熱費', accountType: 'EXPENSE' },
  { id: '16', code: '5270', name: '支払手数料', accountType: 'EXPENSE' },
];

type Step = 'select-type' | 'input-details' | 'confirm';

export default function SimpleEntryPage() {
  const [step, setStep] = useState<Step>('select-type');
  const [selectedType, setSelectedType] = useState<TransactionType | undefined>();
  const [, setSimpleInput] = useState<SimpleEntryInput | undefined>();
  const [convertedEntry, setConvertedEntry] = useState<CreateJournalEntryDto | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState(false);

  const converter = new SimpleEntryConverter(mockAccounts);

  const handleTypeSelect = (type: TransactionType) => {
    setSelectedType(type);
    setStep('input-details');
    setError(undefined);
    setSuccess(false);
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
      // Demo: Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // Journal entry created (demo)

      setSuccess(true);
      setStep('select-type');
      setSelectedType(undefined);
      setSimpleInput(undefined);
      setConvertedEntry(undefined);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
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

  return (
    <div className="space-y-6 p-8 max-w-6xl mx-auto">
      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-6">
        <p className="text-sm text-yellow-800">
          デモページ: これはかんたん入力モードのUIデモです。実際のデータは保存されません。
        </p>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Link href="/demo/journal-entries">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center space-x-2">
              <Sparkles className="h-8 w-8 text-primary" />
              <span>かんたん入力</span>
            </h1>
            <p className="text-gray-600 mt-1">会計知識がなくても簡単に仕訳を作成できます</p>
          </div>
        </div>
      </div>

      {success && (
        <Alert className="bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">
            仕訳が正常に作成されました！
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {step === 'select-type' && '取引の種類を選択'}
                {step === 'input-details' && '取引の詳細を入力'}
                {step === 'confirm' && '仕訳内容の確認'}
              </CardTitle>
              <CardDescription>
                {step === 'select-type' && 'どのような取引を記録しますか？'}
                {step === 'input-details' && '金額や日付などの詳細を入力してください'}
                {step === 'confirm' && '作成される仕訳を確認してください'}
              </CardDescription>
            </div>
            {step !== 'select-type' && (
              <Button variant="ghost" onClick={handleBack} disabled={isSubmitting}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                戻る
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {step === 'select-type' && (
            <TransactionTypeSelector selectedType={selectedType} onSelect={handleTypeSelect} />
          )}

          {step === 'input-details' && selectedType && (
            <SimpleEntryForm
              transactionType={selectedType}
              accounts={mockAccounts}
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
                      const account = mockAccounts.find((a) => a.id === line.accountId);
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
                    <tr className="border-t font-medium bg-gray-50">
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
        </CardContent>
      </Card>

      {step === 'select-type' && (
        <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">かんたん入力モードとは？</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>• 借方・貸方を意識せずに取引を記録できます</li>
            <li>• よくある取引パターンから選ぶだけで仕訳を自動生成</li>
            <li>• 会計初心者でも正確な複式簿記の記録が可能</li>
            <li>• 消費税の計算も自動で対応</li>
          </ul>
        </div>
      )}
    </div>
  );
}
