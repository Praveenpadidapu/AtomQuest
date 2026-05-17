'use client';

import { Users, FileText, CheckSquare, Target } from 'lucide-react';
import Link from 'next/link';
import styles from './Dashboard.module.css';

export function ManagerDashboard() {
  return (
    <div>
      <div className={styles.dashboardGrid}>
        <div className="glass-card">
          <div className={styles.statCard}>
            <div className={styles.statIcon}>
              <Users size={24} />
            </div>
            <div className={styles.statInfo}>
              <h3>Team Members</h3>
              <p>2</p>
            </div>
          </div>
        </div>
        <div className="glass-card">
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning-color)' }}>
              <FileText size={24} />
            </div>
            <div className={styles.statInfo}>
              <h3>Pending Approvals</h3>
              <p>1</p>
            </div>
          </div>
        </div>
        <div className="glass-card">
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success-color)' }}>
              <CheckSquare size={24} />
            </div>
            <div className={styles.statInfo}>
              <h3>Check-ins Completed</h3>
              <p>1 / 2</p>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Quick Actions</h2>
        </div>
        <div className="grid-cols-2">
          <Link href="/approvals" className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', textDecoration: 'none' }}>
            <FileText size={32} color="var(--primary-color)" />
            <h3 style={{ fontSize: '1.1rem' }}>Review Approvals</h3>
            <p className="text-secondary" style={{ textAlign: 'center', fontSize: '0.9rem' }}>Review and approve submitted goal sheets from your team.</p>
          </Link>
          <Link href="/team-check-ins" className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', textDecoration: 'none' }}>
            <CheckSquare size={32} color="var(--accent-color)" />
            <h3 style={{ fontSize: '1.1rem' }}>Team Check-ins</h3>
            <p className="text-secondary" style={{ textAlign: 'center', fontSize: '0.9rem' }}>View team progress and provide quarterly feedback.</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
