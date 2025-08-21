'use client';

import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

// Force dynamic rendering to avoid static generation error
export const dynamic = 'force-dynamic';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">エラーが発生しました</h2>
        <p className="text-gray-600 mb-8">申し訳ございません。予期しないエラーが発生しました。</p>
        <Button onClick={() => reset()}>もう一度試す</Button>
      </div>
    </div>
  );
}
