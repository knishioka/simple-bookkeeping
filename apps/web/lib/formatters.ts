/**
 * 日付・金額のフォーマット関数
 */

/**
 * 日付を日本語形式でフォーマット
 * @param dateString ISO形式の日付文字列
 * @returns フォーマットされた日付文字列
 */
export function formatDate(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * 日付を年月形式でフォーマット
 * @param dateString ISO形式の日付文字列
 * @returns フォーマットされた年月文字列
 */
export function formatYearMonth(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
  });
}

/**
 * 金額を日本円形式でフォーマット
 * @param amount 金額
 * @returns フォーマットされた金額文字列
 */
export function formatAmount(amount: number): string {
  return new Intl.NumberFormat('ja-JP').format(Math.abs(amount));
}

/**
 * 金額を通貨記号付きでフォーマット
 * @param amount 金額
 * @returns フォーマットされた金額文字列（円記号付き）
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
  }).format(amount);
}

/**
 * 月初日を取得
 * @param date 基準日
 * @returns 月初日
 */
export function getMonthStart(date: Date = new Date()): string {
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  return monthStart.toISOString().split('T')[0];
}

/**
 * 月末日を取得
 * @param date 基準日
 * @returns 月末日
 */
export function getMonthEnd(date: Date = new Date()): string {
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return monthEnd.toISOString().split('T')[0];
}

/**
 * 今日の日付をISO形式で取得
 * @returns ISO形式の日付文字列
 */
export function getToday(): string {
  return new Date().toISOString().split('T')[0];
}
