'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

// Route Handler approach - no Server Action import needed
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
    console.warn('[LoginPage] Starting login process');
    setIsLoading(true);
    setError(null);

    try {
      // CRITICAL: Route Handler approach instead of Server Action
      // This ensures cookies are set in the same HTTP response as the redirect
      console.warn('[LoginPage] Calling Route Handler /api/auth/signin');
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
        }),
        // Default redirect: 'follow' allows fetch to follow redirects
        // and set cookies properly
      });

      // Check if redirect happened (success case)
      if (response.ok && response.redirected) {
        // Success - cookies are set, redirect happened
        // Navigate to the final URL (dashboard or select-organization)
        console.warn('[LoginPage] Login successful, redirecting to:', response.url);
        window.location.href = response.url;
        return;
      }

      // Error case - parse error response
      if (!response.ok) {
        // Check Content-Type to determine response format
        const contentType = response.headers.get('content-type');
        console.warn('[LoginPage] Error response Content-Type:', contentType);

        // Handle JSON error response
        if (contentType && contentType.includes('application/json')) {
          try {
            const result = await response.json();
            console.error('[LoginPage] Login failed:', result.error?.message);
            setError(result.error?.message || 'ログインに失敗しました');
          } catch (parseError) {
            console.error('[LoginPage] Failed to parse JSON error:', parseError);
            setError('ログインに失敗しました');
          }
        } else {
          // Non-JSON response (likely HTML error page)
          console.error('[LoginPage] Received non-JSON error response');
          const text = await response.text();
          console.error(
            '[LoginPage] Error response text (first 200 chars):',
            text.substring(0, 200)
          );
          setError('サーバーエラーが発生しました。しばらく経ってから再度お試しください。');
        }
        setIsLoading(false);
        return;
      }

      // Unexpected success without redirect
      console.error('[LoginPage] Unexpected response:', response);
      setError('ログインに失敗しました');
      setIsLoading(false);
    } catch (err) {
      // Network or other unexpected errors
      console.error('[LoginPage] Login threw exception:', err);
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

            {/* TODO: Implement password reset functionality
            <div className="flex justify-end">
              <Link
                href="/auth/reset-password"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                パスワードを忘れた場合
              </Link>
            </div>
            */}
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
