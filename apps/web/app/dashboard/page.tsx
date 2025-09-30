'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';

export default function DashboardPage() {
  const { user } = useAuth();

  const stats = [
    { name: '今月の売上', value: '¥1,234,567' },
    { name: '今月の経費', value: '¥456,789' },
    { name: '現金残高', value: '¥2,345,678' },
    { name: '未処理仕訳', value: '12件' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">ダッシュボード</h2>
        <p className="text-gray-600 mt-2">
          こんにちは、{user?.name}さん。今日も記帳をがんばりましょう。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>最近の仕訳</CardTitle>
            <CardDescription>直近で入力された仕訳を表示します</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">仕訳データがありません</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>今月の収支</CardTitle>
            <CardDescription>今月の収入と支出の概要</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">データがありません</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
