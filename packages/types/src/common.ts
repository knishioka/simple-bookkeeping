/**
 * Common type definitions
 */

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: ApiError;
  meta?: any;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface MoneyAmount {
  amount: number;
  currency?: string;
}
