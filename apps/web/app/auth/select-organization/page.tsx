'use client';

import { AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { getCurrentUser } from '@/app/actions/auth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function SelectOrganizationPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkUser() {
      try {
        console.warn('[SelectOrganization] Calling getCurrentUser()');
        const result = await getCurrentUser();
        console.warn('[SelectOrganization] getCurrentUser() result:', {
          success: result.success,
          hasData: !!result.data,
          userId: result.data?.id,
          email: result.data?.email,
          organizationId: result.data?.organizationId,
          role: result.data?.role,
        });

        if (!result.success) {
          console.error('[SelectOrganization] getCurrentUser() failed');
          setError('ユーザー情報の取得に失敗しました。');
          setIsLoading(false);
          return;
        }

        if (!result.data) {
          // Not logged in, redirect to login
          console.warn('[SelectOrganization] No user data, redirecting to login');
          router.push('/auth/login');
          return;
        }

        if (result.data.organizationId) {
          // User has organization, redirect to dashboard
          console.warn(
            '[SelectOrganization] User has organization:',
            result.data.organizationId,
            'redirecting to dashboard'
          );
          router.push('/dashboard');
          return;
        }

        // User logged in but no organization
        console.warn('[SelectOrganization] User logged in but no organization found');
        console.warn('[SelectOrganization] User data:', result.data);
        setError('アカウントに組織が関連付けられていません。管理者にお問い合わせください。');
        setIsLoading(false);
      } catch (err) {
        console.error('[SelectOrganization] Error:', err);
        setError('エラーが発生しました。');
        setIsLoading(false);
      }
    }

    checkUser();
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>読み込み中...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>組織の設定が必要です</CardTitle>
          <CardDescription>アカウントに組織が関連付けられていません</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>エラー</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="mt-4 space-y-2 text-sm text-gray-600">
            <p>組織への参加には管理者による招待が必要です。</p>
            <p>管理者にお問い合わせいただくか、サポートまでご連絡ください。</p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <Button asChild className="w-full">
            <Link href="/auth/login">ログインページに戻る</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
