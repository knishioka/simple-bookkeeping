'use client';

import { Upload, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileDropzone } from '@/components/ui/file-dropzone';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useFileImport } from '@/hooks/use-file-import';

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
  const {
    file,
    loading,
    uploadProgress,
    handleFileChange,
    handleDrop,
    handleImport,
    handleCancel,
  } = useFileImport({
    endpoint: '/journal-entries/import',
    onSuccess: () => {
      onSuccess();
      onOpenChange(false);
    },
    successMessage: '仕訳のインポートが完了しました',
    errorMessage: '仕訳のインポートに失敗しました',
  });

  const handleClose = () => {
    if (loading) {
      handleCancel();
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>仕訳CSVインポート</DialogTitle>
          <DialogDescription>
            CSVファイルをアップロードして仕訳を一括登録します。ヘッダーは「日付,借方勘定,貸方勘定,金額,摘要」の順である必要があります。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <FileDropzone onDrop={handleDrop} disabled={loading} file={file} />
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">または</span>
            </div>
          </div>
          <div className="space-y-2">
            <Input
              type="file"
              accept=".csv,text/csv,application/vnd.ms-excel"
              onChange={handleFileChange}
              disabled={loading}
              className="cursor-pointer"
            />
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
          <Button variant={loading ? 'destructive' : 'outline'} onClick={handleClose}>
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
