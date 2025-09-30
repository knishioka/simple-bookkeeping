'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/auth-context';
// TODO: Migrate to Server Actions - Issue #355
// import { apiClient } from '@/lib/api-client';

// プロフィール更新スキーマ
const profileSchema = z.object({
  name: z.string().min(1, '名前を入力してください'),
});

type ProfileFormData = z.infer<typeof profileSchema>;

// パスワード変更スキーマ
const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, '現在のパスワードを入力してください'),
    newPassword: z.string().min(8, 'パスワードは8文字以上で入力してください'),
    confirmPassword: z.string().min(1, '確認用パスワードを入力してください'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'パスワードが一致しません',
    path: ['confirmPassword'],
  });

type PasswordFormData = z.infer<typeof passwordSchema>;

export default function AccountSettingsPage() {
  const { user } = useAuth();
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);

  // プロフィールフォーム
  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
    },
  });

  // パスワード変更フォーム
  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  // プロフィール更新処理
  const onProfileSubmit = async (_data: ProfileFormData) => {
    // TODO: Migrate to Server Actions - Issue #355
    toast.error('プロフィール更新機能は現在メンテナンス中です');
    setIsProfileLoading(false);

    // Original code commented out:
    /*
    try {
      setIsProfileLoading(true);
      await apiClient.put('/auth/profile', data);
      toast.success('プロフィールを更新しました');
      await refreshUser();
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error('プロフィールの更新に失敗しました');
    } finally {
      setIsProfileLoading(false);
    }
    */
  };

  // パスワード変更処理
  const onPasswordSubmit = async (_data: PasswordFormData) => {
    // TODO: Migrate to Server Actions - Issue #355
    // Use updatePassword Server Action from app/actions/auth.ts instead
    toast.error('パスワード変更機能は現在メンテナンス中です');
    setIsPasswordLoading(false);

    // Original code commented out:
    /*
    try {
      setIsPasswordLoading(true);
      await apiClient.put('/auth/password', data);
      toast.success('パスワードを変更しました');
      passwordForm.reset();
    } catch (error) {
      console.error('Password change error:', error);
      if (
        error &&
        typeof error === 'object' &&
        'response' in error &&
        error.response &&
        typeof error.response === 'object' &&
        'data' in error.response &&
        error.response.data &&
        typeof error.response.data === 'object' &&
        'error' in error.response.data &&
        error.response.data.error &&
        typeof error.response.data.error === 'object' &&
        'code' in error.response.data.error &&
        error.response.data.error.code === 'INVALID_PASSWORD'
      ) {
        toast.error('現在のパスワードが正しくありません');
      } else {
        toast.error('パスワードの変更に失敗しました');
      }
    } finally {
      setIsPasswordLoading(false);
    }
    */
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">アカウント設定</h2>
        <p className="text-muted-foreground">プロフィール情報やパスワードを管理します</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="profile">プロフィール</TabsTrigger>
          <TabsTrigger value="password">パスワード</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>プロフィール情報</CardTitle>
              <CardDescription>アカウントの基本情報を編集します</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...profileForm}>
                <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
                  <FormField
                    control={profileForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>名前</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="山田 太郎" />
                        </FormControl>
                        <FormDescription>表示される名前を入力してください</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-4">
                    <FormItem>
                      <FormLabel>メールアドレス</FormLabel>
                      <FormControl>
                        <Input value={user?.email || ''} disabled />
                      </FormControl>
                      <FormDescription>メールアドレスは変更できません</FormDescription>
                    </FormItem>
                  </div>

                  <Button type="submit" disabled={isProfileLoading}>
                    {isProfileLoading ? '保存中...' : 'プロフィールを更新'}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="password" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>パスワード変更</CardTitle>
              <CardDescription>アカウントのパスワードを変更します</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-6">
                  <FormField
                    control={passwordForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>現在のパスワード</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={passwordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>新しいパスワード</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormDescription>8文字以上で入力してください</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>新しいパスワード（確認）</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormDescription>
                          確認のため、もう一度新しいパスワードを入力してください
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" disabled={isPasswordLoading}>
                    {isPasswordLoading ? '変更中...' : 'パスワードを変更'}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
