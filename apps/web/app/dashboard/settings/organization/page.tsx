'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/auth-context';
// TODO: Migrate to Server Actions - Issue #355
// import { apiClient as api } from '@/lib/api-client';

const organizationSchema = z.object({
  name: z.string().min(1, '組織名は必須です'),
  taxId: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('有効なメールアドレスを入力してください').optional().or(z.literal('')),
});

type OrganizationFormData = z.infer<typeof organizationSchema>;

interface Organization {
  id: string;
  name: string;
  code: string;
  taxId?: string;
  address?: string;
  phone?: string;
  email?: string;
  _count?: {
    userOrganizations: number;
    accounts: number;
    journalEntries: number;
  };
}

export default function OrganizationSettingsPage() {
  const router = useRouter();
  const { user, currentOrganization } = useAuth();
  const [organization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  const form = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      name: '',
      taxId: '',
      address: '',
      phone: '',
      email: '',
    },
  });

  useEffect(() => {
    const fetchOrganization = async () => {
      if (!currentOrganization) {
        setIsFetching(false);
        return;
      }

      // TODO: Migrate to Server Actions - Issue #355
      toast.error('組織情報の表示機能は現在メンテナンス中です');
      setIsFetching(false);
      /*
      try {
        const response = await api.get<{ data: Organization }>('/organizations/current');
        const org = response.data?.data;
        if (!org) {
          throw new Error('Failed to fetch organization');
        }
        setOrganization(org);
        form.reset({
          name: org.name || '',
          taxId: org.taxId || '',
          address: org.address || '',
          phone: org.phone || '',
          email: org.email || '',
        });
      } catch (error) {
        console.error('Failed to fetch organization:', error);
        toast.error('組織情報の取得に失敗しました');
      } finally {
        setIsFetching(false);
      }
      */
    };

    fetchOrganization();
  }, [currentOrganization, form]);

  const onSubmit = async (_data: OrganizationFormData) => {
    // TODO: Migrate to Server Actions - Issue #355
    toast.error('組織情報の更新機能は現在メンテナンス中です');
    setIsLoading(false);

    /*
    if (!organization) return;

    setIsLoading(true);
    try {
      const response = await api.put<{ data: Organization }>(
        `/organizations/${organization.id}`,
        data
      );
      if (response.data?.data) {
        setOrganization(response.data.data);
      }
      toast.success('組織情報を更新しました');
    } catch (error) {
      console.error('Failed to update organization:', error);
      toast.error('組織情報の更新に失敗しました');
    } finally {
      setIsLoading(false);
    }
    */
  };

  // Check if current user is admin
  const currentUserRole = user?.currentOrganization?.role;
  const isAdmin = currentUserRole === 'admin';

  if (isFetching) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="p-8">
        <p>組織が選択されていません</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">組織設定</h1>
        <p className="mt-2 text-muted-foreground">組織の基本情報とメンバーを管理します</p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">基本情報</TabsTrigger>
          <TabsTrigger value="members">メンバー管理</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>組織情報</CardTitle>
              <CardDescription>組織の基本情報を管理します</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>組織名</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              disabled={!isAdmin || isLoading}
                              placeholder="株式会社サンプル"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-2">
                      <FormLabel>組織コード</FormLabel>
                      <Input value={organization.code} disabled />
                      <p className="text-sm text-muted-foreground">組織コードは変更できません</p>
                    </div>

                    <FormField
                      control={form.control}
                      name="taxId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>法人番号</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              disabled={!isAdmin || isLoading}
                              placeholder="1234567890123"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>電話番号</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              disabled={!isAdmin || isLoading}
                              placeholder="03-1234-5678"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>メールアドレス</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              disabled={!isAdmin || isLoading}
                              type="email"
                              placeholder="info@example.com"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>住所</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              disabled={!isAdmin || isLoading}
                              placeholder="東京都千代田区..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {isAdmin && (
                    <div className="flex justify-end">
                      <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        更新
                      </Button>
                    </div>
                  )}
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>統計情報</CardTitle>
              <CardDescription>組織の利用状況</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">メンバー数</p>
                  <p className="text-2xl font-bold">
                    {organization._count?.userOrganizations || 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">勘定科目数</p>
                  <p className="text-2xl font-bold">{organization._count?.accounts || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">仕訳数</p>
                  <p className="text-2xl font-bold">{organization._count?.journalEntries || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle>メンバー管理</CardTitle>
              <CardDescription>組織のメンバーを管理します</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
                <Button onClick={() => router.push('/dashboard/settings/organization/members')}>
                  メンバー管理画面へ
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
