'use client';

import { useAuth } from '@/lib/auth-context';
import styles from './Navbar.module.css';

export function Navbar() {
  const { user } = useAuth();

  if (!user) return null;

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <header className={styles.navbar}>
      <div className={styles.userInfo}>
        <div className={styles.userDetails}>
          <span className={styles.userName}>{user.name}</span>
          <span className={styles.userRole}>{user.role}</span>
        </div>
        <div className={styles.avatar}>{initials}</div>
      </div>
    </header>
  );
}
