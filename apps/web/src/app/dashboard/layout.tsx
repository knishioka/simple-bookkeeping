'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import ProtectedRoute from '@/components/layout/protected-route';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';


const navigation = [
  { name: 'ダッシュボード', href: '/dashboard' },
  { name: '仕訳入力', href: '/dashboard/journal-entries' },
  { name: '勘定科目', href: '/dashboard/accounts' },
  { name: 'レポート', href: '/dashboard/reports' },
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
                </div>
              </div>
              <div className="flex items-center space-x-4">
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