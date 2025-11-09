'use client';

import { useEffect, useState } from 'react';

export default function TestCookiesPage() {
  const [cookies, setCookies] = useState<string>('');
  const [supabaseCookies, setSupabaseCookies] = useState<string[]>([]);

  useEffect(() => {
    // Get all cookies
    const allCookies = document.cookie;
    setCookies(allCookies);

    // Filter Supabase cookies
    const cookieArray = allCookies.split(';').map((c) => c.trim());
    const sbCookies = cookieArray.filter((c) => c.startsWith('sb-') || c.startsWith('supabase-'));
    setSupabaseCookies(sbCookies);
  }, []);

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Cookie Test Page</h1>

        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-lg font-semibold mb-2">All Cookies:</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-x-auto text-sm">
            {cookies || 'No cookies found'}
          </pre>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">
            Supabase Cookies ({supabaseCookies.length}):
          </h2>
          <div className="space-y-2">
            {supabaseCookies.length > 0 ? (
              supabaseCookies.map((cookie, index) => {
                const [name, ...valueParts] = cookie.split('=');
                const value = valueParts.join('=');
                return (
                  <div key={index} className="bg-gray-100 p-3 rounded">
                    <div className="font-mono text-sm">
                      <strong>{name}</strong>
                    </div>
                    <div className="font-mono text-xs text-gray-600 mt-1 break-all">
                      {value.substring(0, 100)}
                      {value.length > 100 ? '...' : ''}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-gray-500">No Supabase cookies found</p>
            )}
          </div>
        </div>

        <div className="mt-6 text-sm text-gray-600">
          <p>このページで確認すべき点:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>ログイン後、Supabase cookiesが存在するか</li>
            <li>sb-eksgzskroipxdwtbmkxm-auth-token.0, .1 などが見えるか</li>
            <li>Cookieの値が空でないか</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
