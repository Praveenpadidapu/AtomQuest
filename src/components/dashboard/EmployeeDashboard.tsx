'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Target, AlertCircle, Clock, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import styles from './Dashboard.module.css';

export function EmployeeDashboard() {
  const { user } = useAuth();
  const [goalSheet, setGoalSheet] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetch(`/api/goalsheets/me?userId=${user.id}`)
        .then(res => res.json())
        .then(data => {
          setGoalSheet(data);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [user]);

  if (loading) {
    return <div className="text-secondary">Loading your dashboard...</div>;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT': return <span className="badge badge-neutral">Draft</span>;
      case 'PENDING_APPROVAL': return <span className="badge badge-warning">Pending Approval</span>;
      case 'APPROVED': return <span className="badge badge-primary">Approved</span>;
      case 'LOCKED': return <span className="badge badge-success">Locked</span>;
      default: return <span className="badge badge-neutral">{status}</span>;
    }
  };

  return (
    <div>
      <div className={styles.dashboardGrid}>
        <div className="glass-card">
          <div className={styles.statCard}>
            <div className={styles.statIcon}>
              <Target size={24} />
            </div>
            <div className={styles.statInfo}>
              <h3>Total Goals</h3>
              <p>{goalSheet?.goals?.length || 0} / 8</p>
            </div>
          </div>
        </div>
        <div className="glass-card">
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success-color)' }}>
              <CheckCircle size={24} />
            </div>
            <div className={styles.statInfo}>
              <h3>Goal Sheet Status</h3>
              <p style={{ fontSize: '1.25rem', marginTop: '0.25rem' }}>
                {goalSheet ? getStatusBadge(goalSheet.status) : <span className="badge badge-neutral">Not Created</span>}
              </p>
            </div>
          </div>
        </div>
        <div className="glass-card">
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning-color)' }}>
              <Clock size={24} />
            </div>
            <div className={styles.statInfo}>
              <h3>Current Window</h3>
              <p style={{ fontSize: '1.1rem', marginTop: '0.25rem' }}>Q2 Check-in</p>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Your Goals</h2>
          {!goalSheet && (
            <Link href="/goals/new" className="btn btn-primary">
              Create Goal Sheet
            </Link>
          )}
          {goalSheet && ['DRAFT', 'REJECTED'].includes(goalSheet.status) && (
            <Link href={`/goals/edit/${goalSheet.id}`} className="btn btn-primary">
              Edit Goal Sheet
            </Link>
          )}
          {goalSheet && ['APPROVED', 'LOCKED'].includes(goalSheet.status) && (
            <Link href={`/check-ins/${goalSheet.id}`} className="btn btn-primary">
              Q2 Check-in
            </Link>
          )}
        </div>

        {!goalSheet ? (
          <div className={styles.emptyState}>
            <Target size={48} className={styles.emptyStateIcon} />
            <h3 style={{ marginBottom: '0.5rem' }}>No Goal Sheet Found</h3>
            <p className="text-secondary" style={{ marginBottom: '1.5rem' }}>You haven't created your goals for the 2024 cycle yet.</p>
            <Link href="/goals/new" className="btn btn-primary">
              Create Goal Sheet
            </Link>
          </div>
        ) : (
          <div className="glass-panel" style={{ padding: '1rem', overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Title</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Thrust Area</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Weightage</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {goalSheet.goals.map((goal: any) => (
                  <tr key={goal.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '1rem', fontWeight: 500 }}>{goal.title}</td>
                    <td style={{ padding: '1rem' }}>{goal.thrustArea}</td>
                    <td style={{ padding: '1rem' }}>{goal.weightage}%</td>
                    <td style={{ padding: '1rem' }}>
                      <span className={`badge ${goal.status === 'COMPLETED' ? 'badge-success' : goal.status === 'ON_TRACK' ? 'badge-primary' : 'badge-neutral'}`}>
                        {goal.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
