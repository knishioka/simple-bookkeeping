import { redirect } from 'next/navigation';

import ImportUploader from './import-uploader';

import { getCsvTemplates } from '@/app/actions/csv-import';
import { createClient } from '@/lib/supabase/server';

interface ImportPageProps {
  params: {
    organizationId: string;
  };
}

export default async function ImportPage({ params }: ImportPageProps) {
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

  // Get CSV templates
  const templatesResult = await getCsvTemplates();
  const templates = templatesResult.success ? templatesResult.data : [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">CSV Import</h1>
        <p className="text-gray-600 mt-2">Import bank and credit card statements from CSV files</p>
      </div>

      <ImportUploader organizationId={params.organizationId} templates={templates} />
    </div>
  );
}
