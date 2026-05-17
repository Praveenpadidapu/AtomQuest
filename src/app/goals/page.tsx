'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Target, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function GoalsPage() {
  const { user, isLoading } = useAuth();
  const [goalSheet, setGoalSheet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

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

  if (loading || isLoading) {
    return <div className="text-secondary p-8">Loading your goals...</div>;
  }

  return (
    <div className="animate-fade-in max-w-5xl mx-auto p-4">
      <div className="flex-between mb-8">
        <div className="flex-gap">
          <Target size={32} color="var(--primary-color)" />
          <div>
            <h1 className="page-title" style={{ marginBottom: 0 }}>My Goals</h1>
            <p className="page-subtitle" style={{ marginBottom: 0 }}>View and manage your current goal sheet.</p>
          </div>
        </div>
        {(!goalSheet || goalSheet.error) && (
          <Link href="/goals/new" className="btn btn-primary">
            <Plus size={18} /> Create Goal Sheet
          </Link>
        )}
      </div>

      {(!goalSheet || goalSheet.error) ? (
        <div className="glass-panel" style={{ padding: '4rem', textAlign: 'center' }}>
          <Target size={64} className="mx-auto mb-4 text-secondary" />
          <h2 className="text-xl font-semibold mb-2">No Goals Found</h2>
          <p className="text-secondary mb-6">You haven't set up your goals for the current cycle yet.</p>
          <Link href="/goals/new" className="btn btn-primary">
            Start Goal Setting
          </Link>
        </div>
      ) : (
        <div className="glass-card">
          <div className="flex-between mb-6">
            <div>
              <h2 className="text-xl font-semibold">2024 Goal Cycle</h2>
              <p className="text-secondary text-sm mt-1">Submitted on: {goalSheet.submittedAt ? new Date(goalSheet.submittedAt).toLocaleDateString() : 'Draft'}</p>
            </div>
            <div className="flex-gap">
              <span className={`badge ${goalSheet.status === 'LOCKED' || goalSheet.status === 'APPROVED' ? 'badge-success' : 'badge-warning'}`}>
                {goalSheet.status}
              </span>
              {['DRAFT', 'REJECTED'].includes(goalSheet.status) && (
                <Link href={`/goals/edit/${goalSheet.id}`} className="btn btn-secondary">
                  Edit Goals
                </Link>
              )}
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Title</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Description</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Thrust Area</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Target</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Weightage</th>
                </tr>
              </thead>
              <tbody>
                {goalSheet.goals.map((goal: any) => (
                  <tr key={goal.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '1rem', fontWeight: 500 }}>{goal.title}</td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{goal.description}</td>
                    <td style={{ padding: '1rem' }}>{goal.thrustArea}</td>
                    <td style={{ padding: '1rem' }}>{goal.target} ({goal.uomType})</td>
                    <td style={{ padding: '1rem' }}>{goal.weightage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
