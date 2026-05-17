'use client';

import { Download, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function ReportsPage() {
  const { user } = useAuth();

  if (user?.role !== 'ADMIN') return null;

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <div className="flex-gap mb-8">
        <FileSpreadsheet size={32} color="var(--success-color)" />
        <div>
          <h1 className="page-title" style={{ marginBottom: 0 }}>Export Reports</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>Download raw achievement data for the organization.</p>
        </div>
      </div>

      <div className="glass-card">
        <h2 className="text-xl font-semibold mb-4">Goal Achievements Export</h2>
        <p className="text-secondary mb-6">
          Download a complete CSV export of all goals across the organization, including planned targets, actual achievements, and computed progress scores.
        </p>
        
        <a href="/api/admin/reports" className="btn btn-primary" download="goal_achievements.csv">
          <Download size={18} /> Download CSV
        </a>
      </div>
    </div>
  );
}
