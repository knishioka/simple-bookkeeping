'use client';

import { useRef, useState } from 'react';
import { toast } from 'react-hot-toast';

import { apiClient } from '@/lib/api-client';

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
  handleImport: () => Promise<void>;
  handleCancel: () => void;
  resetFile: () => void;
}

export function useFileImport({
  endpoint,
  maxSize = 5 * 1024 * 1024, // 5MB default
  allowedTypes = ['.csv', 'text/csv', 'application/vnd.ms-excel'],
  onSuccess,
  successMessage = 'インポートが完了しました',
  errorMessage = 'インポートに失敗しました',
}: UseFileImportOptions): UseFileImportReturn {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const selectedFile = event.target.files[0];

      // Validate file before setting
      const validation = apiClient.validateFile(selectedFile, {
        maxSize,
        allowedTypes,
      });

      if (!validation.valid && validation.error) {
        toast.error(validation.error);
        event.target.value = ''; // Reset input
        return;
      }

      setFile(selectedFile);
      setUploadProgress(0);
    }
  };

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
    } catch (error) {
      console.error('Failed to import:', error);
      toast.error(errorMessage);
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
    handleImport,
    handleCancel,
    resetFile,
  };
}
