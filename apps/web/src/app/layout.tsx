'use client';

import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';

import { AuthProvider } from '@/contexts/auth-context';

import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <AuthProvider>
          {children}
          <Toaster position="top-right" />
        </AuthProvider>
      </body>
    </html>
  );
}
