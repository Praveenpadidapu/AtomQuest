'use client';

import { useEffect, useState } from 'react';
import { Settings, Calendar } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';

export default function AdminCyclesPage() {
  const { user } = useAuth();
  const [cycles, setCycles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      fetch('/api/admin/cycles')
        .then(res => res.json())
        .then(data => {
          setCycles(data);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          toast.error('Failed to load cycles');
          setLoading(false);
        });
    }
  }, [user]);

  if (user?.role !== 'ADMIN') return null;

  return (
    <div className="animate-fade-in max-w-4xl mx-auto p-4">
      <div className="flex-gap mb-8">
        <Settings size={32} color="var(--accent-color)" />
        <div>
          <h1 className="page-title" style={{ marginBottom: 0 }}>Goal Cycles</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>Manage performance cycle windows and check-in dates.</p>
        </div>
      </div>

      {loading ? (
        <div className="text-secondary p-4">Loading cycles...</div>
      ) : (
        cycles.map(cycle => (
          <div key={cycle.id} className="glass-card mb-6">
            <div className="flex-between mb-4">
              <h2 className="text-xl font-semibold">Performance Cycle: {cycle.year}</h2>
              {cycle.isActive ? (
                <span className="badge badge-primary">Active</span>
              ) : (
                <span className="badge badge-neutral">Inactive</span>
              )}
            </div>
            
            <p className="text-secondary mb-6">Configure the check-in windows for the {cycle.year} performance cycle.</p>
            
            <div className="grid-cols-2">
              {[
                { name: 'Q1', start: cycle.q1StartDate, end: cycle.q1EndDate, status: cycle.q1Status },
                { name: 'Q2', start: cycle.q2StartDate, end: cycle.q2EndDate, status: cycle.q2Status },
                { name: 'Q3', start: cycle.q3StartDate, end: cycle.q3EndDate, status: cycle.q3Status },
                { name: 'Q4', start: cycle.q4StartDate, end: cycle.q4EndDate, status: cycle.q4Status },
              ].map((q) => (
                <div key={q.name} className="glass-panel p-4" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div className="flex-between">
                    <h3 className="font-semibold">{q.name} Check-in</h3>
                    <span className={`badge ${q.status === 'ACTIVE' ? 'badge-success' : q.status === 'CLOSED' ? 'badge-danger' : 'badge-neutral'}`}>
                      {q.status}
                    </span>
                  </div>
                  <div className="text-sm text-secondary flex-gap mt-2">
                    <Calendar size={14} /> 
                    {q.start ? new Date(q.start).toLocaleDateString() : 'TBD'} - {q.end ? new Date(q.end).toLocaleDateString() : 'TBD'}
                  </div>
                  <button 
                    className="btn btn-secondary text-xs mt-2 w-fit" 
                    onClick={() => toast('Edit feature coming soon (Phase 3)')}
                  >
                    Edit Dates
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      <div className="flex-center mt-8">
        <button className="btn btn-primary" onClick={() => toast.success('Created 2025 cycle (Demo)')}>
          + Create New Cycle
        </button>
      </div>
    </div>
  );
}
