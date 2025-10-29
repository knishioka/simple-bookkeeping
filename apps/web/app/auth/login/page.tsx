'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { signIn } from '@/app/actions/auth';
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

const loginSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(8, 'パスワードは8文字以上である必要があります'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      // Server Actionを直接呼び出し
      // IMPORTANT: signIn() now uses redirect() for successful logins,
      // so it will never return on success - the page will redirect automatically.
      // Only errors will be returned as ActionResult.
      const result = await signIn({
        email: data.email,
        password: data.password,
      });

      // If we reach here, it means there was an error (success would have redirected)
      setError(result.error?.message || 'ログインに失敗しました');
      setIsLoading(false);
    } catch (err) {
      // NEXT_REDIRECT errors are normal - they indicate successful redirect
      // Only show error for actual failures
      // Check for Next.js redirect error by checking the digest property
      if (
        typeof err === 'object' &&
        err !== null &&
        'digest' in err &&
        typeof err.digest === 'string' &&
        err.digest.includes('NEXT_REDIRECT')
      ) {
        // Successful redirect - do nothing, let Next.js handle it
        return;
      }

      // Actual error - show to user
      setError(err instanceof Error ? err.message : 'ログインに失敗しました');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>ログイン</CardTitle>
          <CardDescription>アカウントにログインしてください</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@example.com"
                {...register('email')}
                disabled={isLoading}
              />
              {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">パスワード</Label>
              <Input id="password" type="password" {...register('password')} disabled={isLoading} />
              {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
            </div>

            <div className="flex justify-end">
              <Link
                href="/auth/reset-password"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                パスワードを忘れた場合
              </Link>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ログイン中...
                </>
              ) : (
                'ログイン'
              )}
            </Button>

            <div className="text-sm text-center">
              アカウントをお持ちでない場合は
              <Link href="/auth/signup" className="text-blue-600 hover:text-blue-800 ml-1">
                新規登録
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
