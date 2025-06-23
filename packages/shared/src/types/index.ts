// Common types used across the application
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    total?: number;
    limit?: number;
  };
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface DateRange {
  from: Date;
  to: Date;
}

// Note: Prisma types should be imported directly from @simple-bookkeeping/database
// to avoid circular dependencies and build issues
