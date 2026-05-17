'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { EmployeeDashboard } from '@/components/dashboard/EmployeeDashboard';
import { ManagerDashboard } from '@/components/dashboard/ManagerDashboard';
import { AdminDashboard } from '@/components/dashboard/AdminDashboard';
import styles from './page.module.css';

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) return null;

  return (
    <div className="animate-fade-in">
      <div className="flex-between mb-8">
        <div>
          <h1 className="page-title">Welcome back, {user.name.split(' ')[0]}</h1>
          <p className="page-subtitle">Here is what is happening with your goals today.</p>
        </div>
        <div className="badge badge-primary">{user.role}</div>
      </div>

      {user.role === 'EMPLOYEE' && <EmployeeDashboard />}
      {user.role === 'MANAGER' && <ManagerDashboard />}
      {user.role === 'ADMIN' && <AdminDashboard />}
    </div>
  );
}
