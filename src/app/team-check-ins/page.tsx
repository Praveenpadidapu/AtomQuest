'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { CheckSquare } from 'lucide-react';
import Link from 'next/link';

export default function TeamCheckInsPage() {
  const { user } = useAuth();
  const [goalSheets, setGoalSheets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id && user.role === 'MANAGER') {
      fetch(`/api/approvals?managerId=${user.id}`)
        .then(res => res.json())
        .then(data => {
          // Filter to only approved/locked goal sheets
          setGoalSheets(data.filter((g: any) => g.status === 'LOCKED'));
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [user]);

  if (loading) return <div className="text-secondary">Loading team check-ins...</div>;

  return (
    <div className="animate-fade-in max-w-5xl mx-auto">
      <div className="flex-gap mb-8">
        <CheckSquare size={32} color="var(--accent-color)" />
        <div>
          <h1 className="page-title" style={{ marginBottom: 0 }}>Team Check-ins</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>Monitor Q2 progress and provide feedback.</p>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1rem', overflowX: 'auto' }}>
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Employee</th>
              <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Overall Progress (Est.)</th>
              <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Q2 Status</th>
              <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {goalSheets.map(sheet => {
              // Basic avg progress calculation for demo
              const totalProgress = sheet.goals.reduce((acc: number, g: any) => acc + (g.progress || 0), 0);
              const avgProgress = sheet.goals.length > 0 ? (totalProgress / sheet.goals.length).toFixed(1) : 0;
              const hasQ2CheckIn = sheet.checkIns?.some((c: any) => c.quarter === 'Q2');
              
              return (
                <tr key={sheet.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '1rem', fontWeight: 500 }}>{sheet.user.name}</td>
                  <td style={{ padding: '1rem' }}>
                    <div className="flex-gap">
                      <span>{avgProgress}%</span>
                      <div style={{ width: '100px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${avgProgress}%`, background: 'var(--primary-color)' }}></div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {hasQ2CheckIn ? <span className="badge badge-success">Completed</span> : <span className="badge badge-warning">Pending</span>}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <Link href={`/check-ins/${sheet.id}`} className="btn btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}>
                      Review
                    </Link>
                  </td>
                </tr>
              );
            })}
            {goalSheets.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No active team goal sheets found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
