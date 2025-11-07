'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, Building2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';

const organizationSchema = z.object({
  name: z.string().min(1, '組織名を入力してください'),
  code: z.string().min(1, '組織コードを入力してください'),
});

type OrganizationFormData = z.infer<typeof organizationSchema>;

interface OrganizationData {
  id: string;
  name: string;
  code: string;
}

interface UserOrganization {
  id: string;
  organization_id: string;
  role: string;
  organizations: OrganizationData | OrganizationData[] | null;
}

export default function SelectOrganizationPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<
    Array<Omit<UserOrganization, 'organizations'> & { organizations: OrganizationData }>
  >([]);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
  });

  // Fetch user's organizations on mount
  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push('/auth/login');
          return;
        }

        const { data, error: fetchError } = await supabase
          .from('user_organizations')
          .select('id, organization_id, role, organizations(id, name, code)')
          .eq('user_id', user.id);

        if (fetchError) {
          console.error('[SelectOrganization] Failed to fetch organizations:', fetchError);
          setError('組織情報の取得に失敗しました');
          return;
        }

        // Filter out entries with null organizations and normalize the data
        const normalizedData = (data || [])
          .filter((item) => item.organizations !== null)
          .map((item) => ({
            ...item,
            organizations: Array.isArray(item.organizations)
              ? item.organizations[0]
              : item.organizations,
          }))
          .filter((item) => item.organizations !== undefined) as Array<
          Omit<UserOrganization, 'organizations'> & { organizations: OrganizationData }
        >;

        setOrganizations(normalizedData);

        // If no organizations, show create form automatically
        if (!data || data.length === 0) {
          setShowCreateForm(true);
        }
      } catch (err) {
        console.error('[SelectOrganization] Error:', err);
        setError('組織情報の取得に失敗しました');
      } finally {
        setIsFetching(false);
      }
    };

    fetchOrganizations();
  }, [router]);

  const handleSelectOrganization = async (orgId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/auth/login');
        return;
      }

      // Set all other organizations to non-default
      await supabase
        .from('user_organizations')
        .update({ is_default: false })
        .eq('user_id', user.id);

      // Set selected organization as default
      const { error: updateError } = await supabase
        .from('user_organizations')
        .update({ is_default: true })
        .eq('user_id', user.id)
        .eq('organization_id', orgId);

      if (updateError) {
        console.error('[SelectOrganization] Failed to update default organization:', updateError);
        setError('デフォルト組織の設定に失敗しました');
        return;
      }

      // Refresh session to update metadata
      await supabase.auth.refreshSession();

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (err) {
      console.error('[SelectOrganization] Error:', err);
      setError('組織の選択に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateOrganization = async (data: OrganizationFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/auth/login');
        return;
      }

      // Create organization
      const { data: newOrg, error: createError } = await supabase
        .from('organizations')
        .insert({
          name: data.name,
          code: data.code,
          is_active: true,
        })
        .select()
        .single();

      if (createError || !newOrg) {
        console.error('[SelectOrganization] Failed to create organization:', createError);
        setError('組織の作成に失敗しました');
        return;
      }

      // Set all other organizations to non-default
      await supabase
        .from('user_organizations')
        .update({ is_default: false })
        .eq('user_id', user.id);

      // Create user-organization relationship
      const { error: linkError } = await supabase.from('user_organizations').insert({
        user_id: user.id,
        organization_id: newOrg.id,
        role: 'admin',
        is_default: true,
      });

      if (linkError) {
        console.error('[SelectOrganization] Failed to link user to organization:', linkError);
        setError('組織へのユーザー紐付けに失敗しました');
        return;
      }

      // Refresh session to update metadata
      await supabase.auth.refreshSession();

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (err) {
      console.error('[SelectOrganization] Error:', err);
      setError('組織の作成に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>組織の選択</CardTitle>
          <CardDescription>
            {showCreateForm ? '新しい組織を作成してください' : '使用する組織を選択してください'}
          </CardDescription>
        </CardHeader>

        {error && (
          <div className="px-6 pb-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        {!showCreateForm && organizations.length > 0 ? (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {organizations.map((userOrg) => (
                <button
                  key={userOrg.id}
                  onClick={() => handleSelectOrganization(userOrg.organization_id)}
                  disabled={isLoading}
                  className="w-full p-4 text-left border rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-3"
                >
                  <Building2 className="h-5 w-5 text-gray-500" />
                  <div className="flex-1">
                    <p className="font-medium">{userOrg.organizations.name}</p>
                    <p className="text-sm text-gray-500">コード: {userOrg.organizations.code}</p>
                  </div>
                  <p className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {userOrg.role}
                  </p>
                </button>
              ))}
            </div>

            <div className="pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setShowCreateForm(true)}
                disabled={isLoading}
              >
                <Plus className="mr-2 h-4 w-4" />
                新しい組織を作成
              </Button>
            </div>
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit(handleCreateOrganization)}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">組織名</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="株式会社サンプル"
                  {...register('name')}
                  disabled={isLoading}
                />
                {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="code">組織コード</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="SAMPLE001"
                  {...register('code')}
                  disabled={isLoading}
                />
                {errors.code && <p className="text-sm text-red-500">{errors.code.message}</p>}
                <p className="text-xs text-gray-500">
                  半角英数字で入力してください（例: ORG001, COMPANY01）
                </p>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-3">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    作成中...
                  </>
                ) : (
                  '組織を作成'
                )}
              </Button>

              {organizations.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setShowCreateForm(false)}
                  disabled={isLoading}
                >
                  戻る
                </Button>
              )}
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
