import {
  SimpleEntryInput,
  SimpleEntryConversionResult,
  TRANSACTION_PATTERNS,
  TransactionType,
} from '@/types/simple-entry';

export class SimpleEntryConverter {
  private accountMap: Map<string, string>;

  constructor(accounts: Array<{ id: string; code: string; name: string }>) {
    this.accountMap = new Map(accounts.map((acc) => [acc.code, acc.id]));
  }

  /**
   * Convert simple entry input to journal entry format
   */
  convert(input: SimpleEntryInput): SimpleEntryConversionResult {
    const pattern = TRANSACTION_PATTERNS[input.transactionType];
    if (!pattern) {
      return {
        journalEntry: {
          entryDate: input.date,
          description: input.description,
          lines: [],
        },
        validationErrors: ['無効な取引タイプです'],
      };
    }

    const validationErrors = this.validate(input);
    if (validationErrors.length > 0) {
      return {
        journalEntry: {
          entryDate: input.date,
          description: input.description,
          lines: [],
        },
        validationErrors,
      };
    }

    const lines = this.createJournalLines(input, pattern);

    return {
      journalEntry: {
        entryDate: input.date,
        description: input.description || this.generateDescription(input),
        lines,
      },
    };
  }

  /**
   * Validate simple entry input
   */
  private validate(input: SimpleEntryInput): string[] {
    const errors: string[] = [];
    const pattern = TRANSACTION_PATTERNS[input.transactionType];

    if (!pattern) {
      errors.push('取引タイプが指定されていません');
      return errors;
    }

    // Check required fields
    if (pattern.requiredFields.includes('amount') && (!input.amount || input.amount <= 0)) {
      errors.push('金額を入力してください');
    }

    if (pattern.requiredFields.includes('date') && !input.date) {
      errors.push('日付を入力してください');
    }

    if (pattern.requiredFields.includes('description') && !input.description) {
      errors.push('摘要を入力してください');
    }

    if (pattern.requiredFields.includes('account') && !input.selectedAccount) {
      errors.push('勘定科目を選択してください');
    }

    return errors;
  }

  /**
   * Create journal entry lines based on transaction pattern
   */
  private createJournalLines(
    input: SimpleEntryInput,
    pattern: (typeof TRANSACTION_PATTERNS)[TransactionType]
  ): Array<{ accountId: string; debitAmount: number; creditAmount: number }> {
    const lines: Array<{ accountId: string; debitAmount: number; creditAmount: number }> = [];
    const amount = input.amount;

    // Handle tax if specified
    const taxAmount = input.taxRate ? Math.floor((amount * input.taxRate) / 100) : 0;
    const baseAmount = amount - taxAmount;

    switch (input.transactionType) {
      case 'cash_sale':
      case 'credit_sale':
      case 'cash_purchase':
      case 'credit_purchase':
      case 'salary_payment':
      case 'collection':
      case 'payment':
      case 'bank_deposit':
      case 'bank_withdrawal': {
        // Simple two-line entries with fixed accounts
        const debitAccountId = this.accountMap.get(pattern.defaultDebitAccount || '') || '';
        const creditAccountId = this.accountMap.get(pattern.defaultCreditAccount || '') || '';

        if (
          taxAmount > 0 &&
          (input.transactionType === 'cash_sale' || input.transactionType === 'credit_sale')
        ) {
          // Sales with tax
          lines.push({
            accountId: debitAccountId,
            debitAmount: amount,
            creditAmount: 0,
          });
          lines.push({
            accountId: creditAccountId,
            debitAmount: 0,
            creditAmount: baseAmount,
          });
          // Add tax payable (仮受消費税)
          const taxPayableId = this.accountMap.get('2140') || ''; // Assuming 2140 is tax payable
          if (taxPayableId) {
            lines.push({
              accountId: taxPayableId,
              debitAmount: 0,
              creditAmount: taxAmount,
            });
          }
        } else if (
          taxAmount > 0 &&
          (input.transactionType === 'cash_purchase' || input.transactionType === 'credit_purchase')
        ) {
          // Purchase with tax
          lines.push({
            accountId: debitAccountId,
            debitAmount: baseAmount,
            creditAmount: 0,
          });
          // Add tax receivable (仮払消費税)
          const taxReceivableId = this.accountMap.get('1150') || ''; // Assuming 1150 is tax receivable
          if (taxReceivableId) {
            lines.push({
              accountId: taxReceivableId,
              debitAmount: taxAmount,
              creditAmount: 0,
            });
          }
          lines.push({
            accountId: creditAccountId,
            debitAmount: 0,
            creditAmount: amount,
          });
        } else {
          // No tax
          lines.push({
            accountId: debitAccountId,
            debitAmount: amount,
            creditAmount: 0,
          });
          lines.push({
            accountId: creditAccountId,
            debitAmount: 0,
            creditAmount: amount,
          });
        }
        break;
      }

      case 'expense_cash':
      case 'expense_bank': {
        // Expense entries - user selects expense account
        const expenseAccountId = this.accountMap.get(input.selectedAccount || '') || '';
        const paymentAccountId = this.accountMap.get(pattern.defaultCreditAccount || '') || '';

        if (taxAmount > 0) {
          lines.push({
            accountId: expenseAccountId,
            debitAmount: baseAmount,
            creditAmount: 0,
          });
          // Add tax receivable
          const taxReceivableId = this.accountMap.get('1150') || '';
          if (taxReceivableId) {
            lines.push({
              accountId: taxReceivableId,
              debitAmount: taxAmount,
              creditAmount: 0,
            });
          }
          lines.push({
            accountId: paymentAccountId,
            debitAmount: 0,
            creditAmount: amount,
          });
        } else {
          lines.push({
            accountId: expenseAccountId,
            debitAmount: amount,
            creditAmount: 0,
          });
          lines.push({
            accountId: paymentAccountId,
            debitAmount: 0,
            creditAmount: amount,
          });
        }
        break;
      }

      case 'transfer': {
        // Transfer entries - user selects both accounts
        // This is a simplified version - in reality, we'd need two account selections
        // For now, we'll just create a placeholder
        lines.push({
          accountId: this.accountMap.get('1130') || '', // Default to bank account
          debitAmount: amount,
          creditAmount: 0,
        });
        lines.push({
          accountId: this.accountMap.get('1110') || '', // Default to cash
          debitAmount: 0,
          creditAmount: amount,
        });
        break;
      }
    }

    return lines;
  }

  /**
   * Generate default description based on transaction type
   */
  private generateDescription(input: SimpleEntryInput): string {
    const pattern = TRANSACTION_PATTERNS[input.transactionType];
    const date = new Date(input.date).toLocaleDateString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
    });
    return `${date} ${pattern.name}`;
  }

  /**
   * Get expense accounts for selection
   */
  static getExpenseAccounts(
    accounts: Array<{ id: string; code: string; name: string; accountType: string }>
  ) {
    return accounts.filter((acc) => acc.accountType === 'EXPENSE');
  }

  /**
   * Check if transaction type requires account selection
   */
  static requiresAccountSelection(transactionType: TransactionType): boolean {
    const pattern = TRANSACTION_PATTERNS[transactionType];
    return pattern.requiredFields.includes('account');
  }
}
