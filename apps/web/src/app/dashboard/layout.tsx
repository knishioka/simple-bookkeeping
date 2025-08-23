'use client';

import { Menu, MoreVertical } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import ProtectedRoute from '@/components/layout/protected-route';
import { MobileMenu } from '@/components/navigation/mobile-menu';
import { OrganizationSwitcher } from '@/components/organization-switcher';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/auth-context';

const navigation = [
  { name: 'ダッシュボード', href: '/dashboard' },
  { name: '仕訳入力', href: '/dashboard/journal-entries' },
  { name: '勘定科目', href: '/dashboard/accounts' },
  {
    name: '補助簿',
    href: '/dashboard/ledgers',
    children: [
      { name: '現金出納帳', href: '/dashboard/ledgers/cash-book' },
      { name: '預金出納帳', href: '/dashboard/ledgers/bank-book' },
      { name: '売掛金台帳', href: '/dashboard/ledgers/accounts-receivable' },
      { name: '買掛金台帳', href: '/dashboard/ledgers/accounts-payable' },
    ],
  },
  {
    name: '帳票',
    href: '/dashboard/reports',
    children: [
      { name: '貸借対照表', href: '/dashboard/reports/balance-sheet' },
      { name: '損益計算書', href: '/dashboard/reports/profit-loss' },
      { name: '試算表', href: '/dashboard/reports/trial-balance' },
    ],
  },
  { name: '設定', href: '/dashboard/settings' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // タブレット用の主要ナビゲーション項目
  const primaryNavigation = navigation.slice(0, 3); // ダッシュボード、仕訳入力、勘定科目
  const secondaryNavigation = navigation.slice(3); // 補助簿、帳票、設定

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-100">
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                {/* モバイル用ハンバーガーメニュー (768px未満) */}
                <div className="flex items-center md:hidden">
                  <button
                    onClick={() => setMobileMenuOpen(true)}
                    className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                    aria-label="メニューを開く"
                  >
                    <Menu className="h-6 w-6" />
                  </button>
                </div>

                <div className="flex-shrink-0 flex items-center ml-2 lg:ml-0">
                  <h1 className="text-lg sm:text-xl font-bold">Simple Bookkeeping</h1>
                </div>

                {/* デスクトップ用フルメニュー (1024px以上) */}
                <div className="hidden lg:ml-6 lg:flex lg:space-x-6 xl:space-x-8">
                  {navigation.map((item) =>
                    item.children ? (
                      <div key={item.name} className="relative group inline-flex items-center">
                        <button
                          className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium h-full ${
                            pathname.startsWith(item.href)
                              ? 'border-indigo-500 text-gray-900'
                              : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                          }`}
                        >
                          {item.name}
                        </button>
                        <div className="absolute left-0 top-full mt-1 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                          <div className="py-1">
                            {item.children.map((child) => (
                              <Link
                                key={child.name}
                                href={child.href}
                                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              >
                                {child.name}
                              </Link>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                          pathname === item.href
                            ? 'border-indigo-500 text-gray-900'
                            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                        }`}
                      >
                        {item.name}
                      </Link>
                    )
                  )}
                </div>

                {/* タブレット用簡略メニュー (768px-1023px) */}
                <div className="hidden md:ml-6 md:flex lg:hidden md:space-x-4">
                  {primaryNavigation.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                        pathname === item.href
                          ? 'border-indigo-500 text-gray-900'
                          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      }`}
                    >
                      {item.name}
                    </Link>
                  ))}
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700">
                      <MoreVertical className="h-5 w-5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                      {secondaryNavigation.map((item) =>
                        item.children ? (
                          <div key={item.name}>
                            <DropdownMenuSeparator />
                            <div className="px-2 py-1.5 text-xs font-semibold text-gray-500">
                              {item.name}
                            </div>
                            {item.children.map((child) => (
                              <DropdownMenuItem key={child.name} asChild>
                                <Link href={child.href} className="cursor-pointer">
                                  {child.name}
                                </Link>
                              </DropdownMenuItem>
                            ))}
                          </div>
                        ) : (
                          <DropdownMenuItem key={item.name} asChild>
                            <Link href={item.href} className="cursor-pointer">
                              {item.name}
                            </Link>
                          </DropdownMenuItem>
                        )
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* 右側のユーザー情報 */}
              <div className="flex items-center space-x-2 sm:space-x-4">
                <div className="hidden sm:block">
                  <OrganizationSwitcher />
                </div>
                <span className="hidden md:block text-sm text-gray-700">{user?.name}</span>
                <Button variant="outline" size="sm" onClick={logout} className="text-xs sm:text-sm">
                  ログアウト
                </Button>
              </div>
            </div>
          </div>
        </nav>

        {/* モバイルメニューコンポーネント */}
        <MobileMenu
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          navigation={navigation}
          pathname={pathname}
        />
        <main className="py-10">
          <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
