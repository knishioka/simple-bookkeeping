import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';

interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

interface UseApiCallOptions<T> {
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: (data: T) => void;
  onError?: (error: ApiError) => void;
}

/**
 * API呼び出しの共通フック
 * ローディング状態とエラーハンドリングを管理
 */
export function useApiCall<T = unknown>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [data, setData] = useState<T | null>(null);

  const execute = useCallback(
    async (
      apiCall: () => Promise<{ data?: { data?: T } | T }>,
      options: UseApiCallOptions<T> = {}
    ) => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiCall();
        let responseData: T | null = null;

        if ('data' in response && response.data) {
          if (typeof response.data === 'object' && 'data' in response.data) {
            responseData = (response.data as { data: T }).data;
          } else {
            responseData = response.data as T;
          }
        }

        setData(responseData);

        if (options.successMessage) {
          toast.success(options.successMessage);
        }

        if (options.onSuccess && responseData !== null) {
          options.onSuccess(responseData);
        }

        return responseData;
      } catch (err) {
        let apiError: ApiError = {
          message: options.errorMessage || 'エラーが発生しました',
        };

        const error = err as { data?: { error?: ApiError; message?: string }; message?: string };

        if (error?.data?.error) {
          apiError = error.data.error;
        } else if (error?.data?.message) {
          apiError.message = error.data.message;
        } else if (error?.message) {
          apiError.message = error.message;
        }

        setError(apiError);
        toast.error(apiError.message);

        if (options.onError) {
          options.onError(apiError);
        }

        throw apiError;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    loading,
    error,
    data,
    execute,
    reset,
  };
}
