/**
 * @deprecated This hook uses the old API client. Use `useServerFileImport` instead for Server Actions.
 * Migration guide:
 * - Replace `useFileImport` with `useServerFileImport`
 * - Replace `endpoint` parameter with `importAction` (Server Action function)
 * - Replace `organizationId` with automatic server-side retrieval
 *
 * Example:
 * ```tsx
 * // Old
 * const { ... } = useFileImport({
 *   endpoint: '/accounts/import',
 *   onSuccess: () => { ... }
 * });
 *
 * // New
 * const { ... } = useServerFileImport({
 *   importAction: importAccountsFromCSVWithAuth,
 *   onSuccess: () => { ... }
 * });
 * ```
 */
'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';

// TODO: Migrate to Server Actions - Issue #355
// import { apiClient } from '@/lib/api-client';

interface UseFileImportOptions {
  endpoint: string;
  maxSize?: number;
  allowedTypes?: string[];
  onSuccess?: () => void;
  successMessage?: string;
  errorMessage?: string;
}

interface UseFileImportReturn {
  file: File | null;
  loading: boolean;
  uploadProgress: number;
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleDrop: (files: File[]) => void;
  handleImport: () => Promise<void>;
  handleCancel: () => void;
  resetFile: () => void;
}

export function useFileImport({
  endpoint: _endpoint,
  maxSize: _maxSize = 5 * 1024 * 1024, // 5MB default
  allowedTypes: _allowedTypes = ['.csv', 'text/csv', 'application/vnd.ms-excel'],
  onSuccess: _onSuccess,
  successMessage: _successMessage = 'インポートが完了しました',
  errorMessage: _errorMessage = 'インポートに失敗しました',
}: UseFileImportOptions): UseFileImportReturn {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const validateAndSetFile = useCallback(
    (selectedFile: File) => {
      // TODO: Migrate to Server Actions - Issue #355
      // Validation temporarily disabled during migration
      /*
      const validation = apiClient.validateFile(selectedFile, {
        maxSize,
        allowedTypes,
      });

      if (!validation.valid && validation.error) {
        toast.error(validation.error);
        return false;
      }
      */

      setFile(selectedFile);
      setUploadProgress(0);
      return true;
    },
    [] // Dependencies removed during migration
  );

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const selectedFile = event.target.files[0];
      const isValid = validateAndSetFile(selectedFile);
      if (!isValid && event.target) {
        event.target.value = ''; // Reset input
      }
    }
  };

  const handleDrop = useCallback(
    (files: File[]) => {
      if (files.length > 0) {
        validateAndSetFile(files[0]);
      }
    },
    [validateAndSetFile]
  );

  const handleImport = async () => {
    if (!file) {
      toast.error('ファイルを選択してください');
      return;
    }

    setLoading(true);
    setUploadProgress(0);

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      // TODO: Migrate to Server Actions - Issue #355
      // Upload functionality temporarily disabled during migration
      toast.error('ファイルアップロード機能は現在メンテナンス中です');

      /*
      const response = await apiClient.upload<{
        success: boolean;
        message?: string;
        imported?: number;
        errors?: string[];
      }>(endpoint, file, {
        onProgress: setUploadProgress,
        signal: abortControllerRef.current.signal,
      });

      if (response.data) {
        toast.success(response.data.message || successMessage);
        if (onSuccess) {
          onSuccess();
        }
        resetFile();
      } else if (response.error) {
        // Error is already handled by apiClient with toast
        console.error('Import error:', response.error);
      }
      */
    } catch (error) {
      console.error('Failed to import:', error);
      toast.error(_errorMessage);
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    // Abort upload if in progress
    if (abortControllerRef.current && loading) {
      abortControllerRef.current.abort();
      setLoading(false);
      setUploadProgress(0);
      toast.success('アップロードをキャンセルしました');
    }
    resetFile();
  };

  const resetFile = () => {
    setFile(null);
    setUploadProgress(0);
  };

  return {
    file,
    loading,
    uploadProgress,
    handleFileChange,
    handleDrop,
    handleImport,
    handleCancel,
    resetFile,
  };
}
