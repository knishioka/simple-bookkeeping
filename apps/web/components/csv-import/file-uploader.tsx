'use client';

import type { CsvTemplate } from '@/types/csv-import';

import { Upload, FileText, X, AlertCircle } from 'lucide-react';
import { useState, useCallback } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FileUploaderProps {
  templates: CsvTemplate[];
  onUpload: (file: File, templateId?: string) => Promise<void>;
  isUploading?: boolean;
}

export function FileUploader({ templates, onUpload, isUploading = false }: FileUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('auto');
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
    setError(null);

    if (rejectedFiles.length > 0) {
      const errors = rejectedFiles[0].errors.map((e) => e.message).join(', ');
      setError(errors);
      return;
    }

    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];

      // Additional validation
      if (file.size > 10 * 1024 * 1024) {
        setError('File size exceeds 10MB limit');
        return;
      }

      setSelectedFile(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/csv': ['.csv'],
      'text/plain': ['.csv'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled: isUploading,
  });

  const handleUpload = async () => {
    if (!selectedFile) return;

    setError(null);
    try {
      const templateId = selectedTemplate === 'auto' ? undefined : selectedTemplate;
      await onUpload(selectedFile, templateId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setError(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>CSV File Upload</CardTitle>
        <CardDescription>Upload bank or credit card statements in CSV format</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Template Selection */}
        <div>
          <label htmlFor="template" className="block text-sm font-medium mb-2">
            CSV Format
          </label>
          <Select
            value={selectedTemplate}
            onValueChange={setSelectedTemplate}
            disabled={isUploading}
          >
            <SelectTrigger id="template">
              <SelectValue placeholder="Select CSV format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto-detect</SelectItem>
              {templates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.bank_name} - {template.template_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* File Dropzone */}
        {!selectedFile ? (
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
              transition-colors duration-200
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-gray-400'}
              ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            {isDragActive ? (
              <p className="text-lg font-medium">Drop the CSV file here...</p>
            ) : (
              <>
                <p className="text-lg font-medium mb-2">
                  Drag & drop a CSV file here, or click to select
                </p>
                <p className="text-sm text-gray-500">Maximum file size: 10MB</p>
              </>
            )}
          </div>
        ) : (
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FileText className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500">
                    {(selectedFile.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleRemoveFile} disabled={isUploading}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Upload Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className="min-w-[120px]"
          >
            {isUploading ? 'Uploading...' : 'Upload CSV'}
          </Button>
        </div>

        {/* Supported Banks */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-medium mb-2">Supported Banks & Formats:</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-gray-600">
            <div>• 楽天銀行</div>
            <div>• 三菱UFJ銀行</div>
            <div>• みずほ銀行</div>
            <div>• 三井住友銀行</div>
            <div>• ゆうちょ銀行</div>
            <div>• 住信SBIネット銀行</div>
            <div>• 楽天カード</div>
            <div>• 三井住友カード</div>
            <div>• Generic CSV</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
