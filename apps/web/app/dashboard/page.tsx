'use client';

import { BarChart3, Plus } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { getJournalEntries } from '@/app/actions/journal-entries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { useAuth } from '@/contexts/auth-context';
import { useOrganization } from '@/hooks/use-organization';
import { useServerAction } from '@/hooks/useServerAction';

export default function DashboardPage() {
  const { user } = useAuth();
  const { organizationId } = useOrganization();
  const { execute: fetchEntriesAction, isLoading } = useServerAction(getJournalEntries);
  const [hasData, setHasData] = useState<boolean | null>(null);

  const stats = [
    { name: '今月の売上', value: '¥1,234,567' },
    { name: '今月の経費', value: '¥456,789' },
    { name: '現金残高', value: '¥2,345,678' },
    { name: '未処理仕訳', value: '12件' },
  ];

  useEffect(() => {
    const checkData = async () => {
      if (!organizationId) {
        return;
      }
      try {
        const result = await fetchEntriesAction(organizationId);
        setHasData(result && result.items && result.items.length > 0);
      } catch (error) {
        console.error('Failed to check data:', error);
        setHasData(false);
      }
    };

    if (organizationId) {
      checkData();
    }
  }, [fetchEntriesAction, organizationId]);

  // Show loading state
  if (isLoading || hasData === null) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-lg text-muted-foreground">読み込み中...</div>
        </div>
      </div>
    );
  }

  // Show empty state when no data
  if (hasData === false) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">ダッシュボード</h2>
          <p className="text-gray-600 mt-2">こんにちは、{user?.name}さん。記帳を始めましょう。</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={<BarChart3 className="h-12 w-12" />}
              title="まだデータがありません"
              description="最初の仕訳を入力して、財務管理を始めましょう"
              action={
                <Link href="/dashboard/journal-entries/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    仕訳を入力
                  </Button>
                </Link>
              }
              tips={['CSVインポートも可能です', '簡単入力モードがおすすめ']}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

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
