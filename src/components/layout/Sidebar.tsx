'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Target, LayoutDashboard, CheckSquare, Users, Settings, LogOut, FileText } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import styles from './Sidebar.module.css';

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (!user) return null;

  const employeeLinks = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'My Goals', href: '/goals', icon: Target },
    { name: 'Quarterly Check-ins', href: '/check-ins', icon: CheckSquare },
  ];

  const managerLinks = [
    { name: 'Team Dashboard', href: '/dashboard', icon: Users },
    { name: 'Pending Approvals', href: '/approvals', icon: FileText },
    { name: 'Team Check-ins', href: '/team-check-ins', icon: CheckSquare },
  ];

  const adminLinks = [
    { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { name: 'All Users', href: '/admin/users', icon: Users },
    { name: 'Goal Cycles', href: '/admin/cycles', icon: Settings },
  ];

  let links = employeeLinks;
  if (user.role === 'MANAGER') links = managerLinks;
  if (user.role === 'ADMIN') links = adminLinks;

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoContainer}>
        <Target className={styles.logoIcon} size={28} />
        <span className={styles.logoText}>AtomQuest</span>
      </div>
      
      <nav className={styles.nav}>
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
          
          return (
            <Link 
              key={link.href} 
              href={link.href}
              className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            >
              <Icon size={20} />
              <span>{link.name}</span>
            </Link>
          );
        })}
      </nav>

      <button onClick={logout} className={styles.logoutBtn}>
        <LogOut size={18} />
        <span>Logout</span>
      </button>
    </aside>
  );
}
