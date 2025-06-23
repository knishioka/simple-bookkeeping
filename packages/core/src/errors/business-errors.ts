/**
 * ビジネスロジック関連のエラークラス
 */

import { BaseError } from './base-error';

export class BusinessError extends BaseError {
  constructor(message: string, code = 'BUSINESS_ERROR') {
    super(message, 400, code);
  }
}

export class InsufficientBalanceError extends BusinessError {
  constructor(accountName: string, requiredAmount: number, currentBalance: number) {
    super(
      `${accountName}の残高が不足しています。必要額: ${requiredAmount}、現在の残高: ${currentBalance}`,
      'INSUFFICIENT_BALANCE'
    );
  }
}

export class AccountingPeriodClosedError extends BusinessError {
  constructor(periodName: string) {
    super(`会計期間「${periodName}」は既に締められています`, 'ACCOUNTING_PERIOD_CLOSED');
  }
}

export class InvalidJournalEntryError extends BusinessError {
  constructor(message: string) {
    super(message, 'INVALID_JOURNAL_ENTRY');
  }
}

export class DuplicateAccountCodeError extends BusinessError {
  constructor(code: string) {
    super(`勘定科目コード「${code}」は既に使用されています`, 'DUPLICATE_ACCOUNT_CODE');
  }
}

export class CircularReferenceError extends BusinessError {
  constructor(message: string) {
    super(message, 'CIRCULAR_REFERENCE');
  }
}
