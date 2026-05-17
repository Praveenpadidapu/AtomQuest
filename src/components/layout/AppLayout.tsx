'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { useAuth } from '@/lib/auth-context';
import styles from './AppLayout.module.css';

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();

  if (isLoading) {
    return (
      <div className="flex-center" style={{ height: '100vh' }}>
        <div className="badge badge-neutral">Loading AtomQuest...</div>
      </div>
    );
  }

  const isLoginPage = pathname === '/login';

  if (isLoginPage || !user) {
    return <main>{children}</main>;
  }

  return (
    <div className={styles.layout}>
      <Sidebar />
      <div className={styles.mainWrapper}>
        <Navbar />
        <main className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}
