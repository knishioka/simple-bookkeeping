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
// import { apiClient } from '@/lib/api-client';

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
      // TODO: Implement file upload using fetch API directly
      const token = localStorage.getItem('token');
      const orgId = localStorage.getItem('selectedOrganizationId');

      const response = await fetch('http://localhost:3001/api/v1/journal-entries/import', {
        method: 'POST',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          'X-Organization-Id': orgId || '',
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || 'インポートが完了しました');
        onSuccess();
        onOpenChange(false);
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Failed to import journal entries:', error);
      const errorMessage =
        error instanceof Error && 'response' in error
          ? (error as { response?: { data?: { error?: { message?: string } } } }).response?.data
              ?.error?.message || 'インポートに失敗しました'
          : 'インポートに失敗しました';
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
