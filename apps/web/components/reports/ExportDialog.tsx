'use client';

import { Download } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
// TODO: Migrate to Server Actions - Issue #355
// import { apiClient } from '@/lib/api-client';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportType: 'balance-sheet' | 'profit-loss' | 'trial-balance';
  reportParams?: Record<string, string | number | boolean | undefined>;
}

export function ExportDialog({
  open,
  onOpenChange,
  reportType,
  reportParams: _reportParams = {},
}: ExportDialogProps) {
  const [format, setFormat] = useState<'csv' | 'pdf' | 'excel'>('csv');
  const [isExporting, setIsExporting] = useState(false);

  const getReportTypeName = () => {
    switch (reportType) {
      case 'balance-sheet':
        return '貸借対照表';
      case 'profit-loss':
        return '損益計算書';
      case 'trial-balance':
        return '試算表';
      default:
        return 'レポート';
    }
  };

  // Commented out during migration - Issue #355
  // const getFileName = () => {
  //   const date = new Date().toISOString().split('T')[0];
  //   const extension = format === 'excel' ? 'xlsx' : format;
  //   return `${reportType}-${date}.${extension}`;
  // };

  const handleExport = async () => {
    // TODO: Migrate to Server Actions - Issue #355
    // Need to implement export functionality using Server Actions
    toast.error('エクスポート機能は現在メンテナンス中です');
    setIsExporting(false);

    // Original export code commented out:
    /*
    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        format,
        ...reportParams,
      });

      const response = await apiClient.getBlob(`/reports/${reportType}/export?${params}`);

      // Create download link
      const url = window.URL.createObjectURL(response);
      const link = document.createElement('a');
      link.href = url;
      link.download = getFileName();
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`${getReportTypeName()}を${format.toUpperCase()}形式でダウンロードしました`);
      onOpenChange(false);
    } catch (error) {
      console.error('Export error:', error);
      if (format === 'pdf' || format === 'excel') {
        toast.error(`${format.toUpperCase()}形式は現在開発中です。CSV形式をお試しください。`);
      } else {
        toast.error('エクスポートに失敗しました');
      }
    } finally {
      setIsExporting(false);
    }
    */
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>レポートのエクスポート</DialogTitle>
          <DialogDescription>
            {getReportTypeName()}をエクスポートする形式を選択してください。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="format" className="text-right">
              形式
            </Label>
            <Select
              value={format}
              onValueChange={(value) => setFormat(value as 'csv' | 'pdf' | 'excel')}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="pdf" disabled>
                  PDF (開発中)
                </SelectItem>
                <SelectItem value="excel" disabled>
                  Excel (開発中)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm text-muted-foreground">
            {format === 'csv' && (
              <p>
                データをカンマ区切りのテキストファイルとしてエクスポートします。Excel等の表計算ソフトで開くことができます。
              </p>
            )}
            {format === 'pdf' && <p>印刷用に最適化された形式でエクスポートします。</p>}
            {format === 'excel' && (
              <p>Microsoft Excel形式でエクスポートします。数式やフォーマットが適用されます。</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            キャンセル
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>ダウンロード中...</>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                ダウンロード
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
