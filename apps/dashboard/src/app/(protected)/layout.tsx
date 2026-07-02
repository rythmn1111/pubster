'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { AppShell } from '@/components/AppShell';

/**
 * Guards every dashboard route: unauthenticated visitors are redirected to
 * `/login`; authenticated ones get the app shell (sidebar + nav).
 */
export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  if (status !== 'authenticated' || !user) {
    return <div className="center-screen">Loading…</div>;
  }

  return <AppShell user={user}>{children}</AppShell>;
}
