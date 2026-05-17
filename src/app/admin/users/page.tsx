'use client';

import { useEffect, useState } from 'react';
import { Users, UserPlus } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      fetch('/api/admin/users')
        .then(res => res.json())
        .then(data => {
          setUsers(data);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [user]);

  if (user?.role !== 'ADMIN') return null;

  return (
    <div className="animate-fade-in max-w-6xl mx-auto p-4">
      <div className="flex-between mb-8">
        <div className="flex-gap">
          <Users size={32} color="var(--primary-color)" />
          <div>
            <h1 className="page-title" style={{ marginBottom: 0 }}>Manage Users</h1>
            <p className="page-subtitle" style={{ marginBottom: 0 }}>View and configure system access and roles.</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => alert('Add user feature mocked for demo.')}>
          <UserPlus size={18} /> Add User
        </button>
      </div>

      <div className="glass-card">
        {loading ? (
          <div className="text-center p-8 text-secondary">Loading users...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Name</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Email</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Role</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Manager</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Status</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u: any) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '1rem', fontWeight: 500 }}>{u.name}</td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{u.email}</td>
                    <td style={{ padding: '1rem' }}>
                      <span className={`badge ${u.role === 'ADMIN' ? 'badge-danger' : u.role === 'MANAGER' ? 'badge-warning' : 'badge-neutral'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>{u.manager?.name || '—'}</td>
                    <td style={{ padding: '1rem' }}>
                      <span className="badge badge-success">Active</span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <button className="btn btn-secondary text-xs" onClick={() => alert('Edit feature mocked for demo.')}>
                        Edit
                      </button>
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
