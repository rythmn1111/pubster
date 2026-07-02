'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

/**
 * Manager-only metrics placeholder. Staff are bounced to reservations (the nav
 * link is also hidden from them in {@link AppShell}). Full metrics land in
 * Phase 3 (docs/ROADMAP.md).
 */
export default function MetricsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isManager = user?.role === 'manager';

  useEffect(() => {
    if (user && !isManager) {
      router.replace('/reservations');
    }
  }, [user, isManager, router]);

  if (!isManager) {
    return <div className="center-screen">Redirecting…</div>;
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Metrics</h1>
          <p className="page-subtitle">Manager tools and analytics.</p>
        </div>
      </div>
      <div className="card card-pad empty-state">
        <h2 className="section-title">Coming soon</h2>
        <p className="muted">
          Revenue, occupancy trends, no-show rates, event revenue, and top items will appear here in
          a later phase.
        </p>
      </div>
    </>
  );
}
