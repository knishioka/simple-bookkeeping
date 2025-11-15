import { redirect } from 'next/navigation';

import PreviewClient from './preview-client';

import { getAccounts } from '@/app/actions/accounts';
import { previewImport } from '@/app/actions/csv-import';
import { createClient } from '@/lib/supabase/server';

interface PreviewPageProps {
  params: {
    organizationId: string;
    importId: string;
  };
}

export default async function PreviewPage({ params }: PreviewPageProps) {
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

  // Get preview data
  const previewResult = await previewImport(params.organizationId, params.importId);
  if (!previewResult.success) {
    redirect(`/dashboard/${params.organizationId}/import`);
  }

  // Get accounts for organization
  const accountsResult = await getAccounts(params.organizationId);
  const accounts = accountsResult.success ? accountsResult.data.items : [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Preview Import</h1>
        <p className="text-gray-600 mt-2">Review and map accounts before importing transactions</p>
      </div>

      <PreviewClient
        organizationId={params.organizationId}
        importId={params.importId}
        preview={previewResult.data.preview}
        initialMappings={previewResult.data.mappings}
        accounts={accounts}
      />
    </div>
  );
}
