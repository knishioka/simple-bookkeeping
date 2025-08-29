'use client';

import { Upload, X, FileText, Image as ImageIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useSupabaseStorage } from '@/hooks/use-supabase-storage';
import { StorageService } from '@/lib/supabase/storage';
import { cn } from '@/lib/utils';

interface ReceiptUploadProps {
  journalEntryId?: string;
  onUploadComplete?: (files: Array<{ path: string; url: string }>) => void;
  className?: string;
}

interface PreviewFile {
  file: File;
  preview: string;
  thumbnail?: string;
}

export function ReceiptUpload({
  journalEntryId: _journalEntryId,
  onUploadComplete,
  className,
}: ReceiptUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [previewFiles, setPreviewFiles] = useState<PreviewFile[]>([]);

  const { uploadMultipleFiles, uploadProgress, uploadedFiles, isUploading } = useSupabaseStorage({
    bucketName: 'receipts',
    onSuccess: (result) => {
      console.warn('Upload success:', result);
    },
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    await handleFiles(files);
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    await handleFiles(files);
  };

  const handleFiles = async (files: File[]) => {
    // プレビュー生成
    const previews = await Promise.all(
      files.map(async (file) => {
        const preview = URL.createObjectURL(file);
        let thumbnail: string | undefined;

        // 画像の場合はサムネイル生成
        if (file.type.startsWith('image/')) {
          try {
            const thumbnailBlob = await StorageService.generateThumbnail(file);
            thumbnail = URL.createObjectURL(thumbnailBlob);
          } catch (error) {
            console.error('Thumbnail generation failed:', error);
          }
        }

        return {
          file,
          preview,
          thumbnail,
        };
      })
    );

    setPreviewFiles((prev) => [...prev, ...previews]);
  };

  const handleUpload = async () => {
    if (previewFiles.length === 0) return;

    const files = previewFiles.map((pf) => pf.file);
    const results = await uploadMultipleFiles(files);

    // プレビューをクリア
    previewFiles.forEach((pf) => {
      URL.revokeObjectURL(pf.preview);
      if (pf.thumbnail) URL.revokeObjectURL(pf.thumbnail);
    });
    setPreviewFiles([]);

    onUploadComplete?.(results);
  };

  const removePreview = (index: number) => {
    setPreviewFiles((prev) => {
      const newPreviews = [...prev];
      const removed = newPreviews.splice(index, 1)[0];
      URL.revokeObjectURL(removed.preview);
      if (removed.thumbnail) URL.revokeObjectURL(removed.thumbnail);
      return newPreviews;
    });
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>領収書アップロード</CardTitle>
        <CardDescription>
          領収書や請求書などの画像またはPDFファイルをアップロードできます
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* ドラッグ&ドロップエリア */}
        <div
          className={cn(
            'relative rounded-lg border-2 border-dashed p-8 text-center transition-colors',
            dragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50',
            isUploading && 'pointer-events-none opacity-50'
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            id="receipt-upload"
            className="hidden"
            multiple
            accept="image/*,application/pdf"
            onChange={handleFileInput}
            disabled={isUploading}
          />

          <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">
            ファイルをドラッグ&ドロップするか、
            <label htmlFor="receipt-upload" className="cursor-pointer text-primary hover:underline">
              クリックして選択
            </label>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            対応形式: JPG, PNG, GIF, PDF（最大10MB）
          </p>
        </div>

        {/* アップロード進捗 */}
        {isUploading && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm">
              <span>アップロード中...</span>
              <span>{uploadProgress.progress}%</span>
            </div>
            <Progress value={uploadProgress.progress} className="mt-2" />
          </div>
        )}

        {/* プレビュー */}
        {previewFiles.length > 0 && (
          <div className="mt-6">
            <h4 className="mb-3 text-sm font-medium">アップロード予定のファイル</h4>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {previewFiles.map((pf, index) => (
                <div
                  key={index}
                  className="group relative overflow-hidden rounded-lg border bg-muted/50"
                >
                  {pf.file.type.startsWith('image/') ? (
                    <img
                      src={pf.thumbnail || pf.preview}
                      alt={pf.file.name}
                      className="h-32 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-32 items-center justify-center">
                      <FileText className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  <div className="p-2">
                    <p className="truncate text-xs" title={pf.file.name}>
                      {pf.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(pf.file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    onClick={() => removePreview(index)}
                    className="absolute right-1 top-1 rounded-full bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <Button onClick={handleUpload} disabled={isUploading} className="mt-4 w-full">
              {isUploading
                ? 'アップロード中...'
                : `${previewFiles.length}件のファイルをアップロード`}
            </Button>
          </div>
        )}

        {/* アップロード済みファイル */}
        {uploadedFiles.length > 0 && (
          <div className="mt-6">
            <h4 className="mb-3 text-sm font-medium">アップロード済みファイル</h4>
            <div className="space-y-2">
              {uploadedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{file.path.split('/').pop()}</p>
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        ファイルを表示
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
