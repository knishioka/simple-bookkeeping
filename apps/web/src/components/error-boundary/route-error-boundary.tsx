'use client';

import { AlertCircle, Home, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import React from 'react';
// import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function RouteErrorBoundary() {
  // This is a placeholder for Next.js - react-router-dom hooks don't work here
  const error: unknown = null;

  let errorMessage = '予期しないエラーが発生しました';
  const errorStatus: number = 500;
  let errorDetails = '';

  // Simplified error handling for Next.js
  if (error instanceof Error) {
    errorMessage = error.message;
    errorDetails = error.stack || '';
  }

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-6 w-6 text-red-500" />
            <CardTitle>
              {errorStatus} - {errorMessage}
            </CardTitle>
          </div>
          <CardDescription>{errorDetails}</CardDescription>
        </CardHeader>

        <CardContent>
          {process.env.NODE_ENV === 'development' && error instanceof Error && error.stack && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-gray-600">
                エラーの詳細（開発環境のみ）
              </summary>
              <pre className="mt-2 text-xs overflow-auto max-h-48 p-2 bg-gray-100 rounded">
                {error.stack}
              </pre>
            </details>
          )}
        </CardContent>

        <CardFooter className="flex flex-col space-y-2">
          {errorStatus === 401 ? (
            <Link href="/auth/login" className="w-full">
              <Button className="w-full">ログインページへ</Button>
            </Link>
          ) : (
            <>
              <Button onClick={handleReload} className="w-full" variant="default">
                <RefreshCw className="mr-2 h-4 w-4" />
                ページを再読み込み
              </Button>
              <Link href="/" className="w-full">
                <Button variant="outline" className="w-full">
                  <Home className="mr-2 h-4 w-4" />
                  ホームに戻る
                </Button>
              </Link>
            </>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
