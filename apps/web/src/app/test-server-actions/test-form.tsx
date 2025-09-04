'use client';

import { useState } from 'react';

import { testFormAction, getServerTime } from '@/app/actions/example';

interface FormResult {
  success: boolean;
  data: {
    name: string;
    email: string;
    timestamp: string;
  };
}

interface TimeResult {
  time: string;
  message: string;
}

type Result = FormResult | TimeResult;

export default function TestForm() {
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  // フォーム送信ハンドラー
  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      const response = await testFormAction(formData);
      setResult(response);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  // ボタンクリックハンドラー
  async function handleButtonClick() {
    setLoading(true);
    try {
      const response = await getServerTime();
      setResult(response);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="border p-4 rounded">
      <h2 className="text-xl font-semibold mb-4">インタラクティブテスト</h2>

      {/* Server Actionを使用したフォーム */}
      <div className="mb-6">
        <h3 className="font-semibold mb-2">フォーム送信テスト</h3>
        <form action={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">
              名前
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="border rounded px-3 py-1 w-full max-w-xs"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              メールアドレス
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="border rounded px-3 py-1 w-full max-w-xs"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? '送信中...' : 'フォーム送信'}
          </button>
        </form>
      </div>

      {/* ボタンクリックテスト */}
      <div className="mb-6">
        <h3 className="font-semibold mb-2">ボタンクリックテスト</h3>
        <button
          onClick={handleButtonClick}
          disabled={loading}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
        >
          {loading ? '取得中...' : 'サーバー時刻を取得'}
        </button>
      </div>

      {/* 結果表示 */}
      {result && (
        <div className="mt-4 p-3 bg-gray-100 rounded">
          <h3 className="font-semibold mb-2">実行結果:</h3>
          <pre className="text-sm overflow-auto">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </section>
  );
}
