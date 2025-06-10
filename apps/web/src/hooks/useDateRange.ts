import { useState } from 'react';

import { getMonthStart, getMonthEnd } from '@/lib/formatters';

interface UseDateRangeOptions {
  defaultToCurrentMonth?: boolean;
  defaultStartDate?: string;
  defaultEndDate?: string;
}

/**
 * 日付範囲選択の共通フック
 */
export function useDateRange(options: UseDateRangeOptions = { defaultToCurrentMonth: true }) {
  const [startDate, setStartDate] = useState(() => {
    if (options.defaultStartDate) return options.defaultStartDate;
    if (options.defaultToCurrentMonth) return getMonthStart();
    return '';
  });

  const [endDate, setEndDate] = useState(() => {
    if (options.defaultEndDate) return options.defaultEndDate;
    if (options.defaultToCurrentMonth) return getMonthEnd();
    return '';
  });

  const resetToCurrentMonth = () => {
    setStartDate(getMonthStart());
    setEndDate(getMonthEnd());
  };

  const setDateRange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
  };

  return {
    startDate,
    endDate,
    setStartDate,
    setEndDate,
    setDateRange,
    resetToCurrentMonth,
  };
}