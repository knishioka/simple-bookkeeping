import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';

interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

interface UseApiCallOptions {
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: (data: any) => void;
  onError?: (error: ApiError) => void;
}

/**
 * API呼び出しの共通フック
 * ローディング状態とエラーハンドリングを管理
 */
export function useApiCall<T = any>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [data, setData] = useState<T | null>(null);

  const execute = useCallback(async (
    apiCall: () => Promise<any>,
    options: UseApiCallOptions = {}
  ) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiCall();
      const responseData = response.data?.data || response.data;
      
      setData(responseData);
      
      if (options.successMessage) {
        toast.success(options.successMessage);
      }
      
      if (options.onSuccess) {
        options.onSuccess(responseData);
      }
      
      return responseData;
    } catch (err: any) {
      let apiError: ApiError = {
        message: options.errorMessage || 'エラーが発生しました',
      };

      if (err?.data?.error) {
        apiError = err.data.error;
      } else if (err?.data?.message) {
        apiError.message = err.data.message;
      } else if (err?.message) {
        apiError.message = err.message;
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
  }, []);

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