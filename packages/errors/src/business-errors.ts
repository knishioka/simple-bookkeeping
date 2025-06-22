/**
 * Business logic specific error classes
 */

import { BaseError } from './base-error';

export class BusinessError extends BaseError {
  constructor(message: string, code: string) {
    super(message, 400, code);
  }
}

export class InsufficientBalanceError extends BusinessError {
  constructor(accountName: string, required: number, available: number) {
    super(
      `残高不足: ${accountName}の残高(${available})が不足しています。必要額: ${required}`,
      'INSUFFICIENT_BALANCE'
    );
  }
}

export class UnbalancedEntryError extends BusinessError {
  constructor(debitTotal: number, creditTotal: number) {
    super(`借方合計(${debitTotal})と貸方合計(${creditTotal})が一致しません`, 'UNBALANCED_ENTRY');
  }
}

export class ClosedPeriodError extends BusinessError {
  constructor(periodName: string) {
    super(`会計期間「${periodName}」は既に締められています`, 'CLOSED_PERIOD');
  }
}

export class InvalidAccountTypeError extends BusinessError {
  constructor(accountName: string, expectedType: string, actualType: string) {
    super(
      `勘定科目「${accountName}」の種別が不正です。期待: ${expectedType}, 実際: ${actualType}`,
      'INVALID_ACCOUNT_TYPE'
    );
  }
}

export class DuplicateEntryError extends BusinessError {
  constructor(field: string, value: string) {
    super(`${field}「${value}」は既に存在します`, 'DUPLICATE_ENTRY');
  }
}
