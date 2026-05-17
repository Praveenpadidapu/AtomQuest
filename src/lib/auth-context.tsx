'use client';

import React, { createContext, useContext } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';

type User = {
  id: string;
  name: string;
  email: string;
  role: 'EMPLOYEE' | 'MANAGER' | 'ADMIN';
  managerId?: string | null;
};

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  const user = session?.user as User | null;
  const isLoading = status === 'loading';

  // We keep login/logout as no-ops for API, relying on next-auth
  const login = (newUser: User) => {
    // next-auth handles this via its own sign-in page or API
  };

  const logout = () => {
    signOut({ callbackUrl: '/login' });
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
