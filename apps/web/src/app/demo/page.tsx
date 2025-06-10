'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function DemoPage() {
  const demoPages = [
    {
      title: '勘定科目管理',
      description: '勘定科目の作成、編集、検索、フィルタリング機能のデモ',
      href: '/demo/accounts',
      features: [
        '勘定科目の一覧表示',
        'コード・名称による検索',
        'タイプ別フィルタリング',
        '新規作成・編集ダイアログ',
        '親子関係の設定',
        '有効/無効の状態管理',
      ],
    },
    {
      title: '仕訳入力',
      description: '複式簿記の仕訳入力と管理機能のデモ',
      href: '/demo/journal-entries',
      features: [
        '仕訳の一覧表示',
        '複式簿記の仕訳入力',
        '借方・貸方の自動バランス検証',
        '日付・ステータス別フィルタリング',
        '承認ワークフロー',
        '消費税率の設定',
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Simple Bookkeeping - 機能デモ
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            日本の確定申告に対応した複式簿記システムの機能をご確認いただけます。
            各デモページでは実際のUIと操作感を体験できます。
          </p>
          <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg max-w-4xl mx-auto">
            <p className="text-sm text-yellow-800">
              <strong>注意:</strong> これらはデモページです。データの保存や実際の処理は行われません。
              本格的な利用には認証とデータベースの設定が必要です。
            </p>
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-2 mb-12">
          {demoPages.map((page) => (
            <Card key={page.href} className="h-full">
              <CardHeader>
                <CardTitle className="text-2xl">{page.title}</CardTitle>
                <CardDescription className="text-base">
                  {page.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div className="flex-1">
                  <h4 className="font-medium mb-3">主な機能:</h4>
                  <ul className="space-y-2 text-sm text-gray-600 mb-6">
                    {page.features.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-green-500 mr-2">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-auto">
                  <Link href={page.href}>
                    <Button className="w-full">
                      {page.title}のデモを見る
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="bg-white rounded-lg shadow-sm p-8">
          <h2 className="text-2xl font-bold mb-6">システムの特徴</h2>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📊</span>
              </div>
              <h3 className="font-medium mb-2">複式簿記対応</h3>
              <p className="text-sm text-gray-600">
                青色申告特別控除（65万円）に必要な複式簿記での記帳に完全対応
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🏢</span>
              </div>
              <h3 className="font-medium mb-2">マルチテナント</h3>
              <p className="text-sm text-gray-600">
                複数の事業者・組織を管理でき、データが完全に分離された安全な設計
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">⚡</span>
              </div>
              <h3 className="font-medium mb-2">モダンな技術</h3>
              <p className="text-sm text-gray-600">
                Next.js、TypeScript、Prismaを使用した高性能で保守性の高いシステム
              </p>
            </div>
          </div>
        </div>

        <div className="text-center mt-12">
          <Link href="/">
            <Button variant="outline">
              メインページに戻る
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}