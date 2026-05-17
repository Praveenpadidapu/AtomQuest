'use client';

import { useEffect, useState } from 'react';
import { Users, UserPlus, X, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'EMPLOYEE',
    managerId: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUsers = () => {
    fetch('/api/admin/users')
      .then(res => res.json())
      .then(data => {
        setUsers(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        toast.error('Failed to load users');
        setLoading(false);
      });
  };

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      fetchUsers();
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          managerId: formData.managerId || null,
        }),
      });

      if (res.ok) {
        toast.success('User created successfully');
        setIsModalOpen(false);
        setFormData({ name: '', email: '', password: '', role: 'EMPLOYEE', managerId: '' });
        fetchUsers();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to create user');
      }
    } catch (err) {
      toast.error('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (user?.role !== 'ADMIN') return null;

  const managers = users.filter(u => u.role === 'MANAGER' || u.role === 'ADMIN');

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
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
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
                      <button className="btn btn-secondary text-xs" onClick={() => toast('Edit feature coming soon (Phase 3.2)')}>
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

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '500px', padding: '2rem' }}>
            <div className="flex-between mb-6">
              <h2 className="text-xl font-bold">Add New User</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="label">Full Name</label>
                <input required type="text" className="input-field" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="label">Email Address</label>
                <input required type="email" className="input-field" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <div>
                <label className="label">Temporary Password</label>
                <input required type="text" className="input-field" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
              </div>
              <div className="grid-cols-2">
                <div>
                  <label className="label">Role</label>
                  <select required className="input-field" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                    <option value="EMPLOYEE">Employee</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="label">Assign Manager</label>
                  <select className="input-field" value={formData.managerId} onChange={e => setFormData({...formData, managerId: e.target.value})}>
                    <option value="">None</option>
                    {managers.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="mt-4 flex gap-2 justify-end">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
