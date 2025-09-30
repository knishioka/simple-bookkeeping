'use client';

import { Activity, Users, TrendingUp, DollarSign } from 'lucide-react';
import { useState, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRealtime, usePresence } from '@/hooks/use-realtime';
import { formatCurrency } from '@/lib/formatters';

interface DashboardStats {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  recentTransactions: number;
}

interface RealtimeDashboardProps {
  organizationId: string;
  userId: string;
  userName: string;
  userEmail: string;
}

export function RealtimeDashboard({
  organizationId,
  userId,
  userName,
  userEmail,
}: RealtimeDashboardProps) {
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    totalExpenses: 0,
    netIncome: 0,
    recentTransactions: 0,
  });
  const [recentActivities, setRecentActivities] = useState<
    Array<{
      type: string;
      action: string;
      description: string;
      timestamp: string;
      user?: string;
    }>
  >([]);
  const [onlineUsers] = useState<string[]>([]);

  // 仕訳入力のリアルタイム更新を購読
  useRealtime({
    table: 'journal_entries',
    filter: `organization_id=eq.${organizationId}`,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onInsert: (newEntry: any) => {
      console.warn('New journal entry:', newEntry);
      // 統計を更新
      updateStats(newEntry);
      // 最近のアクティビティに追加
      addActivity({
        type: 'journal_entry',
        action: 'created',
        description: `新しい仕訳が追加されました: ${newEntry.description}`,
        timestamp: new Date().toISOString(),
        user: newEntry.created_by,
      });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onUpdate: (payload: any) => {
      console.warn('Journal entry updated:', payload);
      addActivity({
        type: 'journal_entry',
        action: 'updated',
        description: `仕訳が更新されました: ${payload.new.description}`,
        timestamp: new Date().toISOString(),
        user: payload.new.updated_by,
      });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onDelete: (deletedEntry: any) => {
      console.warn('Journal entry deleted:', deletedEntry);
      addActivity({
        type: 'journal_entry',
        action: 'deleted',
        description: `仕訳が削除されました`,
        timestamp: new Date().toISOString(),
      });
    },
  });

  // 勘定科目のリアルタイム更新を購読
  useRealtime({
    table: 'accounts',
    filter: `organization_id=eq.${organizationId}`,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onInsert: (newAccount: any) => {
      addActivity({
        type: 'account',
        action: 'created',
        description: `新しい勘定科目が追加されました: ${newAccount.name}`,
        timestamp: new Date().toISOString(),
        user: newAccount.created_by,
      });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onUpdate: (payload: any) => {
      addActivity({
        type: 'account',
        action: 'updated',
        description: `勘定科目が更新されました: ${payload.new.name}`,
        timestamp: new Date().toISOString(),
        user: payload.new.updated_by,
      });
    },
  });

  // オンラインユーザーのプレゼンス管理
  usePresence(
    `organization-${organizationId}`,
    { id: userId, name: userName, email: userEmail },
    true
  );

  const updateStats = (_entry: unknown) => {
    // 実際の実装では、エントリーの詳細データから計算
    setStats((prev) => ({
      ...prev,
      recentTransactions: prev.recentTransactions + 1,
    }));
  };

  const addActivity = (activity: {
    type: string;
    action: string;
    description: string;
    timestamp: string;
    user?: string;
  }) => {
    setRecentActivities((prev) => [activity, ...prev].slice(0, 10));
  };

  // 初期データの取得
  useEffect(() => {
    fetchInitialStats();
  }, [organizationId]);

  const fetchInitialStats = async () => {
    // 実装例：Supabaseから統計データを取得
    // const { data } = await supabase
    //   .from('dashboard_stats')
    //   .select('*')
    //   .eq('organization_id', organizationId)
    //   .single();
    // setStats(data);
  };

  return (
    <div className="space-y-6">
      {/* リアルタイムインジケーター */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-green-500 animate-pulse" />
          <span className="text-sm text-muted-foreground">リアルタイム更新中</span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{onlineUsers.length}人がオンライン</span>
        </div>
      </div>

      {/* 統計カード */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">総収益</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">今月の売上合計</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">総経費</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalExpenses)}</div>
            <p className="text-xs text-muted-foreground">今月の経費合計</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">純利益</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.netIncome)}</div>
            <p className="text-xs text-muted-foreground">収益 - 経費</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">取引件数</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recentTransactions}</div>
            <p className="text-xs text-muted-foreground">今日の取引</p>
          </CardContent>
        </Card>
      </div>

      {/* 最近のアクティビティ */}
      <Card>
        <CardHeader>
          <CardTitle>最近のアクティビティ</CardTitle>
          <CardDescription>組織内でのリアルタイムな活動状況</CardDescription>
        </CardHeader>
        <CardContent>
          {recentActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground">まだアクティビティがありません</p>
          ) : (
            <div className="space-y-3">
              {recentActivities.map((activity, index) => (
                <div
                  key={index}
                  className="flex items-start justify-between border-b pb-3 last:border-0"
                >
                  <div className="space-y-1">
                    <p className="text-sm">{activity.description}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {activity.type === 'journal_entry' ? '仕訳' : '勘定科目'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(activity.timestamp).toLocaleTimeString('ja-JP')}
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant={
                      activity.action === 'created'
                        ? 'default'
                        : activity.action === 'updated'
                          ? 'secondary'
                          : 'destructive'
                    }
                    className="text-xs"
                  >
                    {activity.action === 'created'
                      ? '作成'
                      : activity.action === 'updated'
                        ? '更新'
                        : '削除'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
