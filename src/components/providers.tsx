'use client';

import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'react-hot-toast';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster position="top-right" toastOptions={{
        style: {
          background: 'rgba(2, 12, 27, 0.9)',
          color: '#e6f1ff',
          border: '1px solid rgba(100, 255, 218, 0.2)',
          backdropFilter: 'blur(10px)',
        }
      }} />
    </SessionProvider>
  );
}
