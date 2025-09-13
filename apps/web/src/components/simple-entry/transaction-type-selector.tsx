'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TRANSACTION_PATTERNS, TransactionType } from '@/types/simple-entry';

interface TransactionTypeSelectorProps {
  selectedType?: TransactionType;
  onSelect: (type: TransactionType) => void;
}

const categoryLabels = {
  income: '収入',
  expense: '支出',
  asset: '資産',
  other: 'その他',
};

const categoryColors = {
  income: 'bg-green-50 hover:bg-green-100 border-green-200',
  expense: 'bg-red-50 hover:bg-red-100 border-red-200',
  asset: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
  other: 'bg-gray-50 hover:bg-gray-100 border-gray-200',
};

export function TransactionTypeSelector({ selectedType, onSelect }: TransactionTypeSelectorProps) {
  const categories = ['income', 'expense', 'asset', 'other'] as const;

  return (
    <div className="space-y-6">
      {categories.map((category) => {
        const patterns = Object.values(TRANSACTION_PATTERNS).filter((p) => p.category === category);

        if (patterns.length === 0) return null;

        return (
          <div key={category}>
            <h3 className="text-sm font-medium text-gray-700 mb-3">{categoryLabels[category]}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {patterns.map((pattern) => (
                <Card
                  key={pattern.type}
                  className={cn(
                    'cursor-pointer transition-colors border-2',
                    categoryColors[category],
                    selectedType === pattern.type && 'ring-2 ring-primary border-primary'
                  )}
                  onClick={() => onSelect(pattern.type)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl" role="img" aria-label={pattern.name}>
                        {pattern.icon}
                      </span>
                      <div>
                        <div className="font-medium text-sm">{pattern.name}</div>
                        <div className="text-xs text-gray-600 mt-1">{pattern.description}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
