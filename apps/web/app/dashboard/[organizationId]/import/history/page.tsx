import { CheckCircle, Plus } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getImportHistory } from '@/app/actions/csv-import';
import { ImportHistoryTable } from '@/components/csv-import/import-history-table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';

interface HistoryPageProps {
  params: {
    organizationId: string;
  };
  searchParams: {
    imported?: string;
  };
}

export default async function HistoryPage({ params, searchParams }: HistoryPageProps) {
  const supabase = await createClient();

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect('/sign-in');
  }

  // Check organization access
  const { data: userOrg, error: orgError } = await supabase
    .from('user_organizations')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', params.organizationId)
    .single();

  if (orgError || !userOrg) {
    redirect('/dashboard');
  }

  // Get import history
  const historyResult = await getImportHistory(params.organizationId, {
    page: 1,
    pageSize: 50,
    orderBy: 'created_at',
    orderDirection: 'desc',
  });

  const imports = historyResult.success ? historyResult.data.items : [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Import History</h1>
          <p className="text-gray-600 mt-2">View and manage your CSV import history</p>
        </div>
        <Link href={`/dashboard/${params.organizationId}/import`}>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Import
          </Button>
        </Link>
      </div>

      {/* Success message if just imported */}
      {searchParams.imported && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription>
            Successfully imported {searchParams.imported} transactions!
          </AlertDescription>
        </Alert>
      )}

      {/* Import History Table */}
      <ImportHistoryTable
        imports={imports}
        onView={(importId) => {
          // Navigate to preview page for viewing
          window.location.href = `/dashboard/${params.organizationId}/import/${importId}/preview`;
        }}
      />
    </div>
  );
}
