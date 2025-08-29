'use client';

import { useState, useCallback, useMemo } from 'react';

import { useToast } from '@/hooks/use-toast';
import { StorageService } from '@/lib/supabase/storage';

interface UseSupabaseStorageOptions {
  bucketName: 'receipts' | 'reports' | 'attachments';
  onSuccess?: (result: { path: string; url: string }) => void;
  onError?: (error: Error) => void;
}

interface UploadProgress {
  isUploading: boolean;
  progress: number;
  error: Error | null;
}

/**
 * Supabase Storageを使用するためのカスタムフック
 */
export function useSupabaseStorage({ bucketName, onSuccess, onError }: UseSupabaseStorageOptions): {
  uploadFile: (file: File, customPath?: string) => Promise<{ path: string; url: string }>;
  uploadMultipleFiles: (files: File[]) => Promise<Array<{ path: string; url: string }>>;
  deleteFile: (path: string) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listFiles: (folder: string) => Promise<any[]>;
  createSignedUrl: (path: string, expiresIn?: number) => Promise<string>;
  uploadProgress: UploadProgress;
  uploadedFiles: Array<{ path: string; url: string }>;
  isUploading: boolean;
} {
  const { toast } = useToast();
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    isUploading: false,
    progress: 0,
    error: null,
  });
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ path: string; url: string }>>([]);

  const storage = useMemo(() => new StorageService(bucketName), [bucketName]);

  /**
   * ファイルアップロード
   */
  const uploadFile = useCallback(
    async (file: File, customPath?: string) => {
      setUploadProgress({
        isUploading: true,
        progress: 0,
        error: null,
      });

      try {
        // プログレスバーのシミュレーション（実際のプログレスはSupabase SDKではサポートされていない）
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => ({
            ...prev,
            progress: Math.min(prev.progress + 10, 90),
          }));
        }, 100);

        const result = await storage.upload(file, customPath);

        clearInterval(progressInterval);
        setUploadProgress({
          isUploading: false,
          progress: 100,
          error: null,
        });

        setUploadedFiles((prev) => [...prev, result]);

        toast({
          title: 'アップロード成功',
          description: `${file.name}をアップロードしました`,
        });

        onSuccess?.(result);
        return result;
      } catch (error) {
        const err = error as Error;
        setUploadProgress({
          isUploading: false,
          progress: 0,
          error: err,
        });

        toast({
          title: 'アップロードエラー',
          description: err.message,
          variant: 'destructive',
        });

        onError?.(err);
        throw err;
      }
    },
    [storage, toast, onSuccess, onError]
  );

  /**
   * 複数ファイルのアップロード
   */
  const uploadMultipleFiles = useCallback(
    async (files: File[]) => {
      const results = [];
      for (const file of files) {
        try {
          const result = await uploadFile(file);
          results.push(result);
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);
        }
      }
      return results;
    },
    [uploadFile]
  );

  /**
   * ファイル削除
   */
  const deleteFile = useCallback(
    async (path: string) => {
      try {
        await storage.delete(path);
        setUploadedFiles((prev) => prev.filter((f) => f.path !== path));

        toast({
          title: '削除成功',
          description: 'ファイルを削除しました',
        });
      } catch (error) {
        const err = error as Error;
        toast({
          title: '削除エラー',
          description: err.message,
          variant: 'destructive',
        });
        throw err;
      }
    },
    [storage, toast]
  );

  /**
   * ファイル一覧取得
   */
  const listFiles = useCallback(
    async (folder: string) => {
      try {
        const files = await storage.list(folder);
        return files;
      } catch (error) {
        const err = error as Error;
        toast({
          title: 'ファイル一覧取得エラー',
          description: err.message,
          variant: 'destructive',
        });
        throw err;
      }
    },
    [storage, toast]
  );

  /**
   * 署名付きURL生成
   */
  const createSignedUrl = useCallback(
    async (path: string, expiresIn?: number) => {
      try {
        const url = await storage.createSignedUrl(path, expiresIn);
        return url;
      } catch (error) {
        const err = error as Error;
        toast({
          title: 'URL生成エラー',
          description: err.message,
          variant: 'destructive',
        });
        throw err;
      }
    },
    [storage, toast]
  );

  return {
    uploadFile,
    uploadMultipleFiles,
    deleteFile,
    listFiles,
    createSignedUrl,
    uploadProgress,
    uploadedFiles,
    isUploading: uploadProgress.isUploading,
  };
}
