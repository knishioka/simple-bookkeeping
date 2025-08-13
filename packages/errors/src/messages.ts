/**
 * エラーメッセージ定義
 * 将来的にi18n対応を容易にするため、メッセージをキー化
 */

export type ErrorMessageKey =
  | 'RESOURCE_NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'TOO_MANY_REQUESTS'
  | 'INSUFFICIENT_BALANCE'
  | 'UNBALANCED_ENTRY'
  | 'CLOSED_PERIOD'
  | 'INVALID_ACCOUNT_TYPE'
  | 'DUPLICATE_ENTRY'
  | 'ACCOUNTING_PERIOD_CLOSED'
  | 'INVALID_JOURNAL_ENTRY'
  | 'DUPLICATE_ACCOUNT_CODE'
  | 'CIRCULAR_REFERENCE';

export type Language = 'ja' | 'en';

export const ERROR_MESSAGES: Record<Language, Record<ErrorMessageKey, string>> = {
  ja: {
    RESOURCE_NOT_FOUND: '{resource}が見つかりません',
    UNAUTHORIZED: '認証が必要です',
    FORBIDDEN: 'アクセスが拒否されました',
    VALIDATION_ERROR: '入力値が不正です',
    CONFLICT: 'リソースが競合しています',
    TOO_MANY_REQUESTS: 'リクエストが多すぎます',
    INSUFFICIENT_BALANCE:
      '残高不足: {accountName}の残高({available})が不足しています。必要額: {required}',
    UNBALANCED_ENTRY: '借方合計({debitTotal})と貸方合計({creditTotal})が一致しません',
    CLOSED_PERIOD: '会計期間「{periodName}」は既に締められています',
    INVALID_ACCOUNT_TYPE:
      '勘定科目「{accountName}」の種別が不正です。期待: {expectedType}, 実際: {actualType}',
    DUPLICATE_ENTRY: '{field}「{value}」は既に存在します',
    ACCOUNTING_PERIOD_CLOSED: '会計期間「{periodName}」は既に締められています',
    INVALID_JOURNAL_ENTRY: '仕訳が不正です: {message}',
    DUPLICATE_ACCOUNT_CODE: '勘定科目コード「{code}」は既に使用されています',
    CIRCULAR_REFERENCE: '循環参照が検出されました: {message}',
  },
  en: {
    RESOURCE_NOT_FOUND: '{resource} not found',
    UNAUTHORIZED: 'Unauthorized',
    FORBIDDEN: 'Forbidden',
    VALIDATION_ERROR: 'Validation error',
    CONFLICT: 'Resource conflict',
    TOO_MANY_REQUESTS: 'Too many requests',
    INSUFFICIENT_BALANCE:
      'Insufficient balance: {accountName} balance ({available}) is insufficient. Required: {required}',
    UNBALANCED_ENTRY: 'Debit total ({debitTotal}) does not match credit total ({creditTotal})',
    CLOSED_PERIOD: 'Accounting period "{periodName}" is already closed',
    INVALID_ACCOUNT_TYPE:
      'Invalid account type for "{accountName}". Expected: {expectedType}, Actual: {actualType}',
    DUPLICATE_ENTRY: '{field} "{value}" already exists',
    ACCOUNTING_PERIOD_CLOSED: 'Accounting period "{periodName}" is already closed',
    INVALID_JOURNAL_ENTRY: 'Invalid journal entry: {message}',
    DUPLICATE_ACCOUNT_CODE: 'Account code "{code}" is already in use',
    CIRCULAR_REFERENCE: 'Circular reference detected: {message}',
  },
};

/**
 * デフォルト言語設定
 * 環境変数 DEFAULT_LANGUAGE または 'ja' を使用
 */
export const DEFAULT_LANGUAGE: Language = (process.env.DEFAULT_LANGUAGE as Language) || 'ja';

/**
 * メッセージのフォーマット関数
 * プレースホルダーを実際の値に置換
 */
export function formatMessage(message: string, params: Record<string, string | number>): string {
  return message.replace(/{(\w+)}/g, (match, key) => {
    return params[key]?.toString() || match;
  });
}

/**
 * エラーメッセージを取得
 */
export function getErrorMessage(
  key: ErrorMessageKey,
  params?: Record<string, string | number>,
  language: Language = DEFAULT_LANGUAGE
): string {
  const message = ERROR_MESSAGES[language][key];
  if (!message) {
    // フォールバック: 英語メッセージを使用
    const fallbackMessage = ERROR_MESSAGES.en[key];
    if (!fallbackMessage) {
      return key; // 最終フォールバック: キーそのものを返す
    }
    return params ? formatMessage(fallbackMessage, params) : fallbackMessage;
  }
  return params ? formatMessage(message, params) : message;
}
