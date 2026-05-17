'use client';

import { Users, FileText, CheckSquare, Target, Settings, Download } from 'lucide-react';
import Link from 'next/link';
import styles from './Dashboard.module.css';

export function AdminDashboard() {
  return (
    <div>
      <div className={styles.dashboardGrid}>
        <div className="glass-card">
          <div className={styles.statCard}>
            <div className={styles.statIcon}>
              <Users size={24} />
            </div>
            <div className={styles.statInfo}>
              <h3>Total Employees</h3>
              <p>4</p>
            </div>
          </div>
        </div>
        <div className="glass-card">
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success-color)' }}>
              <CheckSquare size={24} />
            </div>
            <div className={styles.statInfo}>
              <h3>Org Completion Rate</h3>
              <p>50%</p>
            </div>
          </div>
        </div>
        <div className="glass-card">
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning-color)' }}>
              <Target size={24} />
            </div>
            <div className={styles.statInfo}>
              <h3>Active Cycles</h3>
              <p>2024</p>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Administration</h2>
        </div>
        <div className="grid-cols-3">
          <Link href="/admin/users" className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', textDecoration: 'none' }}>
            <Users size={32} color="var(--primary-color)" />
            <h3 style={{ fontSize: '1.1rem' }}>Manage Users</h3>
            <p className="text-secondary" style={{ textAlign: 'center', fontSize: '0.9rem' }}>View and edit employee roles and hierarchy.</p>
          </Link>
          <Link href="/admin/cycles" className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', textDecoration: 'none' }}>
            <Settings size={32} color="var(--accent-color)" />
            <h3 style={{ fontSize: '1.1rem' }}>Goal Cycles</h3>
            <p className="text-secondary" style={{ textAlign: 'center', fontSize: '0.9rem' }}>Manage performance cycle windows and dates.</p>
          </Link>
          <Link href="/admin/reports" className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', textDecoration: 'none' }}>
            <Download size={32} color="var(--success-color)" />
            <h3 style={{ fontSize: '1.1rem' }}>Export Reports</h3>
            <p className="text-secondary" style={{ textAlign: 'center', fontSize: '0.9rem' }}>Download CSV reports of achievement data.</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
