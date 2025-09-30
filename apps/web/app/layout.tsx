import { Inter } from 'next/font/google';

import { Providers } from '@/components/providers';

import type { Metadata } from 'next';

import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Simple Bookkeeping - 簡単帳簿',
  description: '日本の個人事業主・中小企業向け複式簿記システム',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
