'use client';

import { Upload } from 'lucide-react';
import { useState } from 'react';
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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error('ファイルを選択してください');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await apiClient.post('/journal-entries/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      if (response.data) {
        toast.success(response.data.message);
        onSuccess();
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error('Failed to import journal entries:', error);
      const errorMessage = error.response?.data?.error?.message || 'インポートに失敗しました';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
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
          <Input type="file" accept=".csv" onChange={handleFileChange} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            キャンセル
          </Button>
          <Button onClick={handleImport} disabled={loading}>
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
