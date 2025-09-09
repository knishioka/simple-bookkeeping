'use client';

import { useCallback, useState, useTransition } from 'react';
import { toast } from 'react-hot-toast';

import type { ActionResult } from '@/app/actions/types';

interface UseServerFileImportOptions {
  importAction: (
    formData: FormData
  ) => Promise<ActionResult<{ imported: number; errors: Array<{ row: number; error: string }> }>>;
  extraFields?: Record<string, string>;
  maxSize?: number;
  allowedTypes?: string[];
  onSuccess?: (imported: number) => void;
  errorMessage?: string;
}

interface UseServerFileImportReturn {
  file: File | null;
  loading: boolean;
  uploadProgress: number;
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleDrop: (files: File[]) => void;
  handleImport: () => Promise<void>;
  handleCancel: () => void;
  resetFile: () => void;
}

export function useServerFileImport({
  importAction,
  extraFields = {},
  maxSize = 5 * 1024 * 1024, // 5MB default
  allowedTypes = ['.csv', 'text/csv', 'application/vnd.ms-excel'],
  onSuccess,
  errorMessage = 'インポートに失敗しました',
}: UseServerFileImportOptions): UseServerFileImportReturn {
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isPending, startTransition] = useTransition();

  const validateFile = useCallback(
    (selectedFile: File): boolean => {
      // ファイルタイプのチェック
      const fileExtension = `.${selectedFile.name.split('.').pop()?.toLowerCase()}`;
      const isValidType =
        allowedTypes.includes(fileExtension) || allowedTypes.includes(selectedFile.type);

      if (!isValidType) {
        toast.error('CSVファイルのみアップロード可能です');
        return false;
      }

      // ファイルサイズのチェック
      if (selectedFile.size > maxSize) {
        toast.error(`ファイルサイズは${Math.round(maxSize / 1024 / 1024)}MB以下にしてください`);
        return false;
      }

      return true;
    },
    [maxSize, allowedTypes]
  );

  const validateAndSetFile = useCallback(
    (selectedFile: File) => {
      if (!validateFile(selectedFile)) {
        return false;
      }

      setFile(selectedFile);
      setUploadProgress(0);
      return true;
    },
    [validateFile]
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

    // FormDataの作成
    const formData = new FormData();
    formData.append('file', file);

    // 追加フィールドを設定
    Object.entries(extraFields).forEach(([key, value]) => {
      formData.append(key, value);
    });

    // プログレスのシミュレーション（実際のアップロード進捗はServer Actionでは取得できない）
    setUploadProgress(20);
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    startTransition(async () => {
      try {
        const result = await importAction(formData);

        clearInterval(progressInterval);
        setUploadProgress(100);

        if (result.success && result.data) {
          const { imported, errors } = result.data;

          // 成功メッセージ
          if (imported > 0) {
            toast.success(`${imported}件のデータをインポートしました`);
            if (onSuccess) {
              onSuccess(imported);
            }
          }

          // エラーメッセージ
          if (errors && errors.length > 0) {
            const errorSummary = errors
              .slice(0, 3)
              .map((e) => `行${e.row}: ${e.error}`)
              .join('\n');
            const moreErrors = errors.length > 3 ? `\n他${errors.length - 3}件のエラー` : '';
            toast.error(`インポートエラー:\n${errorSummary}${moreErrors}`, {
              duration: 5000,
            });
          }

          if (imported > 0 && errors.length === 0) {
            resetFile();
          }
        } else if (result.error) {
          toast.error(result.error.message || errorMessage);
        }
      } catch (error) {
        console.error('Failed to import:', error);
        toast.error(errorMessage);
      } finally {
        clearInterval(progressInterval);
        setUploadProgress(0);
      }
    });
  };

  const handleCancel = () => {
    // Server Actionはキャンセルできないため、UIのリセットのみ
    if (isPending) {
      toast.error('インポート処理中はキャンセルできません');
      return;
    }
    resetFile();
  };

  const resetFile = () => {
    setFile(null);
    setUploadProgress(0);
  };

  return {
    file,
    loading: isPending,
    uploadProgress,
    handleFileChange,
    handleDrop,
    handleImport,
    handleCancel,
    resetFile,
  };
}
