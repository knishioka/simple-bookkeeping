'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import ProtectedRoute from '@/components/layout/protected-route';
import { OrganizationSwitcher } from '@/components/organization-switcher';
import { Button } from '@/components/ui/button';
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
    ]
  },
  { 
    name: '帳票', 
    href: '/dashboard/reports',
    children: [
      { name: '貸借対照表', href: '/dashboard/reports/balance-sheet' },
      { name: '損益計算書', href: '/dashboard/reports/profit-loss' },
      { name: '試算表', href: '/dashboard/reports/trial-balance' },
    ]
  },
  { name: '設定', href: '/dashboard/settings' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-100">
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <div className="flex-shrink-0 flex items-center">
                  <h1 className="text-xl font-bold">Simple Bookkeeping</h1>
                </div>
                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                  {navigation.map((item) => (
                    item.children ? (
                      <div key={item.name} className="relative group">
                        <button
                          className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                            pathname.startsWith(item.href)
                              ? 'border-indigo-500 text-gray-900'
                              : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                          }`}
                        >
                          {item.name}
                        </button>
                        <div className="absolute left-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
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
                  ))}
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <OrganizationSwitcher />
                <span className="text-sm text-gray-700">{user?.name}</span>
                <Button variant="outline" size="sm" onClick={logout}>
                  ログアウト
                </Button>
              </div>
            </div>
          </div>
        </nav>
        <main className="py-10">
          <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </ProtectedRoute>
  );
}