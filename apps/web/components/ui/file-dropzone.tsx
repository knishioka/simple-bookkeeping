'use client';

import { CloudUpload } from 'lucide-react';
import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

import { cn } from '@/lib/utils';

interface FileDropzoneProps {
  onDrop: (files: File[]) => void;
  accept?: Record<string, string[]>;
  maxSize?: number;
  disabled?: boolean;
  file?: File | null;
  className?: string;
}

export function FileDropzone({
  onDrop,
  accept = {
    'text/csv': ['.csv'],
    'application/vnd.ms-excel': ['.csv'],
  },
  maxSize = 5 * 1024 * 1024, // 5MB
  disabled = false,
  file,
  className,
}: FileDropzoneProps) {
  const handleDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onDrop(acceptedFiles);
      }
    },
    [onDrop]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop: handleDrop,
    accept,
    maxSize,
    disabled,
    multiple: false,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        'relative rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors',
        isDragActive && !isDragReject && 'border-primary bg-primary/5',
        isDragReject && 'border-destructive bg-destructive/5',
        disabled && 'opacity-50 cursor-not-allowed',
        !isDragActive && !isDragReject && 'border-muted-foreground/25 hover:border-primary/50',
        className
      )}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center justify-center gap-2">
        <CloudUpload
          className={cn(
            'h-8 w-8',
            isDragActive && !isDragReject && 'text-primary',
            isDragReject && 'text-destructive',
            !isDragActive && !isDragReject && 'text-muted-foreground'
          )}
        />
        {isDragActive && !isDragReject && (
          <p className="text-sm text-primary">ファイルをドロップしてください</p>
        )}
        {isDragReject && <p className="text-sm text-destructive">このファイルは対応していません</p>}
        {!isDragActive && (
          <>
            <p className="text-sm text-muted-foreground">
              ファイルをドラッグ&ドロップするか、クリックして選択
            </p>
            <p className="text-xs text-muted-foreground">CSV形式のファイル（最大5MB）</p>
            {file && (
              <p className="mt-2 text-sm font-medium">
                選択中: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
