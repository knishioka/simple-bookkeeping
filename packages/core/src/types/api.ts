/**
 * API関連の共通型定義
 */

// APIレスポンスの基本形
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: ApiErrorResponse;
  meta?: ApiMeta;
}

// APIエラーレスポンス
export interface ApiErrorResponse {
  code: string;
  message: string;
  details?: unknown;
  field?: string;
}

// APIメタ情報（ページネーションなど）
export interface ApiMeta {
  page?: number;
  perPage?: number;
  total?: number;
  totalPages?: number;
}

// ページネーションパラメータ
export interface PaginationParams {
  page?: number;
  perPage?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

// バリデーションエラー
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

// APIリクエストの共通ヘッダー
export interface ApiHeaders {
  'Content-Type'?: string;
  Authorization?: string;
  'X-Organization-Id'?: string;
}

// リスト取得レスポンス
export interface ListResponse<T> {
  items: T[];
  meta: ApiMeta;
}
