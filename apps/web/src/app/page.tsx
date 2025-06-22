'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-bold">Simple Bookkeeping</h1>
            <div className="space-x-4">
              <Link href="/login">
                <Button variant="outline">ログイン</Button>
              </Link>
              <Link href="/register">
                <Button>新規登録</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h2 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
              日本の確定申告に対応した
              <span className="block text-indigo-600">複式簿記システム</span>
            </h2>
            <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
              青色申告特別控除（65万円）を受けるために必要な複式簿記での記帳を、
              誰でも簡単に行えるシステムです。
            </p>
            <div className="mt-5 max-w-md mx-auto sm:flex sm:justify-center md:mt-8">
              <div className="rounded-md shadow">
                <Link href="/register">
                  <Button size="lg" className="w-full">
                    無料で始める
                  </Button>
                </Link>
              </div>
              <div className="mt-3 rounded-md shadow sm:mt-0 sm:ml-3">
                <Link href="/login">
                  <Button variant="outline" size="lg" className="w-full">
                    ログイン
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-24 grid gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="flex justify-center">
                <div className="h-12 w-12 bg-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">
                  1
                </div>
              </div>
              <h3 className="mt-4 text-lg font-medium">簡単な仕訳入力</h3>
              <p className="mt-2 text-gray-500">
                日付、勘定科目、金額を入力するだけで、複式簿記の仕訳が作成されます。
              </p>
            </div>

            <div className="text-center">
              <div className="flex justify-center">
                <div className="h-12 w-12 bg-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">
                  2
                </div>
              </div>
              <h3 className="mt-4 text-lg font-medium">自動で財務諸表作成</h3>
              <p className="mt-2 text-gray-500">
                貸借対照表（BS）や損益計算書（PL）が自動で作成されます。
              </p>
            </div>

            <div className="text-center">
              <div className="flex justify-center">
                <div className="h-12 w-12 bg-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">
                  3
                </div>
              </div>
              <h3 className="mt-4 text-lg font-medium">確定申告書類の出力</h3>
              <p className="mt-2 text-gray-500">青色申告に必要な書類をPDF形式で出力できます。</p>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-gray-500 text-sm">
            © 2024 Simple Bookkeeping. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
