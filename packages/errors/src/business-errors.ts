/**
 * Business logic specific error classes
 */

import { BaseError } from './base-error';
import { getErrorMessage, Language } from './messages';

export class BusinessError extends BaseError {
  constructor(message: string, code: string) {
    super(message, 400, code);
  }
}

export class InsufficientBalanceError extends BusinessError {
  constructor(accountName: string, required: number, available: number, language?: Language) {
    const message = getErrorMessage(
      'INSUFFICIENT_BALANCE',
      { accountName, required, available },
      language
    );
    super(message, 'INSUFFICIENT_BALANCE');
  }
}

export class UnbalancedEntryError extends BusinessError {
  constructor(debitTotal: number, creditTotal: number, language?: Language) {
    const message = getErrorMessage('UNBALANCED_ENTRY', { debitTotal, creditTotal }, language);
    super(message, 'UNBALANCED_ENTRY');
  }
}

export class ClosedPeriodError extends BusinessError {
  constructor(periodName: string, language?: Language) {
    const message = getErrorMessage('CLOSED_PERIOD', { periodName }, language);
    super(message, 'CLOSED_PERIOD');
  }
}

export class InvalidAccountTypeError extends BusinessError {
  constructor(accountName: string, expectedType: string, actualType: string, language?: Language) {
    const message = getErrorMessage(
      'INVALID_ACCOUNT_TYPE',
      { accountName, expectedType, actualType },
      language
    );
    super(message, 'INVALID_ACCOUNT_TYPE');
  }
}

export class DuplicateEntryError extends BusinessError {
  constructor(field: string, value: string, language?: Language) {
    const message = getErrorMessage('DUPLICATE_ENTRY', { field, value }, language);
    super(message, 'DUPLICATE_ENTRY');
  }
}

export class AccountingPeriodClosedError extends BusinessError {
  constructor(periodName: string, language?: Language) {
    const message = getErrorMessage('ACCOUNTING_PERIOD_CLOSED', { periodName }, language);
    super(message, 'ACCOUNTING_PERIOD_CLOSED');
  }
}

export class InvalidJournalEntryError extends BusinessError {
  constructor(errorDetail: string, language?: Language) {
    const message = getErrorMessage('INVALID_JOURNAL_ENTRY', { message: errorDetail }, language);
    super(message, 'INVALID_JOURNAL_ENTRY');
  }
}

export class DuplicateAccountCodeError extends BusinessError {
  constructor(code: string, language?: Language) {
    const message = getErrorMessage('DUPLICATE_ACCOUNT_CODE', { code }, language);
    super(message, 'DUPLICATE_ACCOUNT_CODE');
  }
}

export class CircularReferenceError extends BusinessError {
  constructor(errorDetail: string, language?: Language) {
    const message = getErrorMessage('CIRCULAR_REFERENCE', { message: errorDetail }, language);
    super(message, 'CIRCULAR_REFERENCE');
  }
}
