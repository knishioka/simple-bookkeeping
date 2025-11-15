import { redirect } from 'next/navigation';

import RulesClient from './rules-client';

import { getAccounts } from '@/app/actions/accounts';
import { getImportRules } from '@/app/actions/csv-import';
import { createClient } from '@/lib/supabase/server';

interface RulesPageProps {
  params: {
    organizationId: string;
  };
}

export default async function RulesPage({ params }: RulesPageProps) {
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

  // Only admins can manage rules
  if (!['owner', 'admin'].includes(userOrg.role)) {
    redirect(`/dashboard/${params.organizationId}/import`);
  }

  // Get import rules
  const rulesResult = await getImportRules(params.organizationId);
  const rules = rulesResult.success ? rulesResult.data : [];

  // Get accounts for organization
  const accountsResult = await getAccounts(params.organizationId);
  const accounts = accountsResult.success ? accountsResult.data.items : [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Import Rules</h1>
        <p className="text-gray-600 mt-2">Manage automatic account mapping rules for CSV imports</p>
      </div>

      <RulesClient
        organizationId={params.organizationId}
        initialRules={rules}
        accounts={accounts}
      />
    </div>
  );
}
