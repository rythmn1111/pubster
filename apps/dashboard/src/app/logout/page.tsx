'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

/** Revoke the session (best-effort) and return to the login screen. */
export default function LogoutPage() {
  const { logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    (async () => {
      await logout();
      router.replace('/login');
    })();
  }, [logout, router]);

  return <div className="center-screen">Signing out…</div>;
}
