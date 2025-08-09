'use client';

import { Settings, User, Building, Bell, Shield, CreditCard } from 'lucide-react';
import Link from 'next/link';

import { useAuth } from '@/contexts/auth-context';

export default function SettingsPage() {
  const { user } = useAuth();

  const settingsCategories = [
    {
      title: 'アカウント設定',
      icon: User,
      items: [
        {
          label: 'プロフィール',
          description: '名前やメールアドレスの変更',
          href: '/dashboard/settings/account',
        },
        {
          label: 'パスワード変更',
          description: 'パスワードの更新',
          href: '/dashboard/settings/account',
        },
      ],
    },
    {
      title: '組織設定',
      icon: Building,
      items: [
        {
          label: '組織情報',
          description: '組織名や住所の編集',
          href: '/dashboard/settings/organization',
        },
        {
          label: 'メンバー管理',
          description: 'ユーザーの招待と権限管理',
          href: '/dashboard/settings/organization/members',
        },
      ],
    },
    {
      title: '会計設定',
      icon: CreditCard,
      items: [
        {
          label: '会計期間',
          description: '会計期間の設定と管理',
          href: '/dashboard/settings/accounting-periods',
        },
        { label: '消費税設定', description: '消費税率の設定' },
        { label: 'デフォルト設定', description: '各種デフォルト値の設定' },
      ],
    },
    {
      title: '通知設定',
      icon: Bell,
      items: [
        { label: 'メール通知', description: '通知メールの設定' },
        { label: 'アラート設定', description: '各種アラートの設定' },
      ],
    },
    {
      title: 'セキュリティ',
      icon: Shield,
      items: [
        { label: '二要素認証', description: '二要素認証の設定' },
        { label: 'アクセスログ', description: 'ログイン履歴の確認' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">設定</h2>
        <p className="text-muted-foreground">アカウントやシステムの設定を管理します</p>
      </div>

      <div className="grid gap-6">
        {settingsCategories.map((category) => {
          const Icon = category.icon;
          return (
            <div key={category.title} className="rounded-lg border bg-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-lg font-semibold">{category.title}</h3>
              </div>
              <div className="space-y-3">
                {category.items.map((item) => {
                  const content = (
                    <div className="flex items-center justify-between p-3 rounded-md hover:bg-accent cursor-pointer transition-colors">
                      <div>
                        <p className="font-medium">{item.label}</p>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                      <Settings className="h-4 w-4 text-muted-foreground" />
                    </div>
                  );

                  if ('href' in item && item.href) {
                    return (
                      <Link key={item.label} href={item.href}>
                        {content}
                      </Link>
                    );
                  }

                  return <div key={item.label}>{content}</div>;
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">現在のユーザー情報</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">名前</span>
            <span className="font-medium">{user?.name || '未設定'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">メールアドレス</span>
            <span className="font-medium">{user?.email || '未設定'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">ロール</span>
            <span className="font-medium">{user?.currentOrganization?.role || '未設定'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
