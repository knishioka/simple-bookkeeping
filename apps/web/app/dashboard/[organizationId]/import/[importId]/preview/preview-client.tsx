'use client';

import type { Database } from '@/lib/supabase/database.types';
import type { CsvPreviewData, AccountMapping } from '@/types/csv-import';

import { AlertCircle, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { executeImport } from '@/app/actions/csv-import';
import { PreviewTable } from '@/components/csv-import/preview-table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

type Account = Database['public']['Tables']['accounts']['Row'];

interface PreviewClientProps {
  organizationId: string;
  importId: string;
  preview: CsvPreviewData;
  initialMappings: AccountMapping[];
  accounts: Account[];
}

export default function PreviewClient({
  organizationId,
  importId,
  preview,
  initialMappings,
  accounts,
}: PreviewClientProps) {
  const router = useRouter();
  const [mappings, setMappings] = useState<AccountMapping[]>(initialMappings);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMappingChange = (rowIndex: number, accountId: string, contraAccountId: string) => {
    setMappings((prev) =>
      prev.map((mapping) =>
        mapping.rowIndex === rowIndex ? { ...mapping, accountId, contraAccountId } : mapping
      )
    );
  };

  const handleImport = async (selectedRows: number[]) => {
    setIsImporting(true);
    setError(null);

    try {
      // Filter mappings for selected rows only
      const selectedMappings = mappings.filter((m) => selectedRows.includes(m.rowIndex));

      const result = await executeImport(organizationId, {
        importId,
        mappings: selectedMappings,
        skipDuplicates: true,
        createRulesFromMappings: true,
      });

      if (result.success) {
        // Show success message and redirect
        router.push(
          `/dashboard/${organizationId}/import/history?imported=${result.data.importedRows}`
        );
      } else {
        setError(result.error.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => router.push(`/dashboard/${organizationId}/import`)}
          disabled={isImporting}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Import
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Template Info */}
      {preview.template && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-sm">
            <span className="font-medium">Detected Format:</span> {preview.template.bank_name} -{' '}
            {preview.template.template_name}
          </p>
        </div>
      )}

      {/* Preview Table */}
      <PreviewTable
        rows={preview.rows}
        mappings={mappings}
        accounts={accounts}
        onMappingChange={handleMappingChange}
        onImport={handleImport}
        isImporting={isImporting}
      />
    </div>
  );
}
