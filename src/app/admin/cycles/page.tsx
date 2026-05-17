'use client';

import { Settings, Calendar } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function AdminCyclesPage() {
  const { user } = useAuth();

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

      <div className="glass-card mb-6">
        <div className="flex-between mb-4">
          <h2 className="text-xl font-semibold">Current Cycle: 2024</h2>
          <span className="badge badge-primary">Active</span>
        </div>
        
        <p className="text-secondary mb-6">Configure the check-in windows for the 2024 performance cycle.</p>
        
        <div className="grid-cols-2">
          {['Q1', 'Q2', 'Q3', 'Q4'].map((quarter, idx) => (
            <div key={quarter} className="glass-panel p-4" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div className="flex-between">
                <h3 className="font-semibold">{quarter} Check-in</h3>
                {idx === 1 ? <span className="badge badge-success">Open</span> : <span className="badge badge-neutral">{idx < 1 ? 'Closed' : 'Upcoming'}</span>}
              </div>
              <div className="text-sm text-secondary flex-gap mt-2">
                <Calendar size={14} /> 
                {idx === 0 ? 'Jan 1 - Mar 31' : idx === 1 ? 'Apr 1 - Jun 30' : idx === 2 ? 'Jul 1 - Sep 30' : 'Oct 1 - Dec 31'}
              </div>
              <button className="btn btn-secondary text-xs mt-2 w-fit" onClick={() => alert('Feature mocked for demo.')}>
                Edit Dates
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-center mt-8">
        <button className="btn btn-primary" onClick={() => alert('Feature mocked for demo.')}>
          + Create New Cycle (2025)
        </button>
      </div>
    </div>
  );
}
