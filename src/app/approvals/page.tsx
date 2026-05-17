'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { FileText, CheckCircle, Clock } from 'lucide-react';
import Link from 'next/link';

export default function ApprovalsPage() {
  const { user } = useAuth();
  const [goalSheets, setGoalSheets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id && user.role === 'MANAGER') {
      fetch(`/api/approvals?managerId=${user.id}`)
        .then(res => res.json())
        .then(data => {
          setGoalSheets(data);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [user]);

  if (loading) return <div className="text-secondary">Loading approvals...</div>;

  const pending = goalSheets.filter(g => g.status === 'PENDING_APPROVAL');
  const history = goalSheets.filter(g => g.status !== 'PENDING_APPROVAL');

  return (
    <div className="animate-fade-in max-w-5xl mx-auto">
      <div className="flex-gap mb-8">
        <FileText size={32} color="var(--primary-color)" />
        <div>
          <h1 className="page-title" style={{ marginBottom: 0 }}>Pending Approvals</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>Review and approve goal sheets from your team.</p>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="mb-4 text-xl font-semibold">Action Required</h2>
        {pending.length === 0 ? (
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
            <CheckCircle size={48} color="var(--success-color)" className="mx-auto mb-4" />
            <h3 className="mb-2">All Caught Up!</h3>
            <p className="text-secondary">There are no pending approvals at the moment.</p>
          </div>
        ) : (
          <div className="grid-cols-2">
            {pending.map(sheet => (
              <div key={sheet.id} className="glass-card">
                <div className="flex-between mb-4">
                  <h3 className="font-semibold text-lg">{sheet.user.name}</h3>
                  <span className="badge badge-warning">Pending</span>
                </div>
                <p className="text-secondary mb-4">{sheet.goals.length} Goals • Submitted recently</p>
                <Link href={`/approvals/${sheet.id}`} className="btn btn-primary w-full">
                  Review Goals
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-4 text-xl font-semibold">Approval History</h2>
        <div className="glass-panel" style={{ padding: '1rem', overflowX: 'auto' }}>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Employee</th>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Goals</th>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Status</th>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {history.map(sheet => (
                <tr key={sheet.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '1rem', fontWeight: 500 }}>{sheet.user.name}</td>
                  <td style={{ padding: '1rem' }}>{sheet.goals.length}</td>
                  <td style={{ padding: '1rem' }}>
                    <span className="badge badge-success">{sheet.status}</span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <Link href={`/approvals/${sheet.id}`} className="btn btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}>
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No history found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
