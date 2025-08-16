'use client';

import { Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { apiClient } from '@/lib/api-client';

interface JournalEntryImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function JournalEntryImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: JournalEntryImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const selectedFile = event.target.files[0];

      // Validate file before setting
      const validation = apiClient.validateFile(selectedFile, {
        maxSize: 5 * 1024 * 1024, // 5MB
        allowedTypes: ['.csv', 'text/csv', 'application/vnd.ms-excel'],
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
      }>('/journal-entries/import', file, {
        onProgress: setUploadProgress,
        signal: abortControllerRef.current.signal,
      });

      if (response.data) {
        toast.success(response.data.message || 'インポートが完了しました');
        onSuccess();
        onOpenChange(false);
        setFile(null);
        setUploadProgress(0);
      } else if (response.error) {
        // Error is already handled by apiClient with toast
        console.error('Import error:', response.error);
      }
    } catch (error) {
      console.error('Failed to import journal entries:', error);
      toast.error('インポートに失敗しました');
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
    } else {
      onOpenChange(false);
    }
    setFile(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>仕訳CSVインポート</DialogTitle>
          <DialogDescription>
            CSVファイルをアップロードして仕訳を一括登録します。ヘッダーは「日付,借方勘定,貸方勘定,金額,摘要」の順である必要があります。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Input
              type="file"
              accept=".csv,text/csv,application/vnd.ms-excel"
              onChange={handleFileChange}
              disabled={loading}
            />
            {file && (
              <div className="text-sm text-muted-foreground">
                選択されたファイル: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </div>
            )}
          </div>
          {loading && uploadProgress > 0 && (
            <div className="space-y-2">
              <Progress value={uploadProgress} className="h-2" />
              <div className="text-sm text-muted-foreground text-center">
                アップロード中... {Math.round(uploadProgress)}%
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant={loading ? 'destructive' : 'outline'} onClick={handleCancel}>
            {loading ? (
              <>
                <X className="mr-2 h-4 w-4" />
                キャンセル
              </>
            ) : (
              'キャンセル'
            )}
          </Button>
          <Button onClick={handleImport} disabled={loading || !file}>
            {loading ? (
              'インポート中...'
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                インポート
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
