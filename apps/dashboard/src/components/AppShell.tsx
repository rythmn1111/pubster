'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { UserDTO } from '@pubster/shared';

interface NavItem {
  href: string;
  label: string;
  /** Roles allowed to see this item; omitted = everyone signed in. */
  roles?: UserDTO['role'][];
}

const NAV_ITEMS: NavItem[] = [
  { href: '/reservations', label: 'Reservations' },
  { href: '/tables', label: 'Tables' },
  { href: '/metrics', label: 'Metrics', roles: ['manager'] },
];

export function AppShell({ user, children }: { user: UserDTO; children: ReactNode }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(user.role));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-dot" />
          <span>Pubster</span>
        </div>

        <nav className="nav">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? 'nav-link active' : 'nav-link'}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-meta">
            <div className="user-name">{user.name ?? user.email ?? 'Signed in'}</div>
            <div className="user-role">{user.role}</div>
          </div>
          <Link href="/logout" className="btn btn-sm btn-block">
            Sign out
          </Link>
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}
