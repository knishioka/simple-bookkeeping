import {
  getFiscalYear,
  getFiscalPeriodRange,
  isWithinFiscalYear,
  formatFiscalYear,
  validateFiscalYearStart,
} from '@/lib/fiscal-period';

describe('fiscal-period', () => {
  describe('getFiscalYear', () => {
    it('should return correct fiscal year for April start', () => {
      // 2024年3月31日 → 2023年度
      expect(getFiscalYear(new Date(2024, 2, 31), 4, 1)).toBe(2023);

      // 2024年4月1日 → 2024年度
      expect(getFiscalYear(new Date(2024, 3, 1), 4, 1)).toBe(2024);

      // 2024年12月31日 → 2024年度
      expect(getFiscalYear(new Date(2024, 11, 31), 4, 1)).toBe(2024);

      // 2025年3月31日 → 2024年度
      expect(getFiscalYear(new Date(2025, 2, 31), 4, 1)).toBe(2024);
    });

    it('should return correct fiscal year for January start', () => {
      // 2023年12月31日 → 2023年度
      expect(getFiscalYear(new Date(2023, 11, 31), 1, 1)).toBe(2023);

      // 2024年1月1日 → 2024年度
      expect(getFiscalYear(new Date(2024, 0, 1), 1, 1)).toBe(2024);

      // 2024年12月31日 → 2024年度
      expect(getFiscalYear(new Date(2024, 11, 31), 1, 1)).toBe(2024);
    });
  });

  describe('getFiscalPeriodRange', () => {
    it('should return correct period range for April start', () => {
      const range = getFiscalPeriodRange(2024, 4, 1);

      expect(range.start.getFullYear()).toBe(2024);
      expect(range.start.getMonth()).toBe(3); // April (0-indexed)
      expect(range.start.getDate()).toBe(1);

      expect(range.end.getFullYear()).toBe(2025);
      expect(range.end.getMonth()).toBe(2); // March (0-indexed)
      expect(range.end.getDate()).toBe(31);
    });

    it('should return correct period range for January start', () => {
      const range = getFiscalPeriodRange(2024, 1, 1);

      expect(range.start.getFullYear()).toBe(2024);
      expect(range.start.getMonth()).toBe(0); // January (0-indexed)
      expect(range.start.getDate()).toBe(1);

      expect(range.end.getFullYear()).toBe(2024);
      expect(range.end.getMonth()).toBe(11); // December (0-indexed)
      expect(range.end.getDate()).toBe(31);
    });
  });

  describe('isWithinFiscalYear', () => {
    it('should correctly identify dates within fiscal year', () => {
      // 2024年度（2024/4/1〜2025/3/31）
      expect(isWithinFiscalYear(new Date(2024, 3, 1), 2024, 4, 1)).toBe(true); // 開始日
      expect(isWithinFiscalYear(new Date(2024, 6, 15), 2024, 4, 1)).toBe(true); // 中間
      expect(isWithinFiscalYear(new Date(2025, 2, 31), 2024, 4, 1)).toBe(true); // 終了日

      expect(isWithinFiscalYear(new Date(2024, 2, 31), 2024, 4, 1)).toBe(false); // 前日
      expect(isWithinFiscalYear(new Date(2025, 3, 1), 2024, 4, 1)).toBe(false); // 翌日
    });
  });

  describe('formatFiscalYear', () => {
    it('should format fiscal year correctly', () => {
      const formatted = formatFiscalYear(2024, 4, 1);
      expect(formatted).toBe('2024年度 (2024/04/01〜2025/03/31)');
    });

    it('should handle different start dates', () => {
      const formatted = formatFiscalYear(2024, 1, 1);
      expect(formatted).toBe('2024年度 (2024/01/01〜2024/12/31)');
    });
  });

  describe('validateFiscalYearStart', () => {
    it('should validate valid dates', () => {
      expect(validateFiscalYearStart(4, 1)).toEqual({ isValid: true });
      expect(validateFiscalYearStart(1, 1)).toEqual({ isValid: true });
      expect(validateFiscalYearStart(12, 31)).toEqual({ isValid: true });
    });

    it('should reject invalid months', () => {
      expect(validateFiscalYearStart(0, 1)).toEqual({
        isValid: false,
        error: '月は1〜12の範囲で入力してください',
      });
      expect(validateFiscalYearStart(13, 1)).toEqual({
        isValid: false,
        error: '月は1〜12の範囲で入力してください',
      });
    });

    it('should reject invalid days', () => {
      expect(validateFiscalYearStart(4, 0)).toEqual({
        isValid: false,
        error: '日は1〜31の範囲で入力してください',
      });
      expect(validateFiscalYearStart(4, 32)).toEqual({
        isValid: false,
        error: '日は1〜31の範囲で入力してください',
      });
    });

    it('should validate days according to month', () => {
      expect(validateFiscalYearStart(2, 30)).toEqual({
        isValid: false,
        error: '2月は29日までです',
      });
      expect(validateFiscalYearStart(4, 31)).toEqual({
        isValid: false,
        error: '4月は30日までです',
      });
    });

    it('should handle February 29th specially', () => {
      expect(validateFiscalYearStart(2, 29)).toEqual({
        isValid: true,
        error: 'うるう年でない場合は2月28日になります（システムで自動調整）',
      });
    });
  });
});
