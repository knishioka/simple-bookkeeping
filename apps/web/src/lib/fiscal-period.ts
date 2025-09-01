import { format, startOfDay, endOfDay, isBefore, isAfter, isSameDay } from 'date-fns';

/**
 * 指定された日付が属する会計年度を取得
 * @param date 基準日
 * @param startMonth 会計年度開始月 (1-12)
 * @param startDay 会計年度開始日 (1-31)
 * @returns 会計年度 (例: 2024)
 */
export function getFiscalYear(date: Date, startMonth: number, startDay: number): number {
  const year = date.getFullYear();
  const fiscalYearStart = new Date(year, startMonth - 1, startDay);

  // 基準日が会計年度開始日以前の場合は前年度
  if (isBefore(date, fiscalYearStart)) {
    return year - 1;
  }

  return year;
}

/**
 * 指定された会計年度の期間範囲を取得
 * @param fiscalYear 会計年度
 * @param startMonth 会計年度開始月 (1-12)
 * @param startDay 会計年度開始日 (1-31)
 * @returns { start: Date, end: Date }
 */
export function getFiscalPeriodRange(
  fiscalYear: number,
  startMonth: number,
  startDay: number
): { start: Date; end: Date } {
  const start = startOfDay(new Date(fiscalYear, startMonth - 1, startDay));

  // 次年度の開始日の前日が終了日
  const nextYearStart = new Date(fiscalYear + 1, startMonth - 1, startDay);
  const end = endOfDay(new Date(nextYearStart.getTime() - 24 * 60 * 60 * 1000));

  return { start, end };
}

/**
 * 指定された日付が指定された会計年度内かどうかを判定
 * @param date 基準日
 * @param fiscalYear 会計年度
 * @param startMonth 会計年度開始月 (1-12)
 * @param startDay 会計年度開始日 (1-31)
 * @returns boolean
 */
export function isWithinFiscalYear(
  date: Date,
  fiscalYear: number,
  startMonth: number,
  startDay: number
): boolean {
  const { start, end } = getFiscalPeriodRange(fiscalYear, startMonth, startDay);
  return (
    (isAfter(date, start) || isSameDay(date, start)) &&
    (isBefore(date, end) || isSameDay(date, end))
  );
}

/**
 * 会計年度を文字列で表現
 * @param fiscalYear 会計年度
 * @param startMonth 会計年度開始月 (1-12)
 * @param startDay 会計年度開始日 (1-31)
 * @returns 表示用文字列 (例: "2024年度 (2024/04/01〜2025/03/31)")
 */
export function formatFiscalYear(fiscalYear: number, startMonth: number, startDay: number): string {
  const { start, end } = getFiscalPeriodRange(fiscalYear, startMonth, startDay);
  const startStr = format(start, 'yyyy/MM/dd');
  const endStr = format(end, 'yyyy/MM/dd');
  return `${fiscalYear}年度 (${startStr}〜${endStr})`;
}

/**
 * 現在の会計年度を取得
 * @param startMonth 会計年度開始月 (1-12)
 * @param startDay 会計年度開始日 (1-31)
 * @returns 現在の会計年度
 */
export function getCurrentFiscalYear(startMonth: number, startDay: number): number {
  return getFiscalYear(new Date(), startMonth, startDay);
}

/**
 * 会計年度開始日のバリデーション
 * @param month 月 (1-12)
 * @param day 日 (1-31)
 * @returns { isValid: boolean, error?: string }
 */
export function validateFiscalYearStart(
  month: number,
  day: number
): { isValid: boolean; error?: string } {
  if (month < 1 || month > 12) {
    return { isValid: false, error: '月は1〜12の範囲で入力してください' };
  }

  if (day < 1 || day > 31) {
    return { isValid: false, error: '日は1〜31の範囲で入力してください' };
  }

  // 月末日のチェック
  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day > daysInMonth[month - 1]) {
    return { isValid: false, error: `${month}月は${daysInMonth[month - 1]}日までです` };
  }

  // 2月29日の特別チェック（うるう年でない場合）
  if (month === 2 && day === 29) {
    return {
      isValid: true,
      error: 'うるう年でない場合は2月28日になります（システムで自動調整）',
    };
  }

  return { isValid: true };
}
