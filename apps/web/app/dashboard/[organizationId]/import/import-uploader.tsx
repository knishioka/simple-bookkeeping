'use client';

import type { CsvTemplate } from '@/types/csv-import';

import { AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { uploadCsvFile } from '@/app/actions/csv-import';
import { FileUploader } from '@/components/csv-import/file-uploader';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ImportUploaderProps {
  organizationId: string;
  templates: CsvTemplate[];
}

export default function ImportUploader({ organizationId, templates }: ImportUploaderProps) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (file: File, templateId?: string) => {
    setIsUploading(true);
    setError(null);

    try {
      // Convert file to buffer
      const buffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);

      // Upload file and create import history
      const result = await uploadCsvFile(
        organizationId,
        Buffer.from(uint8Array),
        file.name,
        file.size,
        templateId
      );

      if (result.success) {
        // Redirect to preview page
        router.push(`/dashboard/${organizationId}/import/${result.data.id}/preview`);
      } else {
        setError(result.error.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <FileUploader templates={templates} onUpload={handleUpload} isUploading={isUploading} />

      <div className="flex justify-between items-center pt-4">
        <Link
          href={`/dashboard/${organizationId}/import/history`}
          className="text-blue-600 hover:text-blue-700 underline"
        >
          View Import History
        </Link>
        <Link
          href={`/dashboard/${organizationId}/import/rules`}
          className="text-blue-600 hover:text-blue-700 underline"
        >
          Manage Import Rules
        </Link>
      </div>
    </div>
  );
}
