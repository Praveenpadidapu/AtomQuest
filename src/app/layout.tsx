import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { AppLayout } from '@/components/layout/AppLayout';

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });

export const metadata: Metadata = {
  title: 'AtomQuest | Goal Setting & Tracking Portal',
  description: 'In-House Goal Setting & Tracking Portal',
};

import { Providers } from '@/components/providers';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={outfit.variable}>
        <Providers>
          <AuthProvider>
            <AppLayout>{children}</AppLayout>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
