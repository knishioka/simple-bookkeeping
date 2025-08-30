'use client';

import { useEffect } from 'react';

// Force dynamic rendering to avoid static generation error
export const dynamic = 'force-dynamic';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Global error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">システムエラーが発生しました</h2>
        <p className="text-gray-600 mb-8">申し訳ございません。システムエラーが発生しました。</p>
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          もう一度試す
        </button>
      </div>
    </div>
  );
}
